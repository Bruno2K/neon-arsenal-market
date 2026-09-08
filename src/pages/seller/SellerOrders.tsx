import { useState } from "react";
import { Link, Navigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { listOrders } from "@/api/orders";
import { useAuth } from "@/contexts/AuthContext";
import { EmptyState, ErrorState } from "@/components/page-state";
import { OrderTrackingDialog } from "@/components/seller/OrderTrackingDialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { orderStatusLabel } from "@/lib/userFacingApiError";
import type { Order } from "@/types/api";

function orderTotal(order: Order): number {
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

export default function SellerOrdersPage() {
  const { user } = useAuth();
  const isAdmin = user?.role === "ADMIN";
  const [trackingOrder, setTrackingOrder] = useState<Order | null>(null);
  const {
    data: orders = [],
    isLoading,
    isError,
    error,
    refetch,
  } = useQuery({
    queryKey: ["sellerOrders"],
    queryFn: () => listOrders(),
    enabled: user?.role === "SELLER",
  });

  if (isAdmin) {
    return <Navigate to="/admin" replace />;
  }

  if (isLoading) {
    return (
      <div className="space-y-3" role="status" aria-label="Carregando">
        <Skeleton className="h-8 w-32" />
        <Skeleton className="h-24 w-full" />
        <Skeleton className="h-24 w-full" />
      </div>
    );
  }

  if (isError) {
    return (
      <ErrorState
        title="Erro ao carregar pedidos"
        error={error}
        action={
          <Button type="button" variant="outline" onClick={() => refetch()}>
            Tentar novamente
          </Button>
        }
      />
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Pedidos</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Pedidos que incluem um listing da sua loja.
        </p>
      </div>

      {orders.length === 0 ? (
        <EmptyState
          title="Nenhum pedido"
          description="Quando um listing for vendido, o pedido aparece aqui."
          action={
            <Button asChild>
              <Link to="/seller/listings">Criar listing</Link>
            </Button>
          }
        />
      ) : (
        <ul className="space-y-2">
          {orders.map((order) => {
            const summary =
              order.items
                ?.slice(0, 2)
                .map((item) =>
                  item.listing?.product
                    ? `${item.listing.product.weapon} | ${item.listing.product.skinName}`
                    : "Item",
                )
                .join(", ") ?? "—";
            const extra = order.items && order.items.length > 2 ? "…" : "";

            return (
              <li
                key={order.id}
                className="flex flex-col justify-between gap-3 rounded-md border border-border bg-card p-4 sm:flex-row sm:items-center"
              >
                <div className="min-w-0">
                  <p className="text-sm font-medium">Pedido {order.id}</p>
                  <p className="mt-1 truncate text-sm text-muted-foreground">
                    {summary}
                    {extra}
                  </p>
                  <div className="mt-2 flex flex-wrap items-center gap-2">
                    <Badge variant="secondary">
                      {orderStatusLabel(order.status)}
                    </Badge>
                    {order.createdAt ? (
                      <span className="text-xs text-muted-foreground">
                        {new Date(order.createdAt).toLocaleDateString()}
                      </span>
                    ) : null}
                    {order.trackingCode ? (
                      <span className="text-xs text-muted-foreground">
                        {order.trackingCarrier
                          ? `${order.trackingCarrier} · `
                          : ""}
                        {order.trackingCode}
                      </span>
                    ) : null}
                  </div>
                </div>
                <div className="flex flex-col items-start gap-2 sm:items-end">
                  <p className="tabular-nums text-lg font-semibold">
                    R$ {orderTotal(order).toFixed(2)}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {order.items?.length ?? 0}{" "}
                    {(order.items?.length ?? 0) === 1 ? "item" : "itens"}
                  </p>
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    onClick={() => setTrackingOrder(order)}
                  >
                    Informar envio
                  </Button>
                </div>
              </li>
            );
          })}
        </ul>
      )}
      <OrderTrackingDialog
        key={trackingOrder?.id ?? "closed"}
        order={trackingOrder}
        open={trackingOrder != null}
        onOpenChange={(open) => {
          if (!open) setTrackingOrder(null);
        }}
      />
    </div>
  );
}
