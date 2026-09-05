import {
  EXPIRED_HOLD_COPY,
  PRE_ORDER_HOLD_COPY,
  VERIFYING_RESERVATION_COPY,
  formatReservationCountdown,
  reservationLiveAnnouncement,
} from "@/lib/orderPaymentView";

export type ReservationHoldPhase = "pre-order" | "order";

export function ReservationHold({
  phase,
  expiresAt = null,
  now = Date.now(),
  isLoading = false,
}: {
  phase: ReservationHoldPhase;
  expiresAt?: number | null;
  now?: number;
  isLoading?: boolean;
}) {
  if (isLoading) {
    return (
      <div
        className="rounded-md border border-border bg-card p-4"
        role="status"
      >
        <p className="text-sm text-muted-foreground">
          {VERIFYING_RESERVATION_COPY}
        </p>
      </div>
    );
  }

  if (phase === "pre-order") {
    return (
      <div className="rounded-md border border-border bg-card p-4">
        <p className="text-sm text-muted-foreground">{PRE_ORDER_HOLD_COPY}</p>
        <p className="mt-1 text-xs text-muted-foreground">
          Cada listing é único. Adicionar ao carrinho não segura o item.
        </p>
      </div>
    );
  }

  if (expiresAt == null) {
    return null;
  }

  const expired = expiresAt <= now;
  const countdown = formatReservationCountdown(expiresAt, now);
  const liveText = reservationLiveAnnouncement(expiresAt, now);

  return (
    <div className="rounded-md border border-border bg-card p-4">
      {expired ? (
        <p className="text-sm text-foreground">{EXPIRED_HOLD_COPY}</p>
      ) : (
        <p className="text-sm text-foreground">
          Reservado para você ·{" "}
          <span className="tabular-nums">{countdown}</span> restantes
        </p>
      )}
      {liveText ? (
        <p className="sr-only" aria-live="polite" aria-atomic="true">
          {liveText}
        </p>
      ) : null}
    </div>
  );
}
