import { Link, useSearchParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { listAdminOrders } from "@/api/admin";
import { EmptyState, ErrorState } from "@/components/page-state";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import {
  ADMIN_ORDER_STATUSES,
  ADMIN_PAYMENT_STATUSES,
  hasAdminOrderFilters,
  parseAdminOrderStatus,
  parseAdminPaymentStatus,
} from "@/lib/adminOrderFilters";
import { orderStatusLabel, paymentStatusLabel } from "@/lib/userFacingApiError";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

function formatMoney(value: number): string {
  return `$${Number(value).toFixed(2)}`;
}

export default function AdminOrders() {
  const [searchParams, setSearchParams] = useSearchParams();
  const status = parseAdminOrderStatus(searchParams.get("status"));
  const paymentStatus = parseAdminPaymentStatus(
    searchParams.get("paymentStatus"),
  );
  const filters = {
    ...(status ? { status } : {}),
    ...(paymentStatus ? { paymentStatus } : {}),
  };
  const filtered = hasAdminOrderFilters(filters);

  const {
    data: orders = [],
    isLoading,
    isError,
    error,
    refetch,
  } = useQuery({
    queryKey: ["admin-orders", filters],
    queryFn: () => listAdminOrders(filters),
  });

  const setFilter = (key: "status" | "paymentStatus", value: string) => {
    const next = new URLSearchParams(searchParams);
    if (value) next.set(key, value);
    else next.delete(key);
    setSearchParams(next, { replace: true });
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Pedidos</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Pedidos da plataforma, com status de pagamento e cumprimento.
        </p>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <div className="grid gap-2">
          <Label htmlFor="admin-order-status">Status</Label>
          <select
            id="admin-order-status"
            className="flex h-11 min-h-11 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
            value={status ?? ""}
            onChange={(event) => setFilter("status", event.target.value)}
          >
            <option value="">Todos</option>
            {ADMIN_ORDER_STATUSES.map((value) => (
              <option key={value} value={value}>
                {orderStatusLabel(value)}
              </option>
            ))}
          </select>
        </div>
        <div className="grid gap-2">
          <Label htmlFor="admin-order-payment-status">Pagamento</Label>
          <select
            id="admin-order-payment-status"
            className="flex h-11 min-h-11 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
            value={paymentStatus ?? ""}
            onChange={(event) => setFilter("paymentStatus", event.target.value)}
          >
            <option value="">Todos</option>
            {ADMIN_PAYMENT_STATUSES.map((value) => (
              <option key={value} value={value}>
                {paymentStatusLabel(value)}
              </option>
            ))}
          </select>
        </div>
      </div>

      {isLoading ? (
        <div className="space-y-4" role="status" aria-label="Carregando">
          <Skeleton className="h-48 w-full" />
        </div>
      ) : isError ? (
        <ErrorState
          title="Erro ao carregar os pedidos"
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
      ) : orders.length === 0 ? (
        <EmptyState
          title={
            filtered ? "Nenhum pedido neste filtro" : "Nenhum pedido encontrado"
          }
          description={filtered ? "Tente ajustar os filtros" : undefined}
        />
      ) : (
        <div className="overflow-hidden rounded-md border border-border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>ID</TableHead>
                <TableHead>Total</TableHead>
                <TableHead>Data</TableHead>
                <TableHead>Pagamento</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {orders.map((order) => (
                <TableRow key={order.id}>
                  <TableCell className="font-mono text-xs">
                    <Link
                      to={{
                        pathname: `/admin/orders/${order.id}`,
                        search: searchParams.toString(),
                      }}
                      className="underline-offset-4 hover:underline"
                    >
                      #{order.id.slice(0, 8)}
                    </Link>
                  </TableCell>
                  <TableCell>{formatMoney(order.totalAmount)}</TableCell>
                  <TableCell>
                    {new Date(order.createdAt).toLocaleDateString("pt-BR")}
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline">
                      {paymentStatusLabel(order.paymentStatus)}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <Badge variant="secondary">
                      {orderStatusLabel(order.status)}
                    </Badge>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}
