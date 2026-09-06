import { useEffect, useRef, useState } from "react";
import { Link, useLocation, useParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { getOrder } from "@/api/orders";
import { capturePayment, createPaymentLink } from "@/api/payments";
import { useAuth } from "@/contexts/AuthContext";
import { ErrorState, PageSkeleton } from "@/components/page-state";
import { ReservationHold } from "@/components/ReservationHold";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  EXPIRED_HOLD_COPY,
  PAYPAL_SANDBOX_LOGIN_COPY,
  VERIFYING_RESERVATION_COPY,
  canRetryPayment,
  earliestReservationExpiresAt,
  isOrderAccessError,
  isPaymentConfirmed,
  isReservationExpired,
  orderItemLabel,
  orderPageIntent,
  orderPollIntervalMs,
  orderTotalAmount,
} from "@/lib/orderPaymentView";
import { paypalCheckoutUrls } from "@/lib/paypalCheckoutUrls";
import { redirectToExternal } from "@/lib/redirect";
import {
  logTechnicalError,
  orderStatusLabel,
  paymentStatusLabel,
  userFacingApiError,
} from "@/lib/userFacingApiError";
import { track } from "@/lib/analytics";
import type { Order } from "@/types/api";

function OrderHeadline({
  order,
  intent,
  expired,
}: {
  order: Order;
  intent: ReturnType<typeof orderPageIntent>;
  expired: boolean;
}) {
  if (isPaymentConfirmed(order)) {
    return (
      <>
        <h1 className="text-2xl font-semibold tracking-tight">
          Pagamento confirmado.
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          O PayPal confirmou este pagamento. A confirmação local veio do
          webhook, não desta página.
        </p>
      </>
    );
  }

  if (expired) {
    return (
      <>
        <h1 className="text-2xl font-semibold tracking-tight">
          Reserva expirada.
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Não conclua o pagamento neste pedido. Esta tela não marca o pedido
          como pago.
        </p>
      </>
    );
  }

  if (intent === "cancel") {
    return (
      <>
        <h1 className="text-2xl font-semibold tracking-tight">
          Você cancelou o pagamento.
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          O pedido ainda está pendente. Esta tela não marca o pedido como pago.
        </p>
      </>
    );
  }

  return (
    <>
      <h1 className="text-2xl font-semibold tracking-tight">
        Pedido criado. Aguardando confirmação do PayPal.
      </h1>
      <p className="mt-1 text-sm text-muted-foreground">
        A confirmação real vem do PayPal depois da captura. Nada nesta tela
        afirma que o pagamento já foi confirmado.
      </p>
    </>
  );
}

