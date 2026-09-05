import { Link } from "react-router-dom";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { listProducts } from "@/api/products";
import { EmptyState, ErrorState } from "@/components/page-state";
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

const PAGE_SIZE = 20;

export default function SellerProductsPage() {
  const [page, setPage] = useState(1);
  const { data, isLoading, isError, error, refetch } = useQuery({
    queryKey: ["products", { page, limit: PAGE_SIZE }],
    queryFn: () => listProducts({ page, limit: PAGE_SIZE }),
  });

  const items = data?.items ?? [];
  const total = data?.total ?? 0;
  const pageCount = Math.max(1, Math.ceil(total / PAGE_SIZE));

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
        title="Erro ao carregar o catálogo"
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
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Produtos</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Catálogo somente leitura. Para anunciar um item único, use Listings.
          </p>
        </div>
        <Button asChild variant="outline">
          <Link to="/seller/listings">Ir para listings</Link>
        </Button>
      </div>

      {items.length === 0 ? (
        <EmptyState
          title="Nenhum produto no catálogo"
          description="O catálogo é gerenciado pelo admin."
        />
      ) : (
        <div className="overflow-hidden rounded-md border border-border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Skin</TableHead>
                <TableHead>Raridade</TableHead>
                <TableHead className="hidden md:table-cell">Exterior</TableHead>
                <TableHead className="hidden md:table-cell">Coleção</TableHead>
                <TableHead>StatTrak™</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {items.map((product) => (
                <TableRow key={product.id}>
                  <TableCell className="font-medium">
                    {product.weapon} | {product.skinName}
                  </TableCell>
                  <TableCell>{product.rarity}</TableCell>
                  <TableCell className="hidden text-muted-foreground md:table-cell">
                    {product.exterior}
                  </TableCell>
                  <TableCell className="hidden text-muted-foreground md:table-cell">
                    {product.collection || "N/A"}
                  </TableCell>
                  <TableCell>{product.isStattrak ? "Sim" : "Não"}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      {total > PAGE_SIZE ? (
        <div className="flex items-center justify-between gap-3 text-sm text-muted-foreground">
          <span className="tabular-nums">{total} produtos</span>
          <div className="flex gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={page <= 1}
              onClick={() => setPage((current) => Math.max(1, current - 1))}
            >
              Anterior
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={page >= pageCount}
              onClick={() => setPage((current) => current + 1)}
            >
              Próxima
            </Button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
