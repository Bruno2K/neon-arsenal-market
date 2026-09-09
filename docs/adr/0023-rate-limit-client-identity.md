# ADR 0023 — Explicit client identity at the Render edge

## Status

Accepted

## Context

The API runs as a public Render web service behind Cloudflare and Render's load balancer. `trust proxy = true` lets the leftmost caller-controlled `X-Forwarded-For` value become `req.ip`, which allows an attacker to rotate limiter keys. Render provides `RENDER=true` and documents that its Cloudflare edge overwrites `CF-Connecting-IP` with the client address.

## Decision

Express does not trust `X-Forwarded-For`. A shared resolver uses one syntactically valid `CF-Connecting-IP` value only when `RENDER=true`; otherwise it uses the socket peer. Missing, invalid, or multi-valued Render headers fall back to the socket. Rate-limit keys pass through express-rate-limit's IPv6 subnet normalizer. Audit actors use the same resolver.

The in-memory store and existing thresholds remain unchanged. Cross-replica counters remain an accepted limitation under ADR 0018.

## Alternatives rejected

- `trust proxy = true`: caller-controlled and explicitly warned against by express-rate-limit.
- Numeric proxy hops: path length and `X-Forwarded-For` chain behavior are less explicit than Render's overwritten single-value header.
- Trust `CF-Connecting-IP` everywhere: directly reachable non-Render deployments could accept a forged value.
- Redis: no demonstrated scale-out requirement and outside this correction.

## Consequences

- Render receives per-client limiter and audit identities without trusting caller-selected forwarding chains.
- Non-Render deployments intentionally identify the socket peer unless a future ADR defines another trusted edge.
- Invalid edge metadata degrades to a shared proxy bucket rather than failing open.

## References

- `SPEC-0012`
- [Render default environment variables](https://render.com/docs/environment-variables)
- [Render DDoS and client-IP guidance](https://render.com/articles/how-render-handles-ddos-attacks)
- [Render edge-header guidance](https://render.com/articles/host-pocketbase-on-render#making-pocketbase-see-the-real-client-ip)
- [express-rate-limit proxy guidance](https://express-rate-limit.mintlify.app/guides/troubleshooting-proxy-issues)
- [express-rate-limit IPv6 helper](https://express-rate-limit.mintlify.app/reference/helpers)
