#!/bin/sh
# entrypoint.sh — run DB migrations then start the server
set -e

echo "⏳ Running database migrations..."
npx prisma migrate deploy

if [ "${SEED_DEMO_DATA:-false}" = "true" ]; then
  echo "🌱 Seeding demo data..."
  npm run db:seed
fi

echo "✅ Migrations complete. Starting server..."
exec node dist/index.js