export default function OrderStatusPage() {
  const { id } = useParams<{ id: string }>();
  const location = useLocation();
  const { user } = useAuth();
  const intent = orderPageIntent(location.pathname);
  const isCustomer = user?.role === "CUSTOMER";
  const [now, setNow] = useState(() => Date.now());
  const [retrying, setRetrying] = useState(false);
  const [retryError, setRetryError] = useState<string | null>(null);
  const captureAttemptedRef = useRef<string | null>(null);
  const analyticsKeyRef = useRef<string | null>(null);

  const {
    data: order,
    isLoading,
    isError,
    error,
    refetch,
  } = useQuery({
    queryKey: ["order", id],
    queryFn: () => getOrder(id!),
    enabled: Boolean(id),
    retry: false,
    refetchInterval: (query) => orderPollIntervalMs(query.state.data, intent),
  });

  const expiresAt = order ? earliestReservationExpiresAt(order) : null;

  useEffect(() => {
    if (expiresAt == null) return;
    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, [expiresAt]);

  useEffect(() => {
    if (!order) return;
    const key = `${order.id}:${intent}`;
    if (analyticsKeyRef.current === key) return;
    analyticsKeyRef.current = key;
    track("order_viewed", { orderId: order.id });
    if (intent === "return") {
      track("payment_return", { orderId: order.id });
    }
    if (intent === "cancel") {
      track("payment_cancel", { orderId: order.id });
    }
  }, [order, intent]);

  useEffect(() => {
    if (intent !== "return" || !order || !isCustomer) return;
    if (isPaymentConfirmed(order) || order.status === "CANCELLED") return;
    if (order.paymentStatus !== "PENDING") return;
    if (isReservationExpired(order)) return;
    if (captureAttemptedRef.current === order.id) return;
    captureAttemptedRef.current = order.id;
    void capturePayment({ orderId: order.id })
      .then(() => {
        void refetch();
      })
      .catch((error: unknown) => {
        logTechnicalError(error);
        setRetryError(userFacingApiError(error));
      });
  }, [intent, order, isCustomer, refetch]);

  if (!id) {
    return (
      <div className="container py-8">
        <ErrorState
          title="Pedido não encontrado"
          description="O identificador do pedido é inválido."
          action={
            <Button asChild>
              <Link to="/products">Ir ao Market</Link>
            </Button>
          }
        />
      </div>
    );
  }

  if (isLoading) {
    return <PageSkeleton label={VERIFYING_RESERVATION_COPY} />;
  }

  if (isError || !order) {
    const accessError = isOrderAccessError(error);
    return (
      <div className="container py-8">
        <ErrorState
          title={
            accessError ? "Pedido não encontrado" : "Erro ao carregar o pedido"
          }
          error={error}
          description={
            accessError
              ? "Este pedido não existe ou não pertence à sua conta."
              : undefined
          }
          action={
            accessError ? (
              <div className="flex flex-col items-center gap-3 sm:flex-row sm:justify-center">
                {isCustomer ? (
                  <Button asChild variant="outline">
                    <Link to="/account/orders">Voltar aos pedidos</Link>
                  </Button>
                ) : null}
                <Button asChild>
                  <Link to="/products">Ir ao Market</Link>
                </Button>
              </div>
            ) : (
              <Button
                type="button"
                variant="outline"
                onClick={() => void refetch()}
              >
                Tentar novamente
              </Button>
            )
          }
        />
      </div>
    );
  }

  const paid = isPaymentConfirmed(order);
  const retryEnabled = canRetryPayment(order, now);
  const expired = isReservationExpired(order, now);
  const showPayButton =
    !paid && order.status !== "CANCELLED" && order.paymentStatus === "PENDING";

  const handleRetry = async () => {
    if (!retryEnabled || retrying) return;
    setRetrying(true);
    setRetryError(null);
    try {
      track("payment_started", { orderId: order.id });
      const payment = await createPaymentLink({
        orderId: order.id,
        ...paypalCheckoutUrls(order.id),
      });
      if (payment.approvalUrl) {
        redirectToExternal(payment.approvalUrl);
        return;
      }
      setRetryError(
        "Não foi possível obter o link do PayPal. O pedido existente não foi marcado como pago.",
      );
    } catch (e) {
      logTechnicalError(e);
      setRetryError(userFacingApiError(e));
    } finally {
      setRetrying(false);
    }
  };

  const trackingCode = order.trackingCode?.trim();
  const trackingCarrier = order.trackingCarrier?.trim();

  return (
    <div className="container max-w-2xl py-8">
      {isCustomer ? (
        <p className="mb-4">
          <Link
            to="/account/orders"
            className="text-sm text-muted-foreground transition-colors hover:text-foreground"
          >
            Voltar aos pedidos
          </Link>
        </p>
      ) : null}
      <div className="mb-8 space-y-4">
        <OrderHeadline order={order} intent={intent} expired={expired} />
        {!paid ? (
          <ReservationHold phase="order" expiresAt={expiresAt} now={now} />
        ) : null}
      </div>

      <section className="space-y-4 rounded-md border border-border bg-card p-4">
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant="secondary">
            Pedido {orderStatusLabel(order.status)}
          </Badge>
          <Badge variant={paid ? "default" : "outline"}>
            Pagamento {paymentStatusLabel(order.paymentStatus)}
          </Badge>
        </div>

        <ul className="space-y-2">
          {(order.items ?? []).map((item) => (
            <li key={item.id} className="flex justify-between gap-4 text-sm">
              {item.listingId ? (
                <Link
                  to={`/listing/${item.listingId}`}
                  className="min-w-0 truncate text-foreground underline-offset-4 hover:underline"
                >
                  {orderItemLabel(item)}
                </Link>
              ) : (
                <span className="min-w-0 truncate text-foreground">
                  {orderItemLabel(item)}
                </span>
              )}
              <span className="shrink-0 tabular-price text-muted-foreground">
                ${Number(item.priceSnapshot).toFixed(2)}
              </span>
            </li>
          ))}
        </ul>

        {trackingCode || trackingCarrier ? (
          <dl className="space-y-1 border-t border-border pt-3 text-sm">
            {trackingCarrier ? (
              <div className="flex justify-between gap-4">
                <dt className="text-muted-foreground">Transportadora</dt>
                <dd className="text-foreground">{trackingCarrier}</dd>
              </div>
            ) : null}
            {trackingCode ? (
              <div className="flex justify-between gap-4">
                <dt className="text-muted-foreground">Rastreio</dt>
                <dd className="tabular-nums text-foreground">{trackingCode}</dd>
              </div>
            ) : null}
          </dl>
        ) : null}

        <dl className="space-y-1 border-t border-border pt-3 text-sm">
          <div className="flex justify-between pt-1 text-base font-medium text-foreground">
            <dt>Total</dt>
            <dd className="tabular-price">
              ${orderTotalAmount(order).toFixed(2)}
            </dd>
          </div>
        </dl>
      </section>

      <div className="mt-6 space-y-3">
        {showPayButton ? (
          <p className="text-sm text-muted-foreground">
            {PAYPAL_SANDBOX_LOGIN_COPY}
          </p>
        ) : null}
        {retryError ? (
          <p className="text-sm text-destructive" role="alert">
            {retryError}
          </p>
        ) : null}
        {!paid && !retryEnabled ? (
          <p className="text-sm text-muted-foreground">
            {order.status === "CANCELLED"
              ? "Este pedido foi cancelado. Não é possível reutilizar o mesmo pedido para pagar."
              : expired
                ? "O pagamento não deve ser concluído neste pedido."
                : "Pagar novamente só fica disponível enquanto o pagamento estiver pendente."}
          </p>
        ) : null}
        <div className="flex flex-col gap-3 sm:flex-row">
          {intent !== "view" ? (
            <Button asChild variant={paid ? "default" : "outline"}>
              <Link to={`/orders/${order.id}`}>Ver pedido</Link>
            </Button>
          ) : null}
          {showPayButton ? (
            <Button
              type="button"
              onClick={() => void handleRetry()}
              disabled={!retryEnabled || retrying}
              title={expired ? EXPIRED_HOLD_COPY : undefined}
            >
              {retrying ? "Abrindo o PayPal..." : "Pagar novamente"}
            </Button>
          ) : null}
          <Button asChild variant="outline">
            <Link to="/products">Ir ao Market</Link>
          </Button>
        </div>
      </div>
    </div>
  );
}
