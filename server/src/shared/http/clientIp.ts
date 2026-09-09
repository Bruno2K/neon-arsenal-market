import { isIP } from "node:net";
import type { Request } from "express";

export const RENDER_CLIENT_IP_HEADER = "cf-connecting-ip";

function parseSingleIp(value: string | undefined): string | null {
  if (value === undefined) return null;
  const candidate = value.trim();
  if (candidate.length === 0 || candidate.includes(",")) return null;
  return isIP(candidate) === 0 ? null : candidate;
}

/**
 * Resolve the caller only through a trust boundary the application can prove.
 * Render's Cloudflare edge overwrites CF-Connecting-IP and sets RENDER=true.
 * Direct/non-Render deployments intentionally ignore all forwarded headers.
 */
export function resolveClientIp(req: Request): string | null {
  const socketIp = parseSingleIp(req.socket.remoteAddress);
  if (process.env.RENDER !== "true") return socketIp;
  return parseSingleIp(req.get(RENDER_CLIENT_IP_HEADER)) ?? socketIp;
}
