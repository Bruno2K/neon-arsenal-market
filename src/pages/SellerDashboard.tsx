import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { Package, ShoppingBag, DollarSign } from "lucide-react";
import { listOrders } from "@/api/orders";
import { getSellerListings } from "@/api/listings";
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

function orderSummary(order: Order): string {
  const names =
    order.items
      ?.slice(0, 2)
      .map((item) =>
        item.listing?.product
          ? `${item.listing.product.weapon} | ${item.listing.product.skinName}`
          : "Item",
      )
      .join(", ") ?? "—";
  const extra = order.items && order.items.length > 2 ? "…" : "";
  return `${names}${extra}`;
}

export default function SellerDashboard() {
  const listingsQuery = useQuery({
    queryKey: ["sellerListings"],
    queryFn: () => getSellerListings(),
  });
  const ordersQuery = useQuery({
    queryKey: ["orders"],
    queryFn: () => listOrders(),
  });

  const listings = listingsQuery.data?.items ?? [];
  const orders = ordersQuery.data ?? [];
  const isLoading = listingsQuery.isLoading || ordersQuery.isLoading;
  const isError = listingsQuery.isError || ordersQuery.isError;
  const error = listingsQuery.error ?? ordersQuery.error;

  const activeListings = listings.filter(
    (listing) => listing.status === "ACTIVE",
  ).length;
  const totalRevenue = orders.reduce(
    (sum, order) => sum + orderTotal(order),
    0,
  );

  if (isLoading) {
    return (
      <div className="space-y-6" role="status" aria-label="Carregando">
        <Skeleton className="h-8 w-48" />
        <div className="grid gap-3 sm:grid-cols-3">
          <Skeleton className="h-24 w-full" />
          <Skeleton className="h-24 w-full" />
          <Skeleton className="h-24 w-full" />
        </div>
      </div>
    );
  }

  if (isError) {
    return (
      <ErrorState
        title="Erro ao carregar o painel"
        description={
          error instanceof Error
            ? error.message
            : "Tente novamente em instantes."
        }
        action={
          <Button
            type="button"
            variant="outline"
            onClick={() => {
              void listingsQuery.refetch();
              void ordersQuery.refetch();
            }}
          >
            Tentar novamente
          </Button>
        }
      />
    );
  }

  const stats = [
    { label: "Listings ativos", value: String(activeListings), icon: Package },
    {
      label: "Receita",
      value: `$${totalRevenue.toFixed(2)}`,
      icon: DollarSign,
    },
    { label: "Pedidos", value: String(orders.length), icon: ShoppingBag },
  ];

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Visão geral</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Listings únicos, pedidos e receita da loja.
        </p>
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        {stats.map((stat) => (
          <div
            key={stat.label}
            className="rounded-md border border-border bg-card p-4"
          >
            <div className="flex items-center justify-between gap-3">
              <p className="text-xs text-muted-foreground">{stat.label}</p>
              <stat.icon className="h-4 w-4 text-muted-foreground" />
            </div>
            <p className="mt-2 tabular-nums text-2xl font-semibold tracking-tight">
              {stat.value}
            </p>
          </div>
        ))}
      </div>

      <section>
        <div className="mb-3 flex items-center justify-between gap-3">
          <h2 className="text-sm font-semibold tracking-tight">
            Pedidos recentes
          </h2>
          <Button asChild variant="outline" size="sm">
            <Link to="/seller/orders">Ver pedidos</Link>
          </Button>
        </div>
        {orders.length === 0 ? (
          <EmptyState
            title="Nenhum pedido"
            description="Quando houver vendas, elas aparecem aqui."
            action={
              <Button asChild>
                <Link to="/seller/listings">Ver listings</Link>
              </Button>
            }
          />
        ) : (
          <ul className="space-y-2">
            {orders.slice(0, 5).map((order) => (
              <li
                key={order.id}
                className="flex items-center justify-between gap-4 rounded-md border border-border bg-card p-4"
              >
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium">
                    {orderSummary(order)}
                  </p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    Pedido {order.id}
                  </p>
                </div>
                <div className="text-right">
                  <p className="tabular-nums text-sm font-semibold">
                    ${orderTotal(order).toFixed(2)}
                  </p>
                  <Badge variant="secondary" className="mt-1">
                    {order.status}
                  </Badge>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
