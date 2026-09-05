#!/usr/bin/env bash
# Idempotent Cloud Agent install for Neon Arsenal Market.
# Prepares: PostgreSQL 16, local dev .env files, npm deps (root + server),
# Prisma client + migrations, server build, and seed data.
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$REPO_ROOT"

DB_USER="neon"
DB_PASSWORD="neon_local_password"
DB_NAME="neon_arsenal"
DATABASE_URL="postgresql://${DB_USER}:${DB_PASSWORD}@localhost:5432/${DB_NAME}"

# ─── 1. PostgreSQL (system package) ──────────────────────────────────────────
if ! command -v pg_ctlcluster >/dev/null 2>&1; then
  echo "==> Installing PostgreSQL 16"
  # archive.ubuntu.com is unreliable from Cloud Agent VMs; use a mirror that is
  # reachable and drop the unreachable security suite so apt-get update succeeds.
  sudo tee /etc/apt/sources.list.d/ubuntu.sources >/dev/null <<'EOF'
Types: deb
URIs: http://mirrors.edge.kernel.org/ubuntu/
Suites: noble noble-updates noble-backports
Components: main universe restricted multiverse
Signed-By: /usr/share/keyrings/ubuntu-archive-keyring.gpg
EOF
  sudo apt-get update -o Acquire::http::Timeout=30 -o Acquire::Retries=2
  sudo apt-get install -y --no-install-recommends postgresql postgresql-contrib
fi

# ─── 2. Start the local cluster (needed for migrate/seed below) ──────────────
sudo pg_ctlcluster 16 main start 2>/dev/null || true
for _ in $(seq 1 30); do
  sudo -u postgres pg_isready -q && break
  sleep 1
done

# ─── 3. Role + database (idempotent) ─────────────────────────────────────────
sudo -u postgres psql -v ON_ERROR_STOP=1 <<SQL
DO \$\$ BEGIN
  IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname='${DB_USER}') THEN
    CREATE ROLE ${DB_USER} LOGIN PASSWORD '${DB_PASSWORD}';
  END IF;
END \$\$;
ALTER ROLE ${DB_USER} CREATEDB;
SQL
sudo -u postgres psql -tc "SELECT 1 FROM pg_database WHERE datname='${DB_NAME}'" \
  | grep -q 1 || sudo -u postgres createdb -O "${DB_USER}" "${DB_NAME}"

# ─── 4. Local dev env files (gitignored; created if absent) ──────────────────
if [ ! -f server/.env ]; then
  echo "==> Writing server/.env"
  cat > server/.env <<EOF
DATABASE_URL="${DATABASE_URL}"
JWT_SECRET=local-dev-jwt-secret-change-me
JWT_REFRESH_SECRET=local-dev-refresh-secret-change-me
JWT_ACCESS_EXPIRES_IN=15m
JWT_REFRESH_EXPIRES_IN=7d
PAYPAL_CLIENT_ID=
PAYPAL_SECRET=
PAYPAL_MODE=sandbox
PAYPAL_WEBHOOK_ID=
PAYPAL_API_TIMEOUT_MS=10000
PORT=3001
NODE_ENV=development
FRONTEND_URL=http://localhost:5173
RESERVATION_TTL_MINUTES=15
EOF
fi
if [ ! -f .env ]; then
  echo "==> Writing .env (frontend)"
  cat > .env <<EOF
VITE_API_URL=http://localhost:3001
POSTGRES_USER=${DB_USER}
POSTGRES_PASSWORD=${DB_PASSWORD}
POSTGRES_DB=${DB_NAME}
EOF
fi

# ─── 5. Node dependencies ────────────────────────────────────────────────────
echo "==> Installing npm dependencies (root)"
npm install
echo "==> Installing npm dependencies (server)"
npm install --prefix server

# ─── 6. Prisma client, migrations, build, seed ───────────────────────────────
echo "==> Prisma generate + migrate deploy"
npm run db:generate --prefix server
npm run db:migrate:deploy --prefix server
echo "==> Building server (tsc) + seeding"
npm run build --prefix server
npm run db:seed --prefix server

echo "==> Install complete"
