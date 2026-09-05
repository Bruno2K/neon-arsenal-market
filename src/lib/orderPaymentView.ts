import type { Order } from "@/types/api";

export type OrderPageIntent = "return" | "cancel" | "view";

export const ORDER_POLL_INTERVAL_MS = 4000;

export const PRE_ORDER_HOLD_COPY =
  "O item só é reservado quando você inicia o pagamento.";

export const EXPIRED_HOLD_COPY =
  "A reserva expirou. O item pode ter voltado ao Market.";

export const VERIFYING_RESERVATION_COPY = "verificando reserva…";

export function orderPageIntent(pathname: string): OrderPageIntent {
  if (pathname.endsWith("/cancel")) return "cancel";
  if (pathname.endsWith("/return")) return "return";
  return "view";
}

export function isPaymentConfirmed(
  order: Pick<Order, "paymentStatus">,
): boolean {
  return order.paymentStatus === "PAID";
}

export function earliestReservationExpiresAt(
  order: Pick<Order, "items">,
): number | null {
  const timestamps =
    order.items
      ?.map((item) => item.listing?.reservationExpiresAt)
      .filter((value): value is string => Boolean(value))
      .map((value) => Date.parse(value))
      .filter((value) => Number.isFinite(value)) ?? [];
  if (timestamps.length === 0) return null;
  return Math.min(...timestamps);
}

export function isReservationExpired(
  order: Pick<Order, "items" | "paymentStatus">,
  now = Date.now(),
): boolean {
  if (isPaymentConfirmed(order)) return false;
  const expiresAt = earliestReservationExpiresAt(order);
  if (expiresAt != null) return expiresAt <= now;
  return false;
}

export function canRetryPayment(
  order: Pick<Order, "paymentStatus" | "status" | "items">,
  now = Date.now(),
): boolean {
  if (order.paymentStatus !== "PENDING") return false;
  if (order.status === "CANCELLED") return false;
  return !isReservationExpired(order, now);
}

export function remainingReservationSeconds(
  expiresAt: number | null,
  now = Date.now(),
): number | null {
  if (expiresAt == null) return null;
  return Math.max(0, Math.floor((expiresAt - now) / 1000));
}

export function formatReservationCountdown(
  expiresAt: number | null,
  now = Date.now(),
): string | null {
  const totalSec = remainingReservationSeconds(expiresAt, now);
  if (totalSec == null) return null;
  const minutes = Math.floor(totalSec / 60);
  const seconds = totalSec % 60;
  return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
}

/** Minute-granularity copy for aria-live="polite". Does not change every second. */
export function reservationLiveAnnouncement(
  expiresAt: number | null,
  now = Date.now(),
): string | null {
  const totalSec = remainingReservationSeconds(expiresAt, now);
  if (totalSec == null) return null;
  if (totalSec <= 0) return EXPIRED_HOLD_COPY;
  const minutes = Math.floor(totalSec / 60);
  if (minutes <= 0) {
    return "Reservado para você. Menos de um minuto restante.";
  }
  return `Reservado para você. ${minutes} ${
    minutes === 1 ? "minuto restante" : "minutos restantes"
  }.`;
}

export function orderPollIntervalMs(
  order: Order | undefined,
  intent: OrderPageIntent,
): number | false {
  if (!order) return false;
  if (intent === "cancel") return false;
  if (isPaymentConfirmed(order)) return false;
  if (order.status === "CANCELLED") return false;
  if (isReservationExpired(order)) return false;
  if (order.paymentStatus === "PENDING") return ORDER_POLL_INTERVAL_MS;
  return false;
}

export function isOrderAccessError(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error ?? "");
  return (
    /order not found/i.test(message) ||
    /not your order/i.test(message) ||
    /pedido não encontrado/i.test(message) ||
    /request failed: 403/i.test(message) ||
    /request failed: 404/i.test(message)
  );
}

export function orderItemLabel(item: {
  listing?: {
    product?: { weapon?: string; skinName?: string; exterior?: string };
  };
}): string {
  const product = item.listing?.product;
  if (!product?.weapon || !product.skinName) return "Item";
  const exterior = product.exterior ? ` (${product.exterior})` : "";
  return `${product.weapon} | ${product.skinName}${exterior}`;
}

export function orderTotalAmount(
  order: Pick<Order, "totalAmount" | "items">,
): number {
  if (order.totalAmount != null && Number(order.totalAmount) > 0) {
    return Number(order.totalAmount);
  }
  return (
    order.items?.reduce(
      (sum, item) => sum + Number(item.priceSnapshot || 0),
      0,
    ) ?? 0
  );
}
