import { describe, expect, it } from "vitest";
import { containsSensitiveTelemetry, safeAttributes } from "../redact.js";

describe("telemetry redaction", () => {
  it("drops secret keys and bearer/jwt values", () => {
    const attributes = safeAttributes({
      password: "hunter2",
      authorization: "Bearer abc.def",
      "paypal-transmission-sig": "sig-value",
      access_token: "paypal-token",
      jwt: "eyJhbGciOiJIUzI1NiJ9.e30.sig",
      "http.request.method": "POST",
      note: "Bearer eyJhbGciOiJIUzI1NiJ9.e30.sig",
    });

    expect(attributes).toEqual({ "http.request.method": "POST" });
  });

  it("detects sensitive objects used in tests", () => {
    expect(containsSensitiveTelemetry({ authorization: "Bearer token" })).toBe(true);
    expect(containsSensitiveTelemetry({ "http.route": "/orders" })).toBe(false);
  });
});
