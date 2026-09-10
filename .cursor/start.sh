#!/usr/bin/env bash
# Per-boot startup for Neon Arsenal Market: bring up the local PostgreSQL
# cluster and confirm readiness. Dependency install and seeding live in
# install.sh; this script only reconciles the per-boot database daemon.
set -euo pipefail

DB_USER="neon"
DB_PASSWORD="neon_local_password"
DB_NAME="neon_arsenal"

# Start the cluster if it is not already running (idempotent).
if ! sudo -u postgres pg_isready -q; then
  sudo pg_ctlcluster 16 main start
fi

# Wait for readiness.
postgres_ready=false
for _ in $(seq 1 30); do
  if sudo -u postgres pg_isready -q; then
    postgres_ready=true
    break
  fi
  sleep 1
done
if [ "$postgres_ready" != true ]; then
  echo "PostgreSQL did not become ready within 30 seconds." >&2
  exit 1
fi

# Ensure role + database exist (safe no-op when the snapshot already has them).
sudo -u postgres psql -v ON_ERROR_STOP=1 <<SQL
DO \$\$ BEGIN
  IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname='${DB_USER}') THEN
    CREATE ROLE ${DB_USER} LOGIN PASSWORD '${DB_PASSWORD}';
  END IF;
END \$\$;
SQL
database_exists="$(sudo -u postgres psql -Atqc "SELECT 1 FROM pg_database WHERE datname='${DB_NAME}'")"
if [ "$database_exists" != 1 ]; then
  sudo -u postgres createdb -O "${DB_USER}" "${DB_NAME}"
fi

echo "PostgreSQL is ready."
