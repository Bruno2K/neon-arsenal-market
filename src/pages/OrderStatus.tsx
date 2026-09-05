import { useEffect, useState } from "react";
import { Link, useLocation, useParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { getOrder } from "@/api/orders";
import { createPaymentLink } from "@/api/payments";
import { ErrorState, PageSkeleton } from "@/components/page-state";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  canRetryPayment,
  earliestReservationExpiresAt,
  formatReservationCountdown,
  isOrderAccessError,
  isPaymentConfirmed,
  isReservationExpired,
  orderItemLabel,
  orderPageIntent,
  orderPollIntervalMs,
  orderTotalAmount,
} from "@/lib/orderPaymentView";
import { paypalCheckoutUrls } from "@/lib/paypalCheckoutUrls";
import type { Order } from "@/types/api";

function OrderHeadline({
  order,
  intent,
  countdown,
}: {
  order: Order;
  intent: ReturnType<typeof orderPageIntent>;
  countdown: string | null;
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

  if (intent === "cancel") {
    const expired = isReservationExpired(order);
    return (
      <>
        <h1 className="text-2xl font-semibold tracking-tight">
          Você cancelou o pagamento.
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {expired
            ? "A reserva deste pedido já expirou. O pagamento continua pendente até o PayPal confirmar — esta tela não marca o pedido como pago."
            : countdown
              ? `Sua reserva expira em ${countdown}. O pedido ainda está pendente.`
              : "O pedido ainda está pendente. A reserva pode expirar se o pagamento não for concluído."}
        </p>
      </>
    );
  }

  if (isReservationExpired(order)) {
    return (
      <>
        <h1 className="text-2xl font-semibold tracking-tight">
          Reserva expirada.
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          O pagamento não foi confirmado pelo PayPal. Esta página não marca o
          pedido como pago.
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
        A confirmação real vem do PayPal (webhook/reconciliação). Nada nesta
        tela afirma que o pagamento já foi confirmado.
      </p>
    </>
  );
}

export default function OrderStatusPage() {
  const { id } = useParams<{ id: string }>();
  const location = useLocation();
  const intent = orderPageIntent(location.pathname);
  const [now, setNow] = useState(() => Date.now());
  const [retrying, setRetrying] = useState(false);
  const [retryError, setRetryError] = useState<string | null>(null);

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
    retry: (failureCount, queryError) =>
      !isOrderAccessError(queryError) && failureCount < 1,
    refetchInterval: (query) => orderPollIntervalMs(query.state.data, intent),
  });

  const expiresAt = order ? earliestReservationExpiresAt(order) : null;

  useEffect(() => {
    if (expiresAt == null) return;
    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, [expiresAt]);

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
    return <PageSkeleton label="Carregando pedido" />;
  }

  if (isError || !order) {
    const accessError = isOrderAccessError(error);
    return (
      <div className="container py-8">
        <ErrorState
          title={
            accessError ? "Pedido não encontrado" : "Erro ao carregar o pedido"
          }
          description={
            accessError
              ? "Este pedido não existe ou não pertence à sua conta."
              : error instanceof Error
                ? error.message
                : "Falha de rede. Tente novamente."
          }
          action={
            accessError ? (
              <Button asChild>
                <Link to="/products">Ir ao Market</Link>
              </Button>
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
  const countdown = formatReservationCountdown(expiresAt, now);
  const expired = isReservationExpired(order, now);

  const handleRetry = async () => {
    if (!retryEnabled || retrying) return;
    setRetrying(true);
    setRetryError(null);
    try {
      const payment = await createPaymentLink({
        orderId: order.id,
        ...paypalCheckoutUrls(order.id),
      });
      if (payment.approvalUrl) {
        window.location.assign(payment.approvalUrl);
        return;
      }
      setRetryError(
        "Não foi possível obter o link do PayPal. O pedido existente não foi marcado como pago.",
      );
    } catch (e) {
      setRetryError(
        e instanceof Error
          ? e.message
          : "Não foi possível reutilizar este pedido para um novo pagamento.",
      );
    } finally {
      setRetrying(false);
    }
  };

  return (
    <div className="container max-w-2xl py-8">
      <div className="mb-8">
        <OrderHeadline order={order} intent={intent} countdown={countdown} />
      </div>

      <section className="space-y-4 rounded-md border border-border bg-card p-4">
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant="secondary">Pedido {order.status}</Badge>
          <Badge variant={paid ? "default" : "outline"}>
            Pagamento {order.paymentStatus}
          </Badge>
        </div>

        <ul className="space-y-2">
          {(order.items ?? []).map((item) => (
            <li key={item.id} className="flex justify-between gap-4 text-sm">
              <span className="min-w-0 truncate text-foreground">
                {orderItemLabel(item)}
              </span>
              <span className="shrink-0 tabular-price text-muted-foreground">
                ${Number(item.priceSnapshot).toFixed(2)}
              </span>
            </li>
          ))}
        </ul>

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
                ? "A reserva expirou. Não é possível pagar novamente neste pedido."
                : "Pagar novamente só fica disponível enquanto o pagamento estiver pendente."}
          </p>
        ) : null}
        <div className="flex flex-col gap-3 sm:flex-row">
          {intent !== "view" ? (
            <Button asChild variant={paid ? "default" : "outline"}>
              <Link to={`/orders/${order.id}`}>Ver pedido</Link>
            </Button>
          ) : null}
          {retryEnabled ? (
            <Button
              type="button"
              onClick={() => void handleRetry()}
              disabled={retrying}
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
