import type { Request } from "express";
import { afterEach, describe, expect, it } from "vitest";
import { resolveClientIp } from "../clientIp.js";

const originalRender = process.env.RENDER;

function request(socketIp: string, headers: Record<string, string> = {}): Request {
  return {
    socket: { remoteAddress: socketIp },
    get(name: string) {
      return headers[name.toLowerCase()];
    },
  } as Request;
}

afterEach(() => {
  if (originalRender === undefined) delete process.env.RENDER;
  else process.env.RENDER = originalRender;
});

describe("resolveClientIp", () => {
  it("ignores forwarding headers outside Render", () => {
    delete process.env.RENDER;
    const req = request("127.0.0.1", {
      "cf-connecting-ip": "198.51.100.10",
      "x-forwarded-for": "203.0.113.99",
    });
    expect(resolveClientIp(req)).toBe("127.0.0.1");
  });

  it("accepts one valid edge-provided IP on Render", () => {
    process.env.RENDER = "true";
    expect(
      resolveClientIp(request("10.0.0.4", { "cf-connecting-ip": "2001:db8:abcd:1200::1" }))
    ).toBe("2001:db8:abcd:1200::1");
  });

  it.each(["", "attacker", "198.51.100.1, 203.0.113.2"])(
    "falls back to the socket for an invalid Render value %j",
    (header) => {
      process.env.RENDER = "true";
      expect(resolveClientIp(request("10.0.0.4", { "cf-connecting-ip": header }))).toBe(
        "10.0.0.4"
      );
    }
  );
});
