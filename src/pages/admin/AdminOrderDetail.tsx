import { Link, useLocation, useParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { getOrder } from "@/api/orders";
import { EmptyState, ErrorState } from "@/components/page-state";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { isOrderAccessError, orderItemLabel } from "@/lib/orderPaymentView";
import { orderStatusLabel, paymentStatusLabel } from "@/lib/userFacingApiError";

function formatMoney(value: number): string {
  return `R$ ${Number(value).toFixed(2)}`;
}

export default function AdminOrderDetail() {
  const { id } = useParams<{ id: string }>();
  const location = useLocation();
  const listHref = {
    pathname: "/admin/orders",
    search: location.search,
  };

  const {
    data: order,
    isLoading,
    isError,
    error,
    refetch,
  } = useQuery({
    queryKey: ["admin-order", id],
    queryFn: () => getOrder(id!),
    enabled: Boolean(id),
    retry: false,
  });

  if (!id) {
    return (
      <EmptyState
        title="Pedido não encontrado"
        description="O identificador do pedido é inválido."
        action={
          <Button asChild variant="outline">
            <Link to={listHref}>Voltar aos pedidos</Link>
          </Button>
        }
      />
    );
  }

  if (isLoading) {
    return (
      <div className="space-y-4" role="status" aria-label="Carregando">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-4 w-72 max-w-full" />
        <Skeleton className="h-40 w-full" />
      </div>
    );
  }

  if (isError || !order) {
    const missing = isOrderAccessError(error);
    return (
      <ErrorState
        title={missing ? "Pedido não encontrado" : "Erro ao carregar o pedido"}
        error={error}
        description={
          missing ? "Este pedido não existe ou não está disponível." : undefined
        }
        action={
          missing ? (
            <Button asChild variant="outline">
              <Link to={listHref}>Voltar aos pedidos</Link>
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
    );
  }

  const items = order.items ?? [];
  const customerName = order.customer?.name?.trim();
  const customerEmail = order.customer?.email?.trim();
  const trackingCode = order.trackingCode?.trim();
  const trackingCarrier = order.trackingCarrier?.trim();
  const paypalOrderId = order.paypalOrderId?.trim();

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">
            Pedido #{order.id.slice(0, 8)}
          </h1>
          <p className="mt-1 font-mono text-xs text-muted-foreground">
            {order.id}
          </p>
        </div>
        <Button asChild variant="outline" size="sm">
          <Link to={listHref}>Voltar aos pedidos</Link>
        </Button>
      </div>

      <dl className="grid gap-3 sm:grid-cols-2">
        <div className="rounded-md border border-border bg-card p-4">
          <dt className="text-xs text-muted-foreground">Status</dt>
          <dd className="mt-2">
            <Badge variant="secondary">{orderStatusLabel(order.status)}</Badge>
          </dd>
        </div>
        <div className="rounded-md border border-border bg-card p-4">
          <dt className="text-xs text-muted-foreground">Pagamento</dt>
          <dd className="mt-2">
            <Badge variant="outline">
              {paymentStatusLabel(order.paymentStatus)}
            </Badge>
          </dd>
        </div>
        <div className="rounded-md border border-border bg-card p-4">
          <dt className="text-xs text-muted-foreground">Total</dt>
          <dd className="mt-2 tabular-nums text-lg font-semibold">
            {formatMoney(order.totalAmount)}
          </dd>
        </div>
        <div className="rounded-md border border-border bg-card p-4">
          <dt className="text-xs text-muted-foreground">Cliente</dt>
          <dd className="mt-2 text-sm">
            {customerName || customerEmail || "—"}
            {customerName && customerEmail ? (
              <p className="mt-1 text-xs text-muted-foreground">
                {customerEmail}
              </p>
            ) : null}
          </dd>
        </div>
        <div className="rounded-md border border-border bg-card p-4">
          <dt className="text-xs text-muted-foreground">Rastreio</dt>
          <dd className="mt-2 text-sm">
            {trackingCode || trackingCarrier
              ? [trackingCarrier, trackingCode].filter(Boolean).join(" · ")
              : "Sem rastreio"}
          </dd>
        </div>
        {paypalOrderId ? (
          <div className="rounded-md border border-border bg-card p-4">
            <dt className="text-xs text-muted-foreground">PayPal order ID</dt>
            <dd className="mt-2 font-mono text-sm">{paypalOrderId}</dd>
          </div>
        ) : null}
      </dl>

      <section>
        <h2 className="text-sm font-semibold tracking-tight">Itens</h2>
        {items.length === 0 ? (
          <p className="mt-2 text-sm text-muted-foreground">
            Este pedido não tem itens.
          </p>
        ) : (
          <ul className="mt-3 space-y-2">
            {items.map((item) => (
              <li
                key={item.id}
                className="flex items-center justify-between gap-4 rounded-md border border-border bg-card p-4"
              >
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium">
                    {orderItemLabel(item)}
                  </p>
                  {item.seller?.storeName ? (
                    <p className="mt-1 text-xs text-muted-foreground">
                      {item.seller.storeName}
                    </p>
                  ) : null}
                </div>
                <p className="tabular-nums text-sm font-semibold">
                  {formatMoney(item.priceSnapshot)}
                </p>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
