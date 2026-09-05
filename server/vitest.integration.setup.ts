import { afterAll, afterEach } from "vitest";
import { describeUnreachableDatabase, resolveIntegrationDatabaseUrl } from "./src/__tests__/helpers/require-postgres.js";

const databaseUrl = resolveIntegrationDatabaseUrl();

const { disconnectPrisma, pingDatabase, resetBusinessTables } = await import(
  "./src/__tests__/helpers/lifecycle.js"
);

try {
  await pingDatabase();
} catch (error) {
  throw new Error(describeUnreachableDatabase(databaseUrl, error));
}

await resetBusinessTables();

afterEach(async () => {
  await resetBusinessTables();
});

afterAll(async () => {
  await disconnectPrisma();
});
