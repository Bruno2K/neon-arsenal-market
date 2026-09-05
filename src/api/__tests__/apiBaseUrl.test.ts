import { describe, expect, it } from "vitest";
import { resolveApiBaseUrl } from "../apiBaseUrl";

describe("resolveApiBaseUrl", () => {
  it("prefers API_URL without a public framework prefix", () => {
    expect(
      resolveApiBaseUrl({
        API_URL: "https://neon-arsenal-api.onrender.com/",
        VITE_API_URL: "http://localhost:3001",
      }),
    ).toBe("https://neon-arsenal-api.onrender.com");
  });

  it("falls back to VITE_API_URL for local setups", () => {
    expect(resolveApiBaseUrl({ VITE_API_URL: "http://localhost:3001/" })).toBe(
      "http://localhost:3001",
    );
  });

  it("defaults to the local API when neither variable is set", () => {
    expect(resolveApiBaseUrl({})).toBe("http://localhost:3001");
  });
});
