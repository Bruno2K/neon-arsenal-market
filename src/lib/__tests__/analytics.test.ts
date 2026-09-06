import { afterEach, describe, expect, it, vi } from "vitest";
import {
  ANALYTICS_EVENTS,
  analyticsPrice,
  isAnalyticsSource,
  marketSearchQuery,
  readAnalyticsSource,
  setAnalyticsCollector,
  track,
  type AnalyticsEventName,
  type AnalyticsProps,
} from "../analytics";

const PII_PROPS = {
  email: "buyer@test.com",
  password: "secret-pass",
  token: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.aaa.bbb",
  jwt: "header.payload.sig",
  name: "Ana Buyer",
  accessToken: "access-secret",
  refreshToken: "refresh-secret",
};

function collect() {
  const events: { event: AnalyticsEventName; props: AnalyticsProps }[] = [];
  setAnalyticsCollector((event, props) => {
    events.push({ event, props });
  });
  return events;
}

afterEach(() => {
  setAnalyticsCollector(null);
  vi.restoreAllMocks();
});

describe("analytics wrapper", () => {
  it("exposes every funnel event name", () => {
    expect([...ANALYTICS_EVENTS]).toEqual([
      "page_view",
      "search",
      "search_result_click",
      "category_view",
      "product_view",
      "cart_add",
      "cart_remove",
      "checkout_started",
      "payment_started",
      "payment_return",
      "payment_cancel",
      "order_viewed",
      "seller_listing_created",
    ]);
  });

  it("no-ops when no collector is registered", () => {
    expect(() =>
      track("page_view", { path: "/", role: "guest" }),
    ).not.toThrow();
  });

  it("forwards each funnel event to an optional collector", () => {
    const events = collect();
    const samples: [AnalyticsEventName, AnalyticsProps][] = [
      ["page_view", { path: "/", role: "CUSTOMER" }],
      [
        "search",
        { productId: "prod-1", query: "productId=prod-1", source: "market" },
      ],
      [
        "search_result_click",
        {
          listingId: "l1",
          productId: "prod-1",
          price: "12.50",
          source: "market",
        },
      ],
      ["category_view", { productId: "prod-1", source: "home" }],
      [
        "product_view",
        {
          listingId: "l1",
          productId: "prod-1",
          price: "12.50",
          source: "home",
        },
      ],
      [
        "cart_add",
        {
          listingId: "l1",
          productId: "prod-1",
          price: "12.50",
          source: "market",
        },
      ],
      ["cart_remove", { listingId: "l1", productId: "prod-1", price: "12.50" }],
      ["checkout_started", { itemCount: 1 }],
      ["payment_started", { orderId: "order-1" }],
      ["payment_return", { orderId: "order-1" }],
      ["payment_cancel", { orderId: "order-1" }],
      ["order_viewed", { orderId: "order-1" }],
      [
        "seller_listing_created",
        {
          listingId: "l1",
          productId: "prod-1",
          price: "18.5",
          source: "seller",
        },
      ],
    ];

    for (const [event, props] of samples) {
      track(event, props);
    }

    expect(events.map((row) => row.event)).toEqual(ANALYTICS_EVENTS);
    expect(events[0].props).toEqual({ path: "/", role: "CUSTOMER" });
    expect(events[5].props.price).toBe("12.50");
  });

  it("strips email, JWT, password and names from event props", () => {
    const events = collect();
    track("page_view", {
      path: "/checkout",
      role: "CUSTOMER",
      listingId: "l1",
      ...(PII_PROPS as unknown as AnalyticsProps),
    });

    const props = events[0]?.props ?? {};
    expect(props).toEqual({
      path: "/checkout",
      role: "CUSTOMER",
      listingId: "l1",
    });
    expect(JSON.stringify(props)).not.toMatch(
      /buyer@test.com|secret-pass|eyJhbGci|Ana Buyer|access-secret|refresh-secret/i,
    );
  });

  it("keeps price as a string and drops unknown sources", () => {
    const events = collect();
    track("cart_add", {
      listingId: "l1",
      price: 22 as unknown as string,
      source: "newsletter" as AnalyticsProps["source"],
    });
    expect(events[0].props.price).toBe("22");
    expect(events[0].props.source).toBeUndefined();
  });

  it("does not throw when the collector fails", () => {
    setAnalyticsCollector(() => {
      throw new Error("sink down");
    });
    expect(() => track("checkout_started", { itemCount: 1 })).not.toThrow();
  });
});

describe("analytics helpers", () => {
  it("stringifies prices without using floating-point math", () => {
    expect(analyticsPrice("10.25")).toBe("10.25");
    expect(analyticsPrice(18.5)).toBe("18.5");
    expect(analyticsPrice(undefined)).toBeUndefined();
  });

  it("reads an allowlisted navigation source", () => {
    expect(isAnalyticsSource("home")).toBe(true);
    expect(isAnalyticsSource("email")).toBe(false);
    expect(readAnalyticsSource({ source: "related" })).toBe("related");
    expect(readAnalyticsSource({ source: "email" })).toBeUndefined();
  });

  it("serializes market filters without PII", () => {
    expect(
      marketSearchQuery({
        productId: "ak-redline-ft",
        exterior: "Factory New",
        isStattrak: true,
        minPrice: "10",
        maxPrice: "40",
      }),
    ).toBe(
      "productId=ak-redline-ft&exterior=Factory+New&isStattrak=true&minPrice=10&maxPrice=40",
    );
    expect(marketSearchQuery({})).toBeUndefined();
  });
});
