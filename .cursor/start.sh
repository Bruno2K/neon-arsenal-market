#!/usr/bin/env bash
# Per-boot startup for Neon Arsenal Market: bring up the local PostgreSQL
# cluster and confirm readiness. Dependency install and seeding live in
# install.sh; this script only reconciles the per-boot database daemon.
set -euo pipefail

DB_USER="neon"
DB_PASSWORD="neon_local_password"
DB_NAME="neon_arsenal"

# Start the cluster if it is not already running (idempotent).
sudo pg_ctlcluster 16 main start 2>/dev/null || true

# Wait for readiness.
for _ in $(seq 1 30); do
  sudo -u postgres pg_isready -q && break
  sleep 1
done

# Ensure role + database exist (safe no-op when the snapshot already has them).
sudo -u postgres psql -v ON_ERROR_STOP=1 <<SQL || true
DO \$\$ BEGIN
  IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname='${DB_USER}') THEN
    CREATE ROLE ${DB_USER} LOGIN PASSWORD '${DB_PASSWORD}';
  END IF;
END \$\$;
SQL
sudo -u postgres psql -tc "SELECT 1 FROM pg_database WHERE datname='${DB_NAME}'" \
  | grep -q 1 || sudo -u postgres createdb -O "${DB_USER}" "${DB_NAME}"

echo "PostgreSQL is ready."
