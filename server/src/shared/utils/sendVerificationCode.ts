import { logger } from "../logger.js";
import { AppError } from "../errors/AppError.js";
import {
  getEmailApiTimeoutMs,
  getEmailFrom,
  getResendApiKey,
  isVerificationEmailConfigured,
} from "../config/email.js";
import {
  classifyHttpStatus,
  DEFAULT_RETRY_BASE_DELAY_MS,
  DEFAULT_RETRY_MAX_ATTEMPTS,
  isTimeoutError,
  withRetry,
} from "../resilience/retry.js";

export const EMAIL_HTTP_POLICY = {
  verification_send: {
    retry: true,
    maxAttempts: DEFAULT_RETRY_MAX_ATTEMPTS,
    baseDelayMs: DEFAULT_RETRY_BASE_DELAY_MS,
    reason: "Resend 5xx/429/timeout may be retried; 4xx is not. A timeout after accept can duplicate the same code.",
  },
} as const;

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

  try {
    await withRetry(
      async () => {
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
          if (isTimeoutError(err)) {
            throw new AppError(504, "Verification email request timed out");
          }
          logger.warn({ err }, "verification email request failed");
          throw Object.assign(new AppError(502, "Failed to send verification email"), {
            retryable: true,
            reason: "network" as const,
          });
        }

        if (!response.ok) {
          const classified = classifyHttpStatus(response.status);
          logger.warn({ statusCode: response.status }, "verification email provider rejected request");
          throw Object.assign(new AppError(502, "Failed to send verification email"), classified);
        }
      },
      {
        maxAttempts: EMAIL_HTTP_POLICY.verification_send.maxAttempts,
        baseDelayMs: EMAIL_HTTP_POLICY.verification_send.baseDelayMs,
        onRetry: ({ attempt, reason }) => {
          logger.warn({ attempt, reason }, "verification email retrying");
        },
      }
    );
  } catch (err) {
    if (isTimeoutError(err)) {
      throw new AppError(504, "Verification email request timed out");
    }
    throw err;
  }
}

export function assertVerificationEmailDeliveryConfigured(): void {
  if (process.env.NODE_ENV === "production" && !isVerificationEmailConfigured()) {
    throw new AppError(503, "Email verification is not configured");
  }
}
