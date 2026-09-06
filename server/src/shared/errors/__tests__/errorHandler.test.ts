import { describe, expect, it, vi } from "vitest";
import type { Request, Response } from "express";
import { errorHandler } from "../errorHandler.js";
import { AppError } from "../AppError.js";

vi.mock("../../logger.js", () => ({
  logger: { error: vi.fn() },
}));

function mockRes() {
  const headers = new Map<string, string>();
  const res = {
    statusCode: 0,
    body: undefined as unknown,
    setHeader: vi.fn((name: string, value: string) => {
      headers.set(name, value);
    }),
    status: vi.fn(function status(this: typeof res, code: number) {
      res.statusCode = code;
      return res;
    }),
    json: vi.fn(function json(this: typeof res, body: unknown) {
      res.body = body;
      return res;
    }),
  };
  return Object.assign(res, { headers });
}

function req(): Request {
  return { requestId: "req-1" } as Request;
}

describe("errorHandler", () => {
  it("maps payload-too-large to 413 without echoing the body", () => {
    const res = mockRes();
    const err = Object.assign(new Error("entity too large"), { type: "entity.too.large", status: 413 });
    errorHandler(err, req(), res as unknown as Response, vi.fn());
    expect(res.statusCode).toBe(413);
    expect(res.body).toEqual({ error: "Request payload too large." });
  });

  it("maps invalid JSON to 400 without leaking the parse text", () => {
    const res = mockRes();
    const err = Object.assign(new SyntaxError("Unexpected token x in JSON at position 0"), {
      type: "entity.parse.failed",
      status: 400,
      body: "{not-json",
    });
    errorHandler(err, req(), res as unknown as Response, vi.fn());
    expect(res.statusCode).toBe(400);
    expect(res.body).toEqual({ error: "Invalid JSON body." });
    expect(JSON.stringify(res.body)).not.toContain("not-json");
  });

  it("maps CORS rejection to 403 without echoing the Origin", () => {
    const res = mockRes();
    errorHandler(
      new Error('CORS: origin "https://attacker.example.com" not allowed'),
      req(),
      res as unknown as Response,
      vi.fn()
    );
    expect(res.statusCode).toBe(403);
    expect(res.body).toEqual({ error: "Origin not allowed." });
    expect(JSON.stringify(res.body)).not.toContain("attacker.example.com");
  });

  it("hides unhandled stacks from the client", () => {
    const res = mockRes();
    const err = new Error("prisma explode at /secret/path");
    err.stack = "Error: prisma explode\n    at /secret/path:1:1";
    errorHandler(err, req(), res as unknown as Response, vi.fn());
    expect(res.statusCode).toBe(500);
    expect(res.body).toEqual({ error: "Internal server error." });
    expect(JSON.stringify(res.body)).not.toContain("secret");
    expect(JSON.stringify(res.body)).not.toContain("stack");
  });

  it("still returns AppError messages", () => {
    const res = mockRes();
    errorHandler(new AppError(404, "Order not found"), req(), res as unknown as Response, vi.fn());
    expect(res.statusCode).toBe(404);
    expect(res.body).toEqual({ error: "Order not found" });
  });
});
