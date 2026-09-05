import { logger } from "../logger.js";
import { AppError } from "../errors/AppError.js";
import {
  getEmailApiTimeoutMs,
  getEmailFrom,
  getResendApiKey,
  isVerificationEmailConfigured,
} from "../config/email.js";

/**
 * Sends the verification code to the user (e.g. by email).
 * In development we log the code to the console. In production we send it through Resend.
 */
export async function sendVerificationCode(email: string, code: string): Promise<void> {
  if (process.env.NODE_ENV !== "production") {
    logger.info({ email, code }, "Verification code (dev only - would be sent by email in production)");
    return;
  }

  assertVerificationEmailDeliveryConfigured();

  let response: Response;
  try {
    response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${getResendApiKey()}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: getEmailFrom(),
        to: [email],
        subject: "Seu código de verificação - SkinMarket",
        text: `Seu código de verificação é ${code}. Ele expira em 10 minutos.`,
      }),
      signal: AbortSignal.timeout(getEmailApiTimeoutMs()),
    });
  } catch (err) {
    if (err instanceof Error && (err.name === "AbortError" || err.name === "TimeoutError")) {
      throw new AppError(504, "Verification email request timed out");
    }
    logger.warn({ err }, "verification email request failed");
    throw new AppError(502, "Failed to send verification email");
  }

  if (!response.ok) {
    logger.warn({ statusCode: response.status }, "verification email provider rejected request");
    throw new AppError(502, "Failed to send verification email");
  }
}

export function assertVerificationEmailDeliveryConfigured(): void {
  if (process.env.NODE_ENV === "production" && !isVerificationEmailConfigured()) {
    throw new AppError(503, "Email verification is not configured");
  }
}
