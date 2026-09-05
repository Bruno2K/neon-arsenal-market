import { describe, expect, it } from "vitest";
import {
  getAllowedCorsOrigins,
  isCorsOriginAllowed,
  normalizeOrigin,
} from "../cors.js";

describe("CORS configuration", () => {
  it("normalizes configured frontend origins", () => {
    expect(normalizeOrigin("https://frontend.example.com/")).toBe("https://frontend.example.com");
    expect(normalizeOrigin(" https://preview.example.com/path ")).toBe("https://preview.example.com");
  });

  it("supports comma-separated production and preview frontend origins", () => {
    const allowedOrigins = getAllowedCorsOrigins(
      "https://frontend.example.com/, https://preview.example.com"
    );

    expect(allowedOrigins).toContain("https://frontend.example.com");
    expect(allowedOrigins).toContain("https://preview.example.com");
    expect(isCorsOriginAllowed("https://frontend.example.com", allowedOrigins)).toBe(true);
  });

  it("does not allow unrelated browser origins", () => {
    const allowedOrigins = getAllowedCorsOrigins("https://frontend.example.com");

    expect(isCorsOriginAllowed("https://attacker.example.com", allowedOrigins)).toBe(false);
  });

  it("allows non-browser requests without an origin header", () => {
    expect(isCorsOriginAllowed(undefined, getAllowedCorsOrigins("https://frontend.example.com"))).toBe(
      true
    );
  });
});
