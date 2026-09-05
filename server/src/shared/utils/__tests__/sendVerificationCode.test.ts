import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../../logger.js", () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
  },
}));

describe("sendVerificationCode", () => {
  const originalNodeEnv = process.env.NODE_ENV;
  const originalResendApiKey = process.env.RESEND_API_KEY;
  const originalEmailFrom = process.env.EMAIL_FROM;
  const originalTimeout = process.env.EMAIL_API_TIMEOUT_MS;

  beforeEach(() => {
    vi.clearAllMocks();
    vi.unstubAllGlobals();
    process.env.NODE_ENV = "production";
    delete process.env.RESEND_API_KEY;
    delete process.env.EMAIL_FROM;
    delete process.env.EMAIL_API_TIMEOUT_MS;
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    if (originalNodeEnv === undefined) delete process.env.NODE_ENV;
    else process.env.NODE_ENV = originalNodeEnv;
    if (originalResendApiKey === undefined) delete process.env.RESEND_API_KEY;
    else process.env.RESEND_API_KEY = originalResendApiKey;
    if (originalEmailFrom === undefined) delete process.env.EMAIL_FROM;
    else process.env.EMAIL_FROM = originalEmailFrom;
    if (originalTimeout === undefined) delete process.env.EMAIL_API_TIMEOUT_MS;
    else process.env.EMAIL_API_TIMEOUT_MS = originalTimeout;
  });

  it("fails closed in production when email delivery is not configured", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    const { sendVerificationCode } = await import("../sendVerificationCode.js");

    await expect(sendVerificationCode("new@test.com", "123456")).rejects.toMatchObject({
      statusCode: 503,
      message: "Email verification is not configured",
    });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("sends production verification codes through Resend", async () => {
    process.env.RESEND_API_KEY = "resend-key";
    process.env.EMAIL_FROM = "SkinMarket <noreply@example.com>";
    process.env.EMAIL_API_TIMEOUT_MS = "2500";
    const fetchMock = vi.fn().mockResolvedValue(new Response("{}", { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);

    const { sendVerificationCode } = await import("../sendVerificationCode.js");

    await sendVerificationCode("new@test.com", "123456");

    expect(fetchMock).toHaveBeenCalledWith(
      "https://api.resend.com/emails",
      expect.objectContaining({
        method: "POST",
        headers: {
          Authorization: "Bearer resend-key",
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          from: "SkinMarket <noreply@example.com>",
          to: ["new@test.com"],
          subject: "Seu código de verificação - SkinMarket",
          text: "Seu código de verificação é 123456. Ele expira em 10 minutos.",
        }),
        signal: expect.any(AbortSignal),
      })
    );
  });

  it("maps provider failures to an operational error", async () => {
    process.env.RESEND_API_KEY = "resend-key";
    process.env.EMAIL_FROM = "SkinMarket <noreply@example.com>";
    const fetchMock = vi.fn().mockResolvedValue(new Response("bad request", { status: 400 }));
    vi.stubGlobal("fetch", fetchMock);

    const { sendVerificationCode } = await import("../sendVerificationCode.js");

    await expect(sendVerificationCode("new@test.com", "123456")).rejects.toMatchObject({
      statusCode: 502,
      message: "Failed to send verification email",
    });
    expect(fetchMock).toHaveBeenCalledOnce();
  });

  it("retries Resend HTTP 5xx then succeeds", async () => {
    process.env.RESEND_API_KEY = "resend-key";
    process.env.EMAIL_FROM = "SkinMarket <noreply@example.com>";
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(new Response("upstream", { status: 503 }))
      .mockResolvedValueOnce(new Response("{}", { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);

    const { sendVerificationCode } = await import("../sendVerificationCode.js");
    await sendVerificationCode("new@test.com", "123456");
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });
});
