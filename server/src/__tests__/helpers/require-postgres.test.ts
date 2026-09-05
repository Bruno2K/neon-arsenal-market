import { afterEach, describe, expect, it } from "vitest";
import { resolveIntegrationDatabaseUrl } from "./require-postgres.js";

const originalDatabaseUrl = process.env.DATABASE_URL;
const originalTestDatabaseUrl = process.env.TEST_DATABASE_URL;

afterEach(() => {
  if (originalDatabaseUrl === undefined) delete process.env.DATABASE_URL;
  else process.env.DATABASE_URL = originalDatabaseUrl;
  if (originalTestDatabaseUrl === undefined) delete process.env.TEST_DATABASE_URL;
  else process.env.TEST_DATABASE_URL = originalTestDatabaseUrl;
});

describe("resolveIntegrationDatabaseUrl", () => {
  it("fails closed when PostgreSQL is not configured", () => {
    delete process.env.DATABASE_URL;
    delete process.env.TEST_DATABASE_URL;

    expect(() => resolveIntegrationDatabaseUrl()).toThrow(/not skipped/i);
  });

  it("rejects a non-PostgreSQL DATABASE_URL instead of falling back to SQLite", () => {
    process.env.DATABASE_URL = "file:./dev.db";
    delete process.env.TEST_DATABASE_URL;

    expect(() => resolveIntegrationDatabaseUrl()).toThrow(/real PostgreSQL/i);
  });

  it("prefers TEST_DATABASE_URL for the integration suite", () => {
    process.env.DATABASE_URL = "postgresql://dev:dev@localhost:5432/neon_arsenal";
    process.env.TEST_DATABASE_URL = "postgresql://neon:test@localhost:5433/neon_arsenal_test";

    expect(resolveIntegrationDatabaseUrl()).toBe(
      "postgresql://neon:test@localhost:5433/neon_arsenal_test"
    );
    expect(process.env.DATABASE_URL).toBe(
      "postgresql://neon:test@localhost:5433/neon_arsenal_test"
    );
  });
});
