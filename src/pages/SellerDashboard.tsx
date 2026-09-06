import { Link, Navigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { Package, Percent, Wallet } from "lucide-react";
import { listOrders } from "@/api/orders";
import { getSellerListings } from "@/api/listings";
import { getCommissionBalance } from "@/api/commissions";
import { getSellerMe } from "@/api/sellers";
import { useAuth } from "@/contexts/AuthContext";
import { EmptyState, ErrorState } from "@/components/page-state";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  formatCommissionRate,
  formatLedgerAmount,
} from "@/lib/formatLedgerAmount";
import { orderStatusLabel } from "@/lib/userFacingApiError";
import type { Order } from "@/types/api";

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
  const { user } = useAuth();
  const isAdmin = user?.role === "ADMIN";
  const sellerQueriesEnabled = !isAdmin;

  const listingsQuery = useQuery({
    queryKey: ["sellerListings"],
    queryFn: () => getSellerListings(),
    enabled: sellerQueriesEnabled,
  });
  const balanceQuery = useQuery({
    queryKey: ["commissionBalance"],
    queryFn: () => getCommissionBalance(),
    enabled: sellerQueriesEnabled,
  });
  const sellerMeQuery = useQuery({
    queryKey: ["sellerMe"],
    queryFn: () => getSellerMe(),
    enabled: sellerQueriesEnabled,
  });
  const ordersQuery = useQuery({
    queryKey: ["orders"],
    queryFn: () => listOrders(),
    enabled: sellerQueriesEnabled,
  });

  const listings = listingsQuery.data?.items ?? [];
  const orders = ordersQuery.data ?? [];
  const isLoading =
    listingsQuery.isLoading ||
    balanceQuery.isLoading ||
    sellerMeQuery.isLoading ||
    ordersQuery.isLoading;
  const isError =
    listingsQuery.isError ||
    balanceQuery.isError ||
    sellerMeQuery.isError ||
    ordersQuery.isError;
  const error =
    listingsQuery.error ??
    balanceQuery.error ??
    sellerMeQuery.error ??
    ordersQuery.error;

  if (isAdmin) {
    return <Navigate to="/admin" replace />;
  }

  const activeListings = listings.filter(
    (listing) => listing.status === "ACTIVE",
  ).length;
  const balanceLabel = formatLedgerAmount(balanceQuery.data?.balance);
  const commissionLabel = formatCommissionRate(
    sellerMeQuery.data?.commissionRate,
  );

  if (isLoading) {
    return (
      <div className="space-y-6" role="status" aria-label="Carregando">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-4 w-64" />
        <div className="grid gap-3 sm:grid-cols-3">
          <Skeleton className="h-24 w-full" />
          <Skeleton className="h-24 w-full" />
          <Skeleton className="h-24 w-full" />
        </div>
        <Skeleton className="h-40 w-full" />
      </div>
    );
  }

  if (isError) {
    return (
      <ErrorState
        title="Erro ao carregar o painel"
        error={error}
        action={
          <Button
            type="button"
            variant="outline"
            onClick={() => {
              void listingsQuery.refetch();
              void balanceQuery.refetch();
              void sellerMeQuery.refetch();
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
    { label: "Saldo", value: balanceLabel, icon: Wallet },
    { label: "Comissão", value: commissionLabel, icon: Percent },
    { label: "Listings ativos", value: String(activeListings), icon: Package },
  ];

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Visão geral</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Saldo {balanceLabel} · Comissão {commissionLabel}
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
          <div className="flex flex-wrap gap-2">
            <Button asChild variant="outline" size="sm">
              <Link to="/seller/transactions">Ver transações</Link>
            </Button>
            <Button asChild variant="outline" size="sm">
              <Link to="/seller/orders">Ver pedidos</Link>
            </Button>
          </div>
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
                    {formatLedgerAmount(order.totalAmount)}
                  </p>
                  <Badge variant="secondary" className="mt-1">
                    {orderStatusLabel(order.status)}
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
