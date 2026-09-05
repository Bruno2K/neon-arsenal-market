import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { ListingCard } from "@/components/ProductCard";
import { EmptyState, ErrorState } from "@/components/page-state";
import { listListings } from "@/api/listings";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";

export default function IndexPage() {
  const { data, isLoading, isError, error, refetch } = useQuery({
    queryKey: ["listings", { status: "ACTIVE", limit: 8 }],
    queryFn: () => listListings({ status: "ACTIVE", limit: 8 }),
  });
  const listings = data?.items ?? [];

  return (
    <div className="container py-10">
      <div className="mb-10 max-w-xl">
        <h1 className="text-3xl font-semibold tracking-tight">Neon Arsenal</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Listings ativos · item único. Oito em destaque.
        </p>
        <Button asChild className="mt-6">
          <Link to="/products">Ver Market</Link>
        </Button>
      </div>

      {isLoading ? (
        <div
          className="grid grid-cols-1 gap-3 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4"
          role="status"
          aria-label="Carregando"
        >
          {Array.from({ length: 8 }).map((_, i) => (
            <Skeleton key={i} className="h-64 w-full" />
          ))}
        </div>
      ) : null}

      {isError ? (
        <ErrorState
          title="Erro ao carregar listings"
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
      ) : null}

      {!isLoading && !isError && listings.length === 0 ? (
        <EmptyState
          title="Nenhum listing ativo"
          description="Quando houver itens, eles aparecem aqui."
          action={
            <Button asChild>
              <Link to="/products">Ver Market</Link>
            </Button>
          }
        />
      ) : null}

      {!isLoading && !isError && listings.length > 0 ? (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
          {listings.map((listing) => (
            <ListingCard key={listing.id} listing={listing} />
          ))}
        </div>
      ) : null}
    </div>
  );
}
