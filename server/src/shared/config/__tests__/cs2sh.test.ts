import { afterEach, describe, expect, it } from "vitest";
import {
  DEFAULT_CS2SH_API_BASE_URL,
  DEFAULT_CS2SH_API_TIMEOUT_MS,
  getCs2ShApiBaseUrl,
  getCs2ShApiTimeoutMs,
  isCs2ShConfigured,
  isCs2ShImportEnabled,
} from "../cs2sh.js";

const keys = [
  "CS2SH_API_KEY",
  "CS2SH_API_BASE_URL",
  "CS2SH_API_TIMEOUT_MS",
  "CS2SH_IMPORT",
] as const;

const snapshot = Object.fromEntries(keys.map((key) => [key, process.env[key]]));

afterEach(() => {
  for (const key of keys) {
    const value = snapshot[key];
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  }
});

describe("cs2.sh config", () => {
  it("defaults base URL, timeout, and import off", () => {
    delete process.env.CS2SH_API_KEY;
    delete process.env.CS2SH_API_BASE_URL;
    delete process.env.CS2SH_API_TIMEOUT_MS;
    delete process.env.CS2SH_IMPORT;
    expect(isCs2ShConfigured()).toBe(false);
    expect(isCs2ShImportEnabled()).toBe(false);
    expect(getCs2ShApiBaseUrl()).toBe(DEFAULT_CS2SH_API_BASE_URL);
    expect(getCs2ShApiTimeoutMs()).toBe(DEFAULT_CS2SH_API_TIMEOUT_MS);
  });

  it("strips trailing slashes from the base URL", () => {
    process.env.CS2SH_API_BASE_URL = "https://example.test/cs2/";
    expect(getCs2ShApiBaseUrl()).toBe("https://example.test/cs2");
  });

  it("treats CS2SH_IMPORT as true only for the string true", () => {
    process.env.CS2SH_IMPORT = "true";
    expect(isCs2ShImportEnabled()).toBe(true);
    process.env.CS2SH_IMPORT = "1";
    expect(isCs2ShImportEnabled()).toBe(false);
  });
});
