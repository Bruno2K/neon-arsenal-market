import { Link, Navigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { listCommissionTransactions } from "@/api/commissions";
import { getSellerMe } from "@/api/sellers";
import { useAuth } from "@/contexts/AuthContext";
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
import { formatLedgerAmount } from "@/lib/formatLedgerAmount";
import { paymentStatusLabel } from "@/lib/userFacingApiError";

function formatTransactionDate(iso: string): string {
  const parsed = new Date(iso);
  if (Number.isNaN(parsed.getTime())) return iso;
  return parsed.toLocaleDateString();
}

export default function SellerTransactionsPage() {
  const { user } = useAuth();
  const isAdmin = user?.role === "ADMIN";
  const {
    data: transactions = [],
    isLoading,
    isError,
    error,
    refetch,
  } = useQuery({
    queryKey: ["commissionTransactions"],
    queryFn: () => listCommissionTransactions(),
    enabled: user?.role === "SELLER",
  });
  const sellerMeQuery = useQuery({
    queryKey: ["sellerMe"],
    queryFn: () => getSellerMe(),
    enabled: user?.role === "SELLER",
  });
  const canCreateListing = sellerMeQuery.data?.isApproved === true;

  if (isAdmin) {
    return <Navigate to="/admin" replace />;
  }

  if (isLoading) {
    return (
      <div className="space-y-4" role="status" aria-label="Carregando">
        <Skeleton className="h-8 w-40" />
        <Skeleton className="h-4 w-72 max-w-full" />
        <Skeleton className="h-48 w-full" />
      </div>
    );
  }

  if (isError) {
    return (
      <ErrorState
        title="Erro ao carregar transações"
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
        <h1 className="text-2xl font-semibold tracking-tight">Transações</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Movimentos oficiais do ledger. O valor é o líquido creditado após a
          comissão.
        </p>
      </div>

      {transactions.length === 0 ? (
        <EmptyState
          title="Nenhuma transação"
          description="Quando um pedido for pago, o movimento aparece aqui."
          action={
            canCreateListing ? (
              <Button asChild>
                <Link to="/seller/listings">Criar listing</Link>
              </Button>
            ) : undefined
          }
        />
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Data</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Valor</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {transactions.map((tx) => (
              <TableRow key={tx.id}>
                <TableCell className="whitespace-nowrap text-muted-foreground">
                  {formatTransactionDate(tx.createdAt)}
                </TableCell>
                <TableCell>
                  <Badge variant="secondary">
                    {paymentStatusLabel(tx.status)}
                  </Badge>
                </TableCell>
                <TableCell className="text-right tabular-nums font-medium">
                  {formatLedgerAmount(tx.netAmount)}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
    </div>
  );
}
