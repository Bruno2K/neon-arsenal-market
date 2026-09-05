import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { adminApproveSeller } from "@/api/admin";
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
import type { Seller } from "@/types/api";

function formatMoney(value: number): string {
  return `$${Number(value).toFixed(2)}`;
}

function formatCommission(rate: Seller["commissionRate"]): string {
  return `${(Number(rate ?? 0.1) * 100).toFixed(0)}%`;
}

export default function AdminSellers() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const {
    data: sellers = [],
    isLoading,
    isError,
    error,
    refetch,
  } = useQuery({
    queryKey: ["admin-sellers"],
    queryFn: listSellers,
  });

  const approveSeller = useMutation({
    mutationFn: ({ id, isApproved }: { id: string; isApproved: boolean }) =>
      adminApproveSeller(id, isApproved),
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ["admin-sellers"] });
      toast({
        title: variables.isApproved ? "Vendedor aprovado" : "Vendedor suspenso",
      });
    },
    onError: () => {
      toast({
        title: "Não foi possível atualizar o vendedor",
        variant: "destructive",
      });
    },
  });

  if (isLoading) {
    return (
      <div className="space-y-4" role="status" aria-label="Carregando">
        <Skeleton className="h-8 w-40" />
        <Skeleton className="h-48 w-full" />
      </div>
    );
  }

  if (isError) {
    return (
      <ErrorState
        title="Erro ao carregar os vendedores"
        description={
          error instanceof Error
            ? error.message
            : "Tente novamente em instantes."
        }
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
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Vendedores</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Aprove cadastros pendentes ou suspenda lojas já ativas.
        </p>
      </div>

      {sellers.length === 0 ? (
        <EmptyState title="Nenhum vendedor cadastrado" />
      ) : (
        <div className="overflow-hidden rounded-md border border-border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Loja</TableHead>
                <TableHead>Usuário</TableHead>
                <TableHead>Comissão</TableHead>
                <TableHead>Saldo</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {sellers.map((seller) => (
                <TableRow key={seller.id}>
                  <TableCell className="font-medium">
                    {seller.storeName}
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {seller.user?.name ?? "—"}
                  </TableCell>
                  <TableCell>
                    {formatCommission(seller.commissionRate)}
                  </TableCell>
                  <TableCell>{formatMoney(seller.balance)}</TableCell>
                  <TableCell>
                    <Badge
                      variant={seller.isApproved ? "default" : "secondary"}
                    >
                      {seller.isApproved ? "Aprovado" : "Pendente"}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right">
                    {seller.isApproved ? (
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        disabled={approveSeller.isPending}
                        onClick={() =>
                          approveSeller.mutate({
                            id: seller.id,
                            isApproved: false,
                          })
                        }
                      >
                        Suspender
                      </Button>
                    ) : (
                      <Button
                        type="button"
                        size="sm"
                        disabled={approveSeller.isPending}
                        onClick={() =>
                          approveSeller.mutate({
                            id: seller.id,
                            isApproved: true,
                          })
                        }
                      >
                        Aprovar
                      </Button>
                    )}
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
