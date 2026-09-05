import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { adminApproveSeller, listAdminOrders } from "@/api/admin";
import { listProducts } from "@/api/products";
import { listSellers } from "@/api/sellers";
import { EmptyState, ErrorState } from "@/components/page-state";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useToast } from "@/hooks/use-toast";
import type { Order, Seller } from "@/types/api";

function formatMoney(value: string | number): string {
  return `$${Number(value).toFixed(2)}`;
}

function formatCommission(rate: Seller["commissionRate"]): string {
  return `${(Number(rate ?? 0.1) * 100).toFixed(0)}%`;
}

export default function AdminDashboard() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const ordersQuery = useQuery({
    queryKey: ["admin-orders"],
    queryFn: listAdminOrders,
  });
  const sellersQuery = useQuery({
    queryKey: ["admin-sellers"],
    queryFn: listSellers,
  });
  const productsQuery = useQuery({
    queryKey: ["admin-products"],
    queryFn: () => listProducts({ limit: 1 }),
  });

  const orders = ordersQuery.data ?? [];
  const sellers = sellersQuery.data ?? [];
  const pendingSellers = sellers.filter((seller) => !seller.isApproved);
  const recentOrders = orders.slice(0, 10);
  const totalRevenue = orders.reduce(
    (sum, order) => sum + Number(order.totalAmount),
    0,
  );

  const approveSeller = useMutation({
    mutationFn: ({ id, isApproved }: { id: string; isApproved: boolean }) =>
      adminApproveSeller(id, isApproved),
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ["admin-sellers"] });
      toast({
        title: variables.isApproved
          ? "Vendedor aprovado"
          : "Vendedor rejeitado",
      });
    },
    onError: () => {
      toast({
        title: "Não foi possível atualizar o vendedor",
        variant: "destructive",
      });
    },
  });

  const isLoading =
    ordersQuery.isLoading || sellersQuery.isLoading || productsQuery.isLoading;
  const isError =
    ordersQuery.isError || sellersQuery.isError || productsQuery.isError;
  const error = ordersQuery.error ?? sellersQuery.error ?? productsQuery.error;

  if (isLoading) {
    return (
      <div className="space-y-6" role="status" aria-label="Carregando">
        <Skeleton className="h-8 w-48" />
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <Skeleton className="h-24 w-full" />
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
              void ordersQuery.refetch();
              void sellersQuery.refetch();
              void productsQuery.refetch();
            }}
          >
            Tentar novamente
          </Button>
        }
      />
    );
  }

  const stats = [
    { label: "Receita", value: formatMoney(totalRevenue) },
    { label: "Produtos", value: String(productsQuery.data?.total ?? 0) },
    { label: "Vendedores", value: String(sellers.length) },
    { label: "Pedidos", value: String(orders.length) },
  ];

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Painel admin</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Catálogo, vendedores e pedidos da plataforma.
        </p>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {stats.map((stat) => (
          <div
            key={stat.label}
            className="rounded-md border border-border bg-card p-4"
          >
            <p className="text-xs text-muted-foreground">{stat.label}</p>
            <p className="mt-2 tabular-nums text-2xl font-semibold tracking-tight">
              {stat.value}
            </p>
          </div>
        ))}
      </div>

      <section className="space-y-3">
        <div>
          <h2 className="text-lg font-semibold tracking-tight">
            Vendedores pendentes
          </h2>
          <p className="text-sm text-muted-foreground">
            Aprove ou rejeite cadastros aguardando revisão.
          </p>
        </div>
        {pendingSellers.length === 0 ? (
          <EmptyState
            title="Nenhum vendedor pendente de aprovação"
            description="Todos os cadastros já foram revisados."
          />
        ) : (
          <PendingSellersTable
            sellers={pendingSellers}
            busy={approveSeller.isPending}
            onApprove={(id) => approveSeller.mutate({ id, isApproved: true })}
            onReject={(id) => approveSeller.mutate({ id, isApproved: false })}
          />
        )}
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-semibold tracking-tight">
          Todos os vendedores
        </h2>
        {sellers.length === 0 ? (
          <EmptyState title="Nenhum vendedor cadastrado" />
        ) : (
          <SellersOverviewTable sellers={sellers} />
        )}
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-semibold tracking-tight">
          Pedidos recentes
        </h2>
        {recentOrders.length === 0 ? (
          <EmptyState title="Nenhum pedido encontrado" />
        ) : (
          <RecentOrdersTable orders={recentOrders} />
        )}
      </section>
    </div>
  );
}

function PendingSellersTable({
  sellers,
  busy,
  onApprove,
  onReject,
}: {
  sellers: Seller[];
  busy: boolean;
  onApprove: (id: string) => void;
  onReject: (id: string) => void;
}) {
  return (
    <div className="overflow-hidden rounded-md border border-border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Loja</TableHead>
            <TableHead>Usuário</TableHead>
            <TableHead className="text-right">Ações</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {sellers.map((seller) => (
            <TableRow key={seller.id}>
              <TableCell className="font-medium">{seller.storeName}</TableCell>
              <TableCell className="text-muted-foreground">
                {seller.user?.name ?? "—"}
              </TableCell>
              <TableCell className="text-right">
                <div className="flex justify-end gap-2">
                  <Button
                    type="button"
                    size="sm"
                    disabled={busy}
                    onClick={() => onApprove(seller.id)}
                  >
                    Aprovar
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    disabled={busy}
                    onClick={() => onReject(seller.id)}
                  >
                    Rejeitar
                  </Button>
                </div>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}

function SellersOverviewTable({ sellers }: { sellers: Seller[] }) {
  return (
    <div className="overflow-hidden rounded-md border border-border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Loja</TableHead>
            <TableHead>Usuário</TableHead>
            <TableHead>Comissão</TableHead>
            <TableHead>Avaliação</TableHead>
            <TableHead>Status</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {sellers.map((seller) => (
            <TableRow key={seller.id}>
              <TableCell className="font-medium">{seller.storeName}</TableCell>
              <TableCell className="text-muted-foreground">
                {seller.user?.name ?? "—"}
              </TableCell>
              <TableCell>{formatCommission(seller.commissionRate)}</TableCell>
              <TableCell>{Number(seller.rating).toFixed(1)}</TableCell>
              <TableCell>
                <Badge variant={seller.isApproved ? "default" : "secondary"}>
                  {seller.isApproved ? "Aprovado" : "Pendente"}
                </Badge>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}

function RecentOrdersTable({ orders }: { orders: Order[] }) {
  return (
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
                #{order.id.slice(0, 8)}
              </TableCell>
              <TableCell>{formatMoney(order.totalAmount)}</TableCell>
              <TableCell>
                {new Date(order.createdAt).toLocaleDateString("pt-BR")}
              </TableCell>
              <TableCell>
                <Badge variant="outline">{order.paymentStatus}</Badge>
              </TableCell>
              <TableCell>
                <Badge variant="secondary">{order.status}</Badge>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
