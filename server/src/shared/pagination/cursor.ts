import { AppError } from "../errors/AppError.js";

/** Maximum wire length for the opaque cursor query parameter. */
export const CURSOR_MAX_LENGTH = 512;

export type CreatedAtIdCursor = {
  createdAt: Date;
  id: string;
};

/**
 * Stable newest-first order for listing/product keyset pagination.
 * `id` is the tie-breaker when `createdAt` collides.
 */
export const createdAtIdDescOrderBy = [
  { createdAt: "desc" as const },
  { id: "desc" as const },
];

/**
 * Keyset predicate for `ORDER BY createdAt DESC, id DESC`.
 * Rows strictly older than the cursor (or same timestamp with a smaller id).
 */
export function createdAtIdKeysetWhere(cursor: CreatedAtIdCursor) {
  return {
    OR: [
      { createdAt: { lt: cursor.createdAt } },
      { AND: [{ createdAt: cursor.createdAt }, { id: { lt: cursor.id } }] },
    ],
  };
}

export function encodeCreatedAtIdCursor(keys: CreatedAtIdCursor): string {
  const payload = JSON.stringify({
    t: keys.createdAt.toISOString(),
    i: keys.id,
  });
  return Buffer.from(payload, "utf8").toString("base64url");
}

/**
 * Decode an opaque listing/product cursor.
 * The payload is `createdAt` + `id` only; extra keys and malformed values are 400.
 */
export function decodeCreatedAtIdCursor(raw: string): CreatedAtIdCursor {
  if (raw.length === 0 || raw.length > CURSOR_MAX_LENGTH) {
    throw new AppError(400, "Invalid cursor");
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(Buffer.from(raw, "base64url").toString("utf8"));
  } catch {
    throw new AppError(400, "Invalid cursor");
  }

  if (parsed === null || typeof parsed !== "object" || Array.isArray(parsed)) {
    throw new AppError(400, "Invalid cursor");
  }

  const record = parsed as Record<string, unknown>;
  const keys = Object.keys(record);
  if (keys.length !== 2 || !("t" in record) || !("i" in record)) {
    throw new AppError(400, "Invalid cursor");
  }

  const timestamp = record.t;
  const id = record.i;
  if (typeof timestamp !== "string" || typeof id !== "string" || id.length < 1 || id.length > 128) {
    throw new AppError(400, "Invalid cursor");
  }

  const createdAt = new Date(timestamp);
  if (Number.isNaN(createdAt.getTime()) || createdAt.toISOString() !== timestamp) {
    throw new AppError(400, "Invalid cursor");
  }

  return { createdAt, id };
}

export function nextCreatedAtIdCursor(
  items: ReadonlyArray<{ createdAt: Date; id: string }>,
  hasMore: boolean
): string | null {
  if (!hasMore || items.length === 0) return null;
  const last = items[items.length - 1];
  return encodeCreatedAtIdCursor({ createdAt: last.createdAt, id: last.id });
}
