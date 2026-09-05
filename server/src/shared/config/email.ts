export const DEFAULT_EMAIL_API_TIMEOUT_MS = 10_000;

export function getEmailApiTimeoutMs(): number {
  const raw = process.env.EMAIL_API_TIMEOUT_MS;
  if (raw === undefined || raw === "") return DEFAULT_EMAIL_API_TIMEOUT_MS;
  const parsed = Number(raw);
  if (!Number.isFinite(parsed) || parsed <= 0) return DEFAULT_EMAIL_API_TIMEOUT_MS;
  return parsed;
}

export function getResendApiKey(): string {
  return process.env.RESEND_API_KEY?.trim() ?? "";
}

export function getEmailFrom(): string {
  return process.env.EMAIL_FROM?.trim() ?? "";
}

export function isVerificationEmailConfigured(): boolean {
  return getResendApiKey() !== "" && getEmailFrom() !== "";
}
