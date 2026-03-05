#!/bin/sh
# entrypoint.sh — run DB migrations then start the server
set -e

echo "⏳ Running database migrations..."
npx prisma migrate deploy

echo "✅ Migrations complete. Starting server..."
exec node dist/index.js
