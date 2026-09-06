import bcrypt from "bcrypt";

const SALT_ROUNDS = 10;

/**
 * Precomputed bcrypt hash used when the email is unknown so failed login
 * spends comparable time to a real compare. Not a real account password.
 */
export const UNKNOWN_USER_PASSWORD_HASH =
  "$2b$10$qzDa2j7Dcyy/cnFL9vLB.uCXtSSX26AP6GA.bdkQVRQx0TW/R1E4y";

export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, SALT_ROUNDS);
}

export async function comparePassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash);
}
