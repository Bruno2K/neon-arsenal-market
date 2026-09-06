/**
 * Single storefront mapper: API status/code/known message → Portuguese copy.
 * Technical detail stays on the Error object (and optional DEV logs), never in UI.
 */

export const USER_FACING_NETWORK =
  "Não foi possível conectar. Verifique sua conexão e tente de novo.";

export const USER_FACING_LISTING_CONFLICT =
  "Este item acabou de ser reservado por outro comprador.";

export const USER_FACING_UNAUTHORIZED =
  "Sua sessão expirou. Entre novamente para continuar.";

export const USER_FACING_CREDENTIALS =
  "E-mail ou senha incorretos. Verifique os dados e tente de novo.";

export const USER_FACING_FORBIDDEN =
  "Você não tem permissão para acessar isto.";

export const USER_FACING_NOT_FOUND =
  "Não encontramos o que você procura. Volte ao Market e tente de novo.";

export const USER_FACING_CONFLICT =
  "Este recurso mudou. Recarregue a página e tente de novo.";

export const USER_FACING_REVIEW_EXISTS = "Você já avaliou este produto.";

export const USER_FACING_RATE_LIMIT =
  "Muitas tentativas. Espere um momento e tente de novo.";

export const USER_FACING_SERVER =
  "O serviço está indisponível. Tente de novo em instantes.";

export const USER_FACING_CS2SH_IMPORT_RUNNING =
  "A importação do catálogo cs2.sh já está em andamento";

export const USER_FACING_CS2SH_KEY_MISSING =
  "A chave da API cs2.sh não está configurada";

export const USER_FACING_VALIDATION =
  "Alguns dados estão inválidos. Confira os campos e tente de novo.";

export const USER_FACING_EMAIL_TAKEN =
  "Este e-mail já está em uso. Entre ou use outro e-mail.";

export const USER_FACING_VERIFICATION_CODE =
  "Código inválido ou expirado. Volte e solicite um novo código.";

export const USER_FACING_GENERIC =
  "Algo deu errado. Tente de novo em instantes.";

export const USER_FACING_PAYPAL_CLIENT_AUTH =
  "Não foi possível autenticar no PayPal sandbox. Confira PAYPAL_CLIENT_ID e PAYPAL_SECRET no servidor — não use o login da sua conta PayPal pessoal.";

export const USER_FACING_ORDER_CANCELLED =
  "Este pedido foi cancelado. Não é possível continuar o pagamento.";

export class ApiClientError extends Error {
  readonly status: number | undefined;
  readonly code: string | undefined;

  constructor(message: string, options?: { status?: number; code?: string }) {
    super(message);
    this.name = "ApiClientError";
    this.status = options?.status;
    this.code = options?.code;
  }
}

/** Typed HTTP failure from `api` (`res.ok === false` includes `status`). */
export class ApiError extends ApiClientError {
  constructor(message: string, options?: { status?: number; code?: string }) {
    super(message, options);
    this.name = "ApiError";
  }
}

const LISTING_STATUS_LABELS: Record<string, string> = {
  ACTIVE: "Disponível",
  RESERVED: "Reservado",
  SOLD: "Vendido",
  CANCELED: "Cancelado",
};

const ORDER_STATUS_LABELS: Record<string, string> = {
  PENDING: "Pendente",
  CONFIRMED: "Confirmado",
  SHIPPED: "Enviado",
  DELIVERED: "Entregue",
  CANCELLED: "Cancelado",
  CANCELED: "Cancelado",
};

const PAYMENT_STATUS_LABELS: Record<string, string> = {
  PENDING: "Pendente",
  PAID: "Pago",
  REFUNDED: "Reembolsado",
};

function technicalMessage(error: unknown): string {
  if (error instanceof Error) return error.message;
  if (typeof error === "string") return error;
  return "";
}

export function apiErrorStatus(error: unknown): number | undefined {
  if (error instanceof ApiClientError && typeof error.status === "number") {
    return error.status;
  }
  if (
    error &&
    typeof error === "object" &&
    "status" in error &&
    typeof (error as { status: unknown }).status === "number"
  ) {
    return (error as { status: number }).status;
  }
  return undefined;
}

export function isNetworkApiError(error: unknown): boolean {
  if (error instanceof ApiClientError && error.code === "NETWORK") return true;
  const status = apiErrorStatus(error);
  if (status === 0) return true;
  const message = technicalMessage(error);
  if (
    /failed to fetch|networkerror|could not reach api|load failed|network request failed|err_network|econnrefused|econnreset/i.test(
      message,
    )
  ) {
    return true;
  }
  return error instanceof TypeError && /fetch/i.test(message);
}

