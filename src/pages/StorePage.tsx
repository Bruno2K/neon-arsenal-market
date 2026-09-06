import { Link, useParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { getSellerById } from "@/api/sellers";
import { listListings } from "@/api/listings";
import { ListingCard } from "@/components/ProductCard";
import { EmptyState, ErrorState } from "@/components/page-state";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { SELLER_RATING_COPY } from "@/lib/storePath";
import { isNotFoundApiError } from "@/lib/userFacingApiError";

export default function StorePage() {
  const { sellerId } = useParams<{ sellerId: string }>();

  const sellerQuery = useQuery({
    queryKey: ["seller", sellerId],
    queryFn: () => getSellerById(sellerId!),
    enabled: !!sellerId,
  });
  const listingsQuery = useQuery({
    queryKey: ["listings", { sellerId, status: "ACTIVE" }],
    queryFn: () =>
      listListings({ sellerId, status: "ACTIVE", page: 1, limit: 40 }),
    enabled: !!sellerId && sellerQuery.isSuccess,
  });

  if (sellerQuery.isLoading) {
    return (
      <div
        className="container space-y-4 py-10"
        role="status"
        aria-label="Carregando"
      >
        <Skeleton className="h-10 w-64" />
        <Skeleton className="h-4 w-80 max-w-full" />
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <Skeleton className="h-64 w-full" />
          <Skeleton className="h-64 w-full" />
        </div>
      </div>
    );
  }

  if (sellerQuery.isError || !sellerQuery.data) {
    return (
      <div className="container py-10">
        <ErrorState
          title={
            isNotFoundApiError(sellerQuery.error)
              ? "Loja não encontrada"
              : "Erro ao carregar a loja"
          }
          error={sellerQuery.error}
          action={
            <Button asChild>
              <Link to="/products">Voltar ao Market</Link>
            </Button>
          }
        />
      </div>
    );
  }

  const seller = sellerQuery.data;
  const items = listingsQuery.data?.items ?? [];

  return (
    <div className="container py-8">
      <div className="mb-8">
        <h1 className="text-2xl font-semibold tracking-tight">
          {seller.storeName}
        </h1>
        {seller.user?.name ? (
          <p className="mt-1 text-sm text-muted-foreground">
            {seller.user.name}
          </p>
        ) : null}
        <p className="mt-2 text-sm text-muted-foreground">
          {SELLER_RATING_COPY}: {Number(seller.rating).toFixed(1)}
        </p>
      </div>

      {listingsQuery.isLoading ? (
        <div
          className="grid grid-cols-1 gap-3 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4"
          role="status"
          aria-label="Carregando"
        >
          {Array.from({ length: 4 }).map((_, index) => (
            <Skeleton key={index} className="h-64 w-full" />
          ))}
        </div>
      ) : listingsQuery.isError ? (
        <ErrorState
          title="Erro ao carregar listings da loja"
          error={listingsQuery.error}
          action={
            <Button
              type="button"
              variant="outline"
              onClick={() => void listingsQuery.refetch()}
            >
              Tentar novamente
            </Button>
          }
        />
      ) : items.length === 0 ? (
        <EmptyState
          title="Nenhum listing ativo nesta loja."
          action={
            <Button asChild>
              <Link to="/products">Explorar Market</Link>
            </Button>
          }
        />
      ) : (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
          {items.map((listing) => (
            <ListingCard key={listing.id} listing={listing} source="seller" />
          ))}
        </div>
      )}
    </div>
  );
}
