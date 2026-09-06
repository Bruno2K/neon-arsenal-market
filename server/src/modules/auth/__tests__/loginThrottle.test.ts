import { describe, it, expect } from "vitest";
import {
  delayAfterFailuresMs,
  nextAllowedAtAfterFailure,
  normalizeLoginEmail,
  retryAfterSeconds,
  shouldResetThrottleWindow,
  LOGIN_THROTTLE,
} from "../loginThrottle.js";

describe("loginThrottle", () => {
  it("normalizes email for the throttle key", () => {
    expect(normalizeLoginEmail("  Admin@SkinMarket.GG ")).toBe("admin@skinmarket.gg");
  });

  it("applies progressive delay after free failures", () => {
    expect(delayAfterFailuresMs(1)).toBe(0);
    expect(delayAfterFailuresMs(2)).toBe(0);
    expect(delayAfterFailuresMs(3)).toBe(1_000);
    expect(delayAfterFailuresMs(4)).toBe(2_000);
    expect(delayAfterFailuresMs(5)).toBe(4_000);
    expect(delayAfterFailuresMs(20)).toBe(LOGIN_THROTTLE.maxDelayMs);
  });

  it("computes nextAllowedAt and Retry-After seconds", () => {
    const now = new Date("2026-09-06T12:00:00.000Z");
    expect(nextAllowedAtAfterFailure(2, now)).toBeNull();
    const next = nextAllowedAtAfterFailure(3, now);
    expect(next?.toISOString()).toBe("2026-09-06T12:00:01.000Z");
    expect(retryAfterSeconds(next!, now)).toBe(1);
  });

  it("resets the window after 15 quiet minutes", () => {
    const last = new Date("2026-09-06T12:00:00.000Z");
    expect(shouldResetThrottleWindow(last, new Date("2026-09-06T12:14:59.000Z"))).toBe(false);
    expect(shouldResetThrottleWindow(last, new Date("2026-09-06T12:15:00.000Z"))).toBe(true);
  });
});