export function isUnauthorizedApiError(error: unknown): boolean {
  const status = apiErrorStatus(error);
  if (status === 401) return true;
  return /unauthorized|session expired|no refresh token|token has been revoked|please log in/i.test(
    technicalMessage(error),
  );
}

export function isForbiddenApiError(error: unknown): boolean {
  const status = apiErrorStatus(error);
  if (status === 403) return true;
  return /forbidden|not your order|acesso negado/i.test(
    technicalMessage(error),
  );
}

export function isNotFoundApiError(error: unknown): boolean {
  const status = apiErrorStatus(error);
  if (status === 404) return true;
  return /not found|record not found/i.test(technicalMessage(error));
}

export function isRetryableReadError(error: unknown): boolean {
  if (isNetworkApiError(error)) return true;
  const status = apiErrorStatus(error);
  if (status === 429) return true;
  if (status != null && status >= 500) return true;
  return (
    status == null && !isForbiddenApiError(error) && !isNotFoundApiError(error)
  );
}

export function isAlreadyReviewedApiError(error: unknown): boolean {
  const status = apiErrorStatus(error);
  const message = technicalMessage(error);
  return (
    (status === 409 || status == null) &&
    /already reviewed|já avaliou/i.test(message)
  );
}

function isListingConflict(error: unknown): boolean {
  const status = apiErrorStatus(error);
  const message = technicalMessage(error);
  if (
    /already reserved|not available \(status:|listing .+ is not available|no longer reserved|reservation expired/i.test(
      message,
    )
  ) {
    return true;
  }
  return status === 409 && /listing|reserv/i.test(message);
}

function leaksTechnicalDetail(copy: string): boolean {
  return /localhost|127\.0\.0\.1|https?:\/\/|failed to fetch|could not reach api/i.test(
    copy,
  );
}

export function userFacingApiError(error: unknown): string {
  const message = technicalMessage(error);
  const status = apiErrorStatus(error);

  let copy = USER_FACING_GENERIC;

  if (isNetworkApiError(error)) {
    copy = USER_FACING_NETWORK;
  } else if (isListingConflict(error)) {
    copy = USER_FACING_LISTING_CONFLICT;
  } else if (isAlreadyReviewedApiError(error)) {
    copy = USER_FACING_REVIEW_EXISTS;
  } else if (
    status === 409 &&
    /email already|already registered|already exists/i.test(message)
  ) {
    copy = USER_FACING_EMAIL_TAKEN;
  } else if (
    /invalid email or password|invalid credentials|invalid password/i.test(
      message,
    )
  ) {
    copy = USER_FACING_CREDENTIALS;
  } else if (
    /invalid verification code|verification code expired|no pending registration|invalid or expired code/i.test(
      message,
    )
  ) {
    copy = USER_FACING_VERIFICATION_CODE;
  } else if (/order is cancelled|order.*cancelled/i.test(message)) {
    copy = USER_FACING_ORDER_CANCELLED;
  } else if (
    /importação do catálogo cs2\.sh já está em andamento/i.test(message)
  ) {
    copy = USER_FACING_CS2SH_IMPORT_RUNNING;
  } else if (/chave da API cs2\.sh não está configurada/i.test(message)) {
    copy = USER_FACING_CS2SH_KEY_MISSING;
  } else if (/PayPal client authentication failed/i.test(message)) {
    copy = USER_FACING_PAYPAL_CLIENT_AUTH;
  } else if (isUnauthorizedApiError(error)) {
    copy = USER_FACING_UNAUTHORIZED;
  } else if (isForbiddenApiError(error)) {
    copy = USER_FACING_FORBIDDEN;
  } else if (isNotFoundApiError(error)) {
    copy = USER_FACING_NOT_FOUND;
  } else if (status === 409) {
    copy = USER_FACING_CONFLICT;
  } else if (status === 429) {
    copy = USER_FACING_RATE_LIMIT;
  } else if (status != null && status >= 500) {
    copy = USER_FACING_SERVER;
  } else if (
    status === 400 ||
    /invalid|validation|required|must be/i.test(message)
  ) {
    copy = USER_FACING_VALIDATION;
  }

  return leaksTechnicalDetail(copy) ? USER_FACING_GENERIC : copy;
}

/** Page-facing mapper — callers should not parse `Failed to fetch` themselves. */
export const toUserMessage = userFacingApiError;

export function logTechnicalError(error: unknown): void {
  if (import.meta.env.DEV) {
    console.error(error);
  }
}

export function listingStatusLabel(status: string): string {
  return LISTING_STATUS_LABELS[status] ?? "Indefinido";
}

export function orderStatusLabel(status: string): string {
  return ORDER_STATUS_LABELS[status] ?? "Indefinido";
}

export function paymentStatusLabel(status: string): string {
  return PAYMENT_STATUS_LABELS[status] ?? "Indefinido";
}
