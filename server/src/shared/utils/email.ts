// ─── EmailService ────────────────────────────────────────────────────────────
// In development (no SMTP_HOST env), logs emails to console.
// In production, wire a real transporter (nodemailer) here.
//
// Usage:
//   import { emailService } from '@/shared/utils/email.js';
//   await emailService.sendOrderConfirmation({ to, orderId, totalAmount });

type EmailPayload = {
  to: string;
  subject: string;
  text: string;
  html?: string;
};

// ─── Transport abstraction ────────────────────────────────────────────────────

async function sendEmail(payload: EmailPayload): Promise<void> {
  if (!process.env.SMTP_HOST) {
    // Development: pretty-print to console
    console.log("\n📧 [EmailService] ─────────────────────────────────");
    console.log(`   To      : ${payload.to}`);
    console.log(`   Subject : ${payload.subject}`);
    console.log(`   Body    :\n${payload.text.split("\n").map((l) => `             ${l}`).join("\n")}`);
    console.log("────────────────────────────────────────────────────\n");
    return;
  }

  // Production: requires nodemailer to be installed.
  // npm install nodemailer + @types/nodemailer, then uncomment:
  //
  // const nodemailer = await import("nodemailer");
  // const transporter = nodemailer.createTransport({
  //   host: process.env.SMTP_HOST,
  //   port: Number(process.env.SMTP_PORT ?? 587),
  //   secure: process.env.SMTP_SECURE === "true",
  //   auth: {
  //     user: process.env.SMTP_USER,
  //     pass: process.env.SMTP_PASS,
  //   },
  // });
  // await transporter.sendMail({
  //   from: process.env.SMTP_FROM ?? "noreply@neonarsenal.market",
  //   ...payload,
  // });

  console.warn("[EmailService] SMTP_HOST is set but nodemailer is not installed — email skipped.");
}

// ─── Typed helpers ───────────────────────────────────────────────────────────

export const emailService = {
  async sendOrderConfirmation({
    to,
    orderId,
    totalAmount,
  }: {
    to: string;
    orderId: string;
    totalAmount: number | string;
  }) {
    await sendEmail({
      to,
      subject: "✅ Pedido confirmado — Neon Arsenal Market",
      text: [
        `Olá!`,
        ``,
        `Seu pedido #${orderId.slice(0, 12)}… foi recebido com sucesso.`,
        `Total: $${Number(totalAmount).toFixed(2)}`,
        ``,
        `Você será notificado assim que seu pedido for enviado.`,
        ``,
        `Obrigado por comprar no Neon Arsenal Market! 🎯`,
      ].join("\n"),
    });
  },

  async sendOrderShipped({
    to,
    orderId,
  }: {
    to: string;
    orderId: string;
  }) {
    await sendEmail({
      to,
      subject: "🚚 Pedido enviado — Neon Arsenal Market",
      text: [
        `Olá!`,
        ``,
        `Boas notícias! Seu pedido #${orderId.slice(0, 12)}… foi enviado.`,
        ``,
        `Acompanhe o status em: neonarsenal.market/orders/${orderId}`,
        ``,
        `Obrigado pela sua compra! 🎮`,
      ].join("\n"),
    });
  },

  async sendSellerApproved({
    to,
    storeName,
    approved,
  }: {
    to: string;
    storeName: string;
    approved: boolean;
  }) {
    if (approved) {
      await sendEmail({
        to,
        subject: "🎉 Sua loja foi aprovada — Neon Arsenal Market",
        text: [
          `Olá!`,
          ``,
          `Sua loja "${storeName}" foi aprovada e está pronta para vender!`,
          ``,
          `Acesse seu dashboard: neonarsenal.market/seller`,
          ``,
          `Boas vendas! 💰`,
        ].join("\n"),
      });
    } else {
      await sendEmail({
        to,
        subject: "❌ Solicitação de vendedor não aprovada — Neon Arsenal Market",
        text: [
          `Olá!`,
          ``,
          `Infelizmente sua solicitação para a loja "${storeName}" não foi aprovada.`,
          ``,
          `Entre em contato conosco para mais informações.`,
        ].join("\n"),
      });
    }
  },

  async sendPasswordChanged({ to }: { to: string }) {
    await sendEmail({
      to,
      subject: "🔐 Senha alterada — Neon Arsenal Market",
      text: [
        `Olá!`,
        ``,
        `Sua senha foi alterada com sucesso.`,
        ``,
        `Se você não realizou essa alteração, entre em contato imediatamente.`,
      ].join("\n"),
    });
  },
};
