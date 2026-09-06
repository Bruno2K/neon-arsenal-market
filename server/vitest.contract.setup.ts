/**
 * Contract tests hit the real Express app. Prisma is constructed at import time
 * but list/browse handlers are mocked so this suite does not need PostgreSQL.
 */
if (!process.env.DATABASE_URL || !process.env.DATABASE_URL.startsWith("postgres")) {
  process.env.DATABASE_URL = "postgresql://neon:contract@127.0.0.1:5432/neon_arsenal_contract";
}

if (!process.env.RATE_LIMIT_API_MAX) {
  process.env.RATE_LIMIT_API_MAX = "10000";
}
if (!process.env.RATE_LIMIT_AUTH_MAX) {
  process.env.RATE_LIMIT_AUTH_MAX = "10000";
}
