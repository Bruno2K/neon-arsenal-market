import { useQuery } from "@tanstack/react-query";
import { listOrders } from "@/api/orders";
import { EmptyState, ErrorState } from "@/components/page-state";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
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
  const {
    data: orders = [],
    isLoading,
    isError,
    error,
    refetch,
  } = useQuery({
    queryKey: ["sellerOrders"],
    queryFn: () => listOrders(),
  });

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
        description={
          error instanceof Error
            ? error.message
            : "Tente novamente em instantes."
        }
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
                    <Badge variant="secondary">{order.status}</Badge>
                    {order.createdAt ? (
                      <span className="text-xs text-muted-foreground">
                        {new Date(order.createdAt).toLocaleDateString()}
                      </span>
                    ) : null}
                  </div>
                </div>
                <div className="text-left sm:text-right">
                  <p className="tabular-nums text-lg font-semibold">
                    ${orderTotal(order).toFixed(2)}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {order.items?.length ?? 0}{" "}
                    {(order.items?.length ?? 0) === 1 ? "item" : "itens"}
                  </p>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
