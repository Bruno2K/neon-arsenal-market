import { useParams, Link, useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, ShoppingCart } from "lucide-react";
import { ListingCard } from "@/components/ProductCard";
import { ErrorState } from "@/components/page-state";
import { getListing, listListings } from "@/api/listings";
import { getPriceHistory } from "@/api/price-history";
import { useCart } from "@/contexts/CartContext";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";

export default function ListingDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { addItem } = useCart();

  const {
    data: listing,
    isLoading,
    isError,
    error,
  } = useQuery({
    queryKey: ["listing", id],
    queryFn: () => getListing(id!),
    enabled: !!id,
  });

  const { data: priceHistory } = useQuery({
    queryKey: ["priceHistory", id],
    queryFn: () => getPriceHistory(id!),
    enabled: !!id,
  });

  const { data: relatedData } = useQuery({
    queryKey: ["listings", { productId: listing?.productId, limit: 4 }],
    queryFn: () =>
      listListings({
        productId: listing?.productId,
        status: "ACTIVE",
        limit: 4,
      }),
    enabled: !!listing?.productId,
  });

  const related = (relatedData?.items ?? [])
    .filter((item) => item.id !== id)
    .slice(0, 4);
  const productName = listing
    ? `${listing.product.weapon} | ${listing.product.skinName} (${listing.product.exterior})`
    : "";
  const isAvailable =
    listing?.status === "ACTIVE" &&
    (!listing.tradeLockUntil || new Date(listing.tradeLockUntil) <= new Date());

  if (isLoading) {
    return (
      <div className="container py-10">
        <div
          className="grid gap-8 md:grid-cols-2"
          role="status"
          aria-label="Carregando"
        >
          <Skeleton className="aspect-[4/3] w-full" />
          <div className="space-y-3">
            <Skeleton className="h-8 w-2/3" />
            <Skeleton className="h-4 w-40" />
            <Skeleton className="h-24 w-full" />
            <Skeleton className="h-12 w-full" />
          </div>
        </div>
      </div>
    );
  }

  if (isError || !listing) {
    return (
      <div className="container py-10">
        <ErrorState
          title="Listing não encontrado"
          description={
            error instanceof Error
              ? error.message
              : "Este item não está disponível."
          }
          action={
            <Button asChild>
              <Link to="/products">Voltar ao Market</Link>
            </Button>
          }
        />
      </div>
    );
  }

  const price =
    typeof listing.price === "number" ? listing.price : Number(listing.price);
  const sellerName =
    listing.seller?.user?.name ?? listing.seller?.storeName ?? "";
  const monogram = listing.product.weapon.slice(0, 3).toUpperCase();
  const latestHistory = priceHistory?.[0];

  return (
    <div className="container py-8">
      <Button
        variant="ghost"
        size="sm"
        onClick={() => navigate(-1)}
        className="mb-6"
      >
        <ArrowLeft className="mr-1 h-4 w-4" /> Voltar
      </Button>

      <div className="grid gap-8 md:grid-cols-2">
        <div className="relative flex aspect-[4/3] items-center justify-center overflow-hidden rounded-md border border-border bg-muted">
          <span className="text-4xl font-semibold tracking-tight text-muted-foreground/70">
            {monogram}
          </span>
          {listing.product.isStattrak ? (
            <span className="absolute left-3 top-3 rounded-sm bg-background/90 px-1.5 py-0.5 text-[10px] font-medium text-foreground">
              StatTrak™
            </span>
          ) : null}
        </div>

        <div className="space-y-6">
          <div>
            <h1 className="text-3xl font-semibold tracking-tight text-foreground">
              {productName}
            </h1>
            <dl className="mt-4 grid gap-2 text-sm text-muted-foreground sm:grid-cols-2">
              <div>
                <dt className="text-foreground">Raridade</dt>
                <dd>{listing.product.rarity}</dd>
              </div>
              <div>
                <dt className="text-foreground">Coleção</dt>
                <dd>{listing.product.collection || "N/A"}</dd>
              </div>
              <div>
                <dt className="text-foreground">Float</dt>
                <dd className="tabular-nums">
                  {Number(listing.floatValue).toFixed(8)}
                </dd>
              </div>
              {listing.pattern != null ? (
                <div>
                  <dt className="text-foreground">Pattern</dt>
                  <dd className="tabular-nums">{listing.pattern}</dd>
                </div>
              ) : null}
              {listing.tradeLockUntil ? (
                <div className="sm:col-span-2">
                  <dt className="text-foreground">Trade Lock até</dt>
                  <dd>
                    {new Date(listing.tradeLockUntil).toLocaleDateString()}
                  </dd>
                </div>
              ) : null}
            </dl>
          </div>

          {sellerName ? (
            <div className="flex items-center gap-3 rounded-md border border-border bg-card p-4">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-muted text-sm font-medium text-muted-foreground">
                {sellerName[0]}
              </div>
              <div>
                <p className="text-sm font-medium text-foreground">
                  {sellerName}
                </p>
                {listing.seller.rating ? (
                  <p className="text-xs text-muted-foreground">
                    Avaliação: {Number(listing.seller.rating).toFixed(1)}
                  </p>
                ) : null}
              </div>
            </div>
          ) : null}

          <div className="space-y-4 rounded-md border border-border bg-card p-5">
            <div className="flex items-baseline gap-2">
              <span className="tabular-nums text-3xl font-semibold tracking-tight text-foreground">
                ${price.toFixed(2)}
              </span>
              <span className="text-sm text-muted-foreground">
                {listing.currency}
              </span>
            </div>
            <p className="text-sm text-muted-foreground">
              Status:{" "}
              {listing.status === "ACTIVE" ? "Disponível" : listing.status}
            </p>
            {latestHistory ? (
              <p className="text-sm text-muted-foreground">
                Última alteração: ${Number(latestHistory.newPrice).toFixed(2)}
              </p>
            ) : null}
            <div className="flex gap-3">
              <Button
                className="flex-1"
                size="lg"
                onClick={() => addItem(listing)}
                disabled={!isAvailable}
                title={
                  !isAvailable ? "Item não disponível" : "Adicionar ao carrinho"
                }
              >
                <ShoppingCart className="mr-2 h-5 w-5" /> Adicionar ao Carrinho
              </Button>
              <Button variant="outline" size="lg" asChild>
                <Link to="/cart">Ver Carrinho</Link>
              </Button>
            </div>
          </div>

          {priceHistory && priceHistory.length > 0 ? (
            <div className="rounded-md border border-border bg-card p-4">
              <h2 className="mb-3 text-sm font-semibold tracking-tight text-foreground">
                Histórico de Preços
              </h2>
              <ul className="space-y-2 text-sm text-muted-foreground">
                {priceHistory.slice(0, 5).map((entry) => (
                  <li key={entry.id} className="flex justify-between gap-3">
                    <span>
                      {new Date(entry.changedAt).toLocaleDateString()}
                    </span>
                    <span className="tabular-nums">
                      ${Number(entry.oldPrice).toFixed(2)} → $
                      {Number(entry.newPrice).toFixed(2)}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
        </div>
      </div>

      {related.length > 0 ? (
        <section className="mt-12 border-t border-border pt-10">
          <h2 className="mb-4 text-xl font-semibold tracking-tight text-foreground">
            Outros listings desta skin
          </h2>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {related.map((item) => (
              <ListingCard key={item.id} listing={item} />
            ))}
          </div>
        </section>
      ) : null}
    </div>
  );
}
