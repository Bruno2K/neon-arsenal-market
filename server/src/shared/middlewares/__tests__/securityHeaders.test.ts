import { describe, expect, it, vi, afterEach } from "vitest";
import type { Request, Response } from "express";
import { HSTS_HEADER, SECURITY_HEADERS, securityHeaders } from "../securityHeaders.js";

function mockRes() {
  const headers = new Map<string, string>();
  return {
    headers,
    setHeader: vi.fn((name: string, value: string) => {
      headers.set(name, value);
    }),
  } as unknown as Response & { headers: Map<string, string> };
}

describe("securityHeaders", () => {
  const previousEnv = process.env.NODE_ENV;

  afterEach(() => {
    process.env.NODE_ENV = previousEnv;
  });

  it("sets the browser-abuse headers and skips HSTS outside production", () => {
    process.env.NODE_ENV = "test";
    const res = mockRes();
    const next = vi.fn();
    securityHeaders({} as Request, res, next);

    for (const [name, value] of Object.entries(SECURITY_HEADERS)) {
      expect(res.headers.get(name)).toBe(value);
    }
    expect(res.headers.has("Strict-Transport-Security")).toBe(false);
    expect(res.headers.has("Cross-Origin-Resource-Policy")).toBe(false);
    expect(next).toHaveBeenCalledOnce();
  });

  it("adds HSTS in production", () => {
    process.env.NODE_ENV = "production";
    const res = mockRes();
    securityHeaders({} as Request, res, vi.fn());
    expect(res.headers.get("Strict-Transport-Security")).toBe(HSTS_HEADER);
  });
});
