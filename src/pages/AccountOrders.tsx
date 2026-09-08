import { Link, Navigate, useParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { listOrders } from "@/api/orders";
import { useAuth } from "@/contexts/AuthContext";
import { EmptyState, ErrorState, PageSkeleton } from "@/components/page-state";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { orderItemLabel, orderTotalAmount } from "@/lib/orderPaymentView";
import { orderStatusLabel, paymentStatusLabel } from "@/lib/userFacingApiError";
import type { Order } from "@/types/api";

function formatOrderDate(iso: string): string {
  return new Date(iso).toLocaleDateString("pt-BR");
}

function firstItemLabel(order: Order): string {
  const first = order.items?.[0];
  return first ? orderItemLabel(first) : "Pedido";
}

export function AccountOrderDetailRedirect() {
  const { id } = useParams<{ id: string }>();
  if (!id) return <Navigate to="/account/orders" replace />;
  return <Navigate to={`/orders/${id}`} replace />;
}

export default function AccountOrdersPage() {
  const { user } = useAuth();
  const isCustomer = user?.role === "CUSTOMER";
  const {
    data: orders = [],
    isLoading,
    isError,
    error,
    refetch,
  } = useQuery({
    queryKey: ["account-orders"],
    queryFn: () => listOrders(),
    enabled: isCustomer,
  });

  if (user?.role === "SELLER") {
    return <Navigate to="/seller/orders" replace />;
  }

  if (user?.role === "ADMIN") {
    return <Navigate to="/admin/orders" replace />;
  }

  if (!isCustomer) {
    return null;
  }

  if (isLoading) {
    return <PageSkeleton label="Carregando pedidos" />;
  }

  if (isError) {
    return (
      <div className="container py-8">
        <ErrorState
          title="Erro ao carregar pedidos"
          error={error}
          action={
            <Button
              type="button"
              variant="outline"
              onClick={() => void refetch()}
            >
              Tentar novamente
            </Button>
          }
        />
      </div>
    );
  }

  return (
    <div className="container max-w-2xl py-8">
      <div className="mb-8">
        <h1 className="text-2xl font-semibold tracking-tight">Pedidos</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Histórico das suas compras neste Market.
        </p>
      </div>

      {orders.length === 0 ? (
        <EmptyState
          title="Você ainda não comprou"
          description="Quando você pagar um listing, o pedido aparece aqui."
          action={
            <Button asChild>
              <Link to="/products">Ir ao Market</Link>
            </Button>
          }
        />
      ) : (
        <ul className="space-y-2">
          {orders.map((order) => (
            <li key={order.id}>
              <Link
                to={`/orders/${order.id}`}
                className="flex flex-col justify-between gap-3 rounded-md border border-border bg-card p-4 transition-colors hover:border-foreground/20 sm:flex-row sm:items-center"
              >
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium text-foreground">
                    {firstItemLabel(order)}
                  </p>
                  <div className="mt-2 flex flex-wrap items-center gap-2">
                    <Badge variant="secondary">
                      {orderStatusLabel(order.status)}
                    </Badge>
                    <Badge variant="outline">
                      {paymentStatusLabel(order.paymentStatus)}
                    </Badge>
                    {order.createdAt ? (
                      <span className="text-xs text-muted-foreground">
                        {formatOrderDate(order.createdAt)}
                      </span>
                    ) : null}
                  </div>
                </div>
                <p className="tabular-price text-lg font-semibold text-foreground sm:text-right">
                  R$ {orderTotalAmount(order).toFixed(2)}
                </p>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
