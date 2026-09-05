function redactDatabaseUrl(url: string) {
  return url.replace(/:[^:@/]+@/, ":***@");
}

/**
 * Integration tests fail closed. A missing or unreachable PostgreSQL is an
 * error, not a skip. Unit tests that do not need a database use `test:unit`.
 */
export function resolveIntegrationDatabaseUrl() {
  const configured = process.env.TEST_DATABASE_URL ?? process.env.DATABASE_URL ?? "";
  if (!configured.startsWith("postgres")) {
    throw new Error(
      [
        "PostgreSQL integration tests require DATABASE_URL or TEST_DATABASE_URL",
        "pointing at a real PostgreSQL instance.",
        "These tests are not skipped when the database is unavailable.",
        "Run `npm run test:unit` for tests that do not need PostgreSQL.",
        "See docs/testing.md.",
      ].join(" ")
    );
  }
  process.env.DATABASE_URL = configured;
  return configured;
}

export function describeUnreachableDatabase(url: string, error: unknown) {
  const detail = error instanceof Error ? error.message : String(error);
  return `PostgreSQL is configured (${redactDatabaseUrl(url)}) but unreachable: ${detail}`;
}
