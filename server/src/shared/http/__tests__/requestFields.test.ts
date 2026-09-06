import { describe, expect, it } from "vitest";
import type { Request } from "express";
import { replaceRequestField, requestParam } from "../requestFields.js";

describe("replaceRequestField", () => {
  it("installs a writable query object over an Express 5 getter", () => {
    const req = {} as Request;
    Object.defineProperty(req, "query", {
      configurable: true,
      enumerable: true,
      get() {
        return { cursor: "raw" };
      },
    });
    expect(() => {
      (req as { query: unknown }).query = { cursor: "parsed" };
    }).toThrow(/only a getter/);

    replaceRequestField(req, "query", { cursor: "parsed", page: 1 });
    expect(req.query).toEqual({ cursor: "parsed", page: 1 });
  });
});

describe("requestParam", () => {
  it("returns a single string segment", () => {
    const req = { params: { id: "listing-1" } } as unknown as Request;
    expect(requestParam(req, "id")).toBe("listing-1");
  });

  it("uses the first value when Express repeats the segment", () => {
    const req = { params: { id: ["a", "b"] } } as unknown as Request;
    expect(requestParam(req, "id")).toBe("a");
  });

  it("throws 400 when the param is missing", () => {
    const req = { params: {} } as unknown as Request;
    expect(() => requestParam(req, "id")).toThrow(/Invalid id/);
  });
});
