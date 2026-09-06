import { describe, expect, it } from "vitest";
import { openApiSpec } from "../openapi.js";
import { assertErrorBody, assertMatchesSchema, type JsonSchema, type OpenApiLike } from "../openapiAssert.js";

const spec = openApiSpec as unknown as OpenApiLike;

describe("openapiAssert", () => {
  it("accepts the live Error wire shape { error }", () => {
    expect(() => assertErrorBody({ error: "Route not found" }, spec)).not.toThrow();
  });

  it("rejects an Error body that is not an object", () => {
    expect(() => assertErrorBody("nope", spec)).toThrow(/error/);
  });

  it("requires OffsetPage fields and allows additive nextCursor", () => {
    expect(() =>
      assertMatchesSchema(
        { items: [], total: 0, page: 1, limit: 20, nextCursor: null },
        spec.components?.schemas?.OffsetPage as JsonSchema,
        spec
      )
    ).not.toThrow();
  });

  it("rejects a cursor page that claims to be an OffsetPage", () => {
    expect(() =>
      assertMatchesSchema(
        { items: [], limit: 20, nextCursor: null },
        spec.components?.schemas?.OffsetPage as JsonSchema,
        spec
      )
    ).toThrow(/missing required property/);
  });
});
