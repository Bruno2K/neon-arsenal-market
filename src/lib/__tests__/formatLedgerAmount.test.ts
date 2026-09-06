import { describe, expect, it } from "vitest";
import {
  formatCommissionRate,
  formatLedgerAmount,
  scaleDecimalStringBy100,
} from "../formatLedgerAmount";

describe("formatLedgerAmount", () => {
  it("prefixes the API decimal string without Number() rounding", () => {
    expect(formatLedgerAmount("135.00")).toBe("$135.00");
    expect(formatLedgerAmount("0.00")).toBe("$0.00");
    expect(formatLedgerAmount("0.30")).toBe("$0.30");
  });

  it("keeps extra fractional digits from the ledger", () => {
    expect(formatLedgerAmount("90.015")).toBe("$90.015");
  });

  it("renders a missing value as an em dash", () => {
    expect(formatLedgerAmount(undefined)).toBe("—");
    expect(formatLedgerAmount("")).toBe("—");
  });
});

describe("scaleDecimalStringBy100", () => {
  it("converts a 0.1 commission fraction to 10 without JS float multiply", () => {
    expect(scaleDecimalStringBy100("0.1")).toBe("10");
    expect(scaleDecimalStringBy100("0.10")).toBe("10");
    expect(scaleDecimalStringBy100("0.15")).toBe("15");
    expect(scaleDecimalStringBy100("0.105")).toBe("10.5");
  });
});

describe("formatCommissionRate", () => {
  it("displays GET /sellers/me commissionRate as a percent", () => {
    expect(formatCommissionRate("0.1")).toBe("10%");
    expect(formatCommissionRate("0.10")).toBe("10%");
  });

  it("does not invent a default rate when the field is missing", () => {
    expect(formatCommissionRate(undefined)).toBe("—");
    expect(formatCommissionRate("")).toBe("—");
  });
});
