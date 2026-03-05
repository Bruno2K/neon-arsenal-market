const CODE_LENGTH = 6;
const CODE_EXPIRES_MINUTES = 15;

export function generateVerificationCode(): string {
  const digits = "0123456789";
  let code = "";
  for (let i = 0; i < CODE_LENGTH; i++) {
    code += digits[Math.floor(Math.random() * digits.length)];
  }
  return code;
}

export function getVerificationExpiresAt(): Date {
  const d = new Date();
  d.setMinutes(d.getMinutes() + CODE_EXPIRES_MINUTES);
  return d;
}
