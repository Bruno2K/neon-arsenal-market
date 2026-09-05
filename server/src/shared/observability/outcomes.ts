import { SpanStatusCode, type Span } from "@opentelemetry/api";
import { AppError } from "../errors/AppError.js";

export type BusinessOutcome =
  | "created"
  | "confirmed"
  | "already_confirmed"
  | "idempotency_replay"
  | "idempotency_conflict"
  | "reservation_conflict"
  | "reservation_expired"
  | "webhook_duplicate"
  | "webhook_ignored"
  | "webhook_failed"
  | "validation_error"
  | "not_found"
  | "timeout"
  | "provider_error"
  | "error";

export function isBusinessError(err: unknown) {
  return err instanceof AppError && err.statusCode < 500;
}

export function markSpanOutcome(span: Span, outcome: BusinessOutcome) {
  span.setAttribute("app.outcome", outcome);
  if (outcome === "error" || outcome === "timeout" || outcome === "provider_error") {
    span.setStatus({ code: SpanStatusCode.ERROR, message: outcome });
    return;
  }
  span.setStatus({ code: SpanStatusCode.UNSET });
}

export function classifyThrownError(err: unknown): BusinessOutcome {
  if (err instanceof AppError) {
    if (err.statusCode === 504) return "timeout";
    if (err.statusCode === 502) return "provider_error";
    if (err.statusCode === 409 && /idempotency/i.test(err.message)) return "idempotency_conflict";
    if (err.statusCode === 409 && /reserv/i.test(err.message)) return "reservation_expired";
    if (err.statusCode === 400 && /not available|not ACTIVE|trade locked/i.test(err.message)) {
      return "reservation_conflict";
    }
    if (err.statusCode === 404) return "not_found";
    if (err.statusCode < 500) return "validation_error";
  }
  return "error";
}
