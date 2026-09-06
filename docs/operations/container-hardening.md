# Production container hardening

Issue #68. Live compute is **Render** (`render.yaml`, ADR 0007). This is not AWS/ECS.

The API image is `server/Dockerfile` (context `server/`). Start sequence is unchanged: `entrypoint.sh` → `prisma migrate deploy` → optional seed → `exec node dist/index.js` on `0.0.0.0:$PORT`. Do not invent env vars.

## What the image already does

| Control | Where |
|---|---|
| Multi-stage build | `builder` compiles TypeScript + Prisma client; `production` is the runtime |
| Minimal runtime | `node:20-alpine`; compile toolchain (`python3`, `make`, `g++`) is removed after `npm ci` |
| Non-root | `USER expressjs` (uid 1001) |
| Healthcheck | Docker `HEALTHCHECK` → `GET /health` (liveness). Render `healthCheckPath: /ready` |
| SIGTERM / graceful shutdown | App already drains HTTP 10s, stops jobs, disconnects Prisma (ADR 0005). `exec` in the entrypoint so the signal reaches Node. Blueprint `maxShutdownDelaySeconds: 30` |
| Resource limits | Compose `mem_limit` / `cpus` below. Render instance RAM/CPU is the **service plan**, not a Docker flag. Do not add a paid plan in the Blueprint to “look hardened.” |

## Read-only root filesystem

Node and Prisma only need a writable `/tmp` after the image is built. Local Compose sets `read_only: true` plus `tmpfs: /tmp`.

Render’s Blueprint schema does **not** expose a read-only root option for Docker web services. Production on Render keeps a writable container filesystem (ephemeral; lost on every deploy/restart). That is a platform limit, not a reason to add a volume or Redis.

## Resource limits (local / documented)

`docker-compose.yml` `api` service:

- `mem_limit: 512m` — same order as a Render free/starter web instance
- `cpus: "1.0"`
- `read_only: true` + `tmpfs: /tmp`

Scale-out on Render is **more API instances**, bounded by PostgreSQL connections (`docs/architecture/capacity.md`). Not Redis, not a worker service.

## Vulnerability scan (Trivy)

CI job `Security (Trivy filesystem)` in `.github/workflows/ci.yml` runs Trivy against `server/` (Dockerfile + lockfile; no image registry). It **reports** CRITICAL/HIGH and does not fail the pipeline — the same policy as `npm audit` (`docs/operations/ci-protection.md`). Base-image CVEs are expected on `node:20-alpine` and are not a reason to invent ECR/GHCR.

Local commands (not required in CI):

```bash
# Filesystem / lockfile (same scope as CI)
docker run --rm -v "$PWD:/src" aquasec/trivy:latest fs --severity HIGH,CRITICAL /src/server

# Built image, after `docker compose build api`
docker run --rm -v /var/run/docker.sock:/var/run/docker.sock \
  aquasec/trivy:latest image neon-arsenal-api:latest
```

There is no container registry in this repository. Render builds the image at deploy time.
