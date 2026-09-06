import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import {
  favoriteListing,
  favoriteListingId,
  listFavorites,
} from "@/api/favorites";
import { ListingCard } from "@/components/ProductCard";
import { EmptyState, ErrorState } from "@/components/page-state";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { similarItemsMarketPath } from "@/lib/listingCartCta";

export default function AccountFavoritesPage() {
  const { data, isLoading, isError, error, refetch } = useQuery({
    queryKey: ["favorites"],
    queryFn: listFavorites,
  });

  if (isLoading) {
    return (
      <div
        className="container space-y-4 py-8"
        role="status"
        aria-label="Carregando"
      >
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  if (isError) {
    return (
      <div className="container py-8">
        <ErrorState
          title="Erro ao carregar favoritos"
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

  const items = data ?? [];

  return (
    <div className="container py-8">
      <h1 className="text-2xl font-semibold tracking-tight">Favoritos</h1>
      <p className="mt-1 text-sm text-muted-foreground">
        Itens salvos na sua conta. Sobrevivem ao recarregar a página.
      </p>

      {items.length === 0 ? (
        <EmptyState
          title="Nenhum favorito"
          description="Salve um listing no Market para voltar depois."
          action={
            <Button asChild>
              <Link to="/products">Explorar Market</Link>
            </Button>
          }
        />
      ) : (
        <ul className="mt-8 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {items.map((favorite) => {
            const listing = favoriteListing(favorite);
            const id = favoriteListingId(favorite);
            if (!listing) {
              return (
                <li
                  key={id}
                  className="rounded-md border border-border p-4 text-sm text-muted-foreground"
                >
                  Listing {id}
                </li>
              );
            }
            return (
              <li key={id} className="space-y-2">
                {listing.status === "SOLD" ? (
                  <div className="flex items-center justify-between gap-2">
                    <Badge variant="secondary">Vendido</Badge>
                    <Link
                      to={similarItemsMarketPath(listing.productId)}
                      className="text-sm underline-offset-2 hover:underline"
                    >
                      Ver relacionados
                    </Link>
                  </div>
                ) : null}
                <ListingCard listing={listing} source="related" />
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
