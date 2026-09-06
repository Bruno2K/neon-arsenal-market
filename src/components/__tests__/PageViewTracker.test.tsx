import { afterEach, describe, expect, it, vi } from "vitest";
import { render, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { PageViewTracker } from "../PageViewTracker";
import {
  setAnalyticsCollector,
  type AnalyticsEventName,
  type AnalyticsProps,
} from "@/lib/analytics";
import type { Role, User } from "@/types/api";

const authState = {
  user: null as User | null,
  isLoading: false,
};

vi.mock("@/contexts/AuthContext", () => ({
  useAuth: () => authState,
}));

function collect() {
  const events: { event: AnalyticsEventName; props: AnalyticsProps }[] = [];
  setAnalyticsCollector((event, props) => {
    events.push({ event, props });
  });
  return events;
}

afterEach(() => {
  setAnalyticsCollector(null);
  authState.user = null;
  authState.isLoading = false;
});

function renderTracker(path = "/") {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <PageViewTracker />
    </MemoryRouter>,
  );
}

describe("PageViewTracker", () => {
  it("records page_view with role only after auth resolves", async () => {
    const events = collect();
    authState.user = {
      id: "u1",
      name: "Buyer",
      email: "buyer@test.com",
      role: "CUSTOMER" as Role,
    };

    renderTracker("/products");

    await waitFor(() => {
      expect(events).toEqual([
        {
          event: "page_view",
          props: { path: "/products", role: "CUSTOMER" },
        },
      ]);
    });
    expect(JSON.stringify(events)).not.toMatch(/buyer@test.com|Buyer/);
  });

  it("uses guest when the visitor is anonymous", async () => {
    const events = collect();
    renderTracker("/");

    await waitFor(() => {
      expect(events[0]).toEqual({
        event: "page_view",
        props: { path: "/", role: "guest" },
      });
    });
  });

  it("does not emit while auth is still loading", () => {
    const events = collect();
    authState.isLoading = true;
    renderTracker("/cart");
    expect(events).toEqual([]);
  });
});
