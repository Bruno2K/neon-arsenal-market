import { logger } from "../logger.js";

/**
 * Sends the verification code to the user (e.g. by email).
 * In development we log the code to the console. In production you would integrate an email provider.
 */
export async function sendVerificationCode(email: string, code: string): Promise<void> {
  const isDev = process.env.NODE_ENV !== "production";
  if (isDev) {
    logger.info({ email, code }, "Verification code (dev only - would be sent by email in production)");
  }
  // TODO production: send email via SendGrid, Resend, SES, etc.
}
