/**
 * Display helpers for seller-ledger decimals.
 * Arithmetic must not use JavaScript `number` (INV-SELLER-COMMISSION-DECIMAL).
 * The API already computed the figure; we only format the wire string.
 */

function asTrimmedString(
  value: string | number | null | undefined,
): string | null {
  if (value == null) return null;
  const raw = typeof value === "number" ? String(value) : value.trim();
  return raw === "" ? null : raw;
}

function isDecimalLiteral(value: string): boolean {
  return /^-?(?:\d+\.?\d*|\.\d+)$/.test(value);
}

function stripLeadingZeros(digits: string): string {
  const stripped = digits.replace(/^0+/, "");
  return stripped === "" ? "0" : stripped;
}

function stripTrailingZeros(digits: string): string {
  return digits.replace(/0+$/, "");
}

/** Move the decimal point two places right (× 100) with string ops only. */
export function scaleDecimalStringBy100(raw: string): string {
  const trimmed = raw.trim();
  const negative = trimmed.startsWith("-");
  const unsigned = negative ? trimmed.slice(1) : trimmed;
  if (unsigned === "" || unsigned === ".") return "0";

  const [intRaw, fracRaw = ""] = unsigned.split(".");
  const intPart = intRaw === "" ? "0" : intRaw;
  const shiftedInt = stripLeadingZeros(
    intPart + fracRaw.slice(0, 2).padEnd(2, "0"),
  );
  const shiftedFrac = stripTrailingZeros(fracRaw.slice(2));
  const result =
    shiftedFrac === "" ? shiftedInt : `${shiftedInt}.${shiftedFrac}`;
  return negative && result !== "0" ? `-${result}` : result;
}

/** Prefix the API decimal with `$`. Does not round, sum, or coerce through `Number`. */
export function formatLedgerAmount(
  value: string | number | null | undefined,
): string {
  const raw = asTrimmedString(value);
  if (raw == null) return "—";
  return `$${raw}`;
}

/**
 * Seller.commissionRate is a fraction (`"0.1"` = 10%).
 * Missing/invalid values render as em dash — do not invent a default rate.
 */
export function formatCommissionRate(
  rate: string | number | null | undefined,
): string {
  const raw = asTrimmedString(rate);
  if (raw == null || !isDecimalLiteral(raw)) return "—";
  return `${scaleDecimalStringBy100(raw)}%`;
}
