import { useEffect } from "react";
import { useParams, Link, useLocation } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { ListingCard, SkinVisual } from "@/components/ProductCard";
import { ListingCartCta } from "@/components/ListingCartCta";
import { FavoriteButton } from "@/components/FavoriteButton";
import { PriceHistorySection } from "@/components/PriceHistorySection";
import { ProductReviews } from "@/components/ProductReviews";
import { RecentlyViewedRail } from "@/components/RecentlyViewedRail";
import { ErrorState } from "@/components/page-state";
import { getListing, listListings } from "@/api/listings";
import { getPriceHistory } from "@/api/price-history";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";
import { useRecentlyViewedListings } from "@/hooks/useRecentlyViewedListings";
import { recordRecentlyViewedId } from "@/lib/recentlyViewed";
import { analyticsPrice, readAnalyticsSource, track } from "@/lib/analytics";
import { marketPath } from "@/lib/marketQuery";
import {
  moreFromSellerHeading,
  relatedFallbackHeading,
  takeUniqueListings,
} from "@/lib/relatedListings";
import { SELLER_RATING_COPY, storePath } from "@/lib/storePath";
import {
  isNotFoundApiError,
  isRetryableReadError,
  listingStatusLabel,
} from "@/lib/userFacingApiError";

export default function ListingDetail() {
  const { id } = useParams<{ id: string }>();
  const location = useLocation();
  const source = readAnalyticsSource(location.state);

  const {
    data: listing,
    isLoading,
    isError,
    error,
    refetch,
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

  const { data: relatedSkinData } = useQuery({
    queryKey: ["listings", { productId: listing?.productId, limit: 5 }],
    queryFn: () =>
      listListings({
        productId: listing?.productId,
        status: "ACTIVE",
        limit: 5,
      }),
    enabled: !!listing?.productId,
  });

  const sameSkin = takeUniqueListings(
    relatedSkinData?.items ?? [],
    new Set(id ? [id] : []),
    4,
  );
  const usedIds = new Set([id ?? "", ...sameSkin.map((item) => item.id)]);

  const needFallback = sameSkin.length < 3;
  const { data: fallbackData } = useQuery({
    queryKey: [
      "listings",
      {
        weapon: listing?.product.weapon,
        collection: listing?.product.collection,
        limit: 8,
      },
    ],
    queryFn: () =>
      listListings({
        weapon: listing?.product.weapon,
        status: "ACTIVE",
        limit: 8,
      }),
    enabled: Boolean(needFallback && listing?.product.weapon),
  });

  const fallbackKind: "weapon" | "collection" = listing?.product.collection
    ? "collection"
    : "weapon";
  const fallbackItems = takeUniqueListings(
    (fallbackData?.items ?? []).filter((item) => {
      if (fallbackKind === "collection" && listing?.product.collection) {
        return item.product.collection === listing.product.collection;
      }
      return item.product.weapon === listing?.product.weapon;
    }),
    usedIds,
    4,
  );
  fallbackItems.forEach((item) => usedIds.add(item.id));

  const { data: sellerListingsData } = useQuery({
    queryKey: ["listings", { sellerId: listing?.sellerId, status: "ACTIVE" }],
    queryFn: () =>
      listListings({
        sellerId: listing?.sellerId,
        status: "ACTIVE",
        limit: 5,
      }),
    enabled: !!listing?.sellerId,
  });

  const sellerItems = takeUniqueListings(
    sellerListingsData?.items ?? [],
    usedIds,
    4,
  );
  const recentlyViewed = useRecentlyViewedListings(id);

  useEffect(() => {
    if (!listing) return;
    recordRecentlyViewedId(listing.id);
    track("product_view", {
      listingId: listing.id,
      productId: listing.productId,
      price: analyticsPrice(listing.price),
      source,
    });
  }, [listing, source]);
  const productName = listing
    ? `${listing.product.weapon} | ${listing.product.skinName} (${listing.product.exterior})`
    : "";
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
    const missing = isNotFoundApiError(error);
    const canRetry = isRetryableReadError(error);
    return (
      <div className="container py-10">
        <ErrorState
          title={
            missing ? "Listing não encontrado" : "Erro ao carregar listing"
          }
          error={error}
          action={
            <div className="flex justify-center gap-2">
              {canRetry ? (
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => refetch()}
                >
                  Tentar novamente
                </Button>
              ) : null}
              <Button asChild>
                <Link to="/products">Voltar ao Market</Link>
              </Button>
            </div>
          }
        />
      </div>
    );
  }

  const price =
    typeof listing.price === "number" ? listing.price : Number(listing.price);
  const sellerName =
    listing.seller?.user?.name ?? listing.seller?.storeName ?? "";
  const latestHistory = priceHistory?.[0];
  const storeHref = storePath(listing.sellerId);

  return (
    <div className="container py-8">
      <Breadcrumb className="mb-6">
        <BreadcrumbList>
          <BreadcrumbItem>
            <BreadcrumbLink asChild>
              <Link to="/">Home</Link>
            </BreadcrumbLink>
          </BreadcrumbItem>
          <BreadcrumbSeparator />
          <BreadcrumbItem>
            <BreadcrumbLink asChild>
              <Link to="/products">Market</Link>
            </BreadcrumbLink>
          </BreadcrumbItem>
          <BreadcrumbSeparator />
          <BreadcrumbItem>
            <BreadcrumbLink asChild>
              <Link to={marketPath({ weapon: listing.product.weapon })}>
                {listing.product.weapon}
              </Link>
            </BreadcrumbLink>
          </BreadcrumbItem>
          <BreadcrumbSeparator />
          <BreadcrumbItem>
            <BreadcrumbPage>{productName}</BreadcrumbPage>
          </BreadcrumbItem>
        </BreadcrumbList>
      </Breadcrumb>

      <div className="grid gap-8 md:grid-cols-2">
        <div className="relative flex aspect-[4/3] items-center justify-center overflow-hidden rounded-md border border-border bg-muted">
          <SkinVisual product={listing.product} className="text-4xl" />
          {listing.product.isStattrak ? (
            <span className="absolute left-3 top-3 rounded-sm bg-background/90 px-1.5 py-0.5 text-[10px] font-medium text-foreground">
              StatTrak™
            </span>
          ) : null}
        </div>

        <div className="space-y-6">
          <div className="flex items-start justify-between gap-3">
            <div>
              <h1 className="text-3xl font-semibold tracking-tight text-foreground">
                {productName}
              </h1>
              <dl className="mt-4 grid gap-2 text-sm text-muted-foreground sm:grid-cols-2">
                <div>
                  <dt className="text-foreground">Raridade</dt>
                  <dd>
                    <Link
                      to={marketPath({ rarity: listing.product.rarity })}
                      className="underline-offset-2 hover:underline"
                    >
                      {listing.product.rarity}
                    </Link>
                  </dd>
                </div>
                <div>
                  <dt className="text-foreground">Coleção</dt>
                  <dd>
                    {listing.product.collection ? (
                      <Link
                        to={marketPath({ q: listing.product.collection })}
                        className="underline-offset-2 hover:underline"
                      >
                        {listing.product.collection}
                      </Link>
                    ) : (
                      "N/A"
                    )}
                  </dd>
                </div>
                <div>
                  <dt className="text-foreground">Arma</dt>
                  <dd>
                    <Link
                      to={marketPath({ weapon: listing.product.weapon })}
                      className="underline-offset-2 hover:underline"
                    >
                      {listing.product.weapon}
                    </Link>
                  </dd>
                </div>
                <div>
                  <dt className="text-foreground">Exterior</dt>
                  <dd>
                    <Link
                      to={marketPath({ exterior: listing.product.exterior })}
                      className="underline-offset-2 hover:underline"
                    >
                      {listing.product.exterior}
                    </Link>
                  </dd>
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
            <FavoriteButton listingId={listing.id} />
          </div>

          {sellerName ? (
            <div className="flex items-center gap-3 rounded-md border border-border bg-card p-4">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-muted text-sm font-medium text-muted-foreground">
                {sellerName[0]}
              </div>
              <div>
                <p className="text-sm font-medium text-foreground">
                  <Link
                    to={storeHref}
                    className="underline-offset-2 hover:underline"
                  >
                    {sellerName}
                  </Link>
                </p>
                {listing.seller.rating != null ? (
                  <p className="text-xs text-muted-foreground">
                    {SELLER_RATING_COPY}:{" "}
                    {Number(listing.seller.rating).toFixed(1)}
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
              Status: {listingStatusLabel(listing.status)}
            </p>
            {latestHistory ? (
              <p className="text-sm text-muted-foreground">
                Última alteração: ${Number(latestHistory.newPrice).toFixed(2)}
              </p>
            ) : null}
            <ListingCartCta
              listing={listing}
              variant="detail"
              source={source}
            />
          </div>

          <PriceHistorySection entries={priceHistory} />
        </div>
      </div>

      <ProductReviews productId={listing.productId} />

      {sameSkin.length > 0 ? (
        <section className="mt-12 border-t border-border pt-10">
          <h2 className="mb-4 text-xl font-semibold tracking-tight text-foreground">
            Outros listings desta skin
          </h2>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {sameSkin.map((item) => (
              <ListingCard key={item.id} listing={item} source="related" />
            ))}
          </div>
        </section>
      ) : null}

      {fallbackItems.length > 0 ? (
        <section className="mt-12 border-t border-border pt-10">
          <h2 className="mb-4 text-xl font-semibold tracking-tight text-foreground">
            {relatedFallbackHeading(fallbackKind)}
          </h2>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {fallbackItems.map((item) => (
              <ListingCard key={item.id} listing={item} source="related" />
            ))}
          </div>
        </section>
      ) : null}

      {sellerItems.length > 0 ? (
        <section className="mt-12 border-t border-border pt-10">
          <div className="mb-4 flex items-end justify-between gap-3">
            <h2 className="text-xl font-semibold tracking-tight text-foreground">
              {moreFromSellerHeading(
                listing.seller.storeName || sellerName || "esta loja",
              )}
            </h2>
            <Button asChild variant="outline" size="sm">
              <Link to={storeHref}>Ver loja</Link>
            </Button>
          </div>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {sellerItems.map((item) => (
              <ListingCard key={item.id} listing={item} source="related" />
            ))}
          </div>
        </section>
      ) : null}

      {recentlyViewed.length > 0 ? (
        <div className="mt-12 border-t border-border pt-10">
          <RecentlyViewedRail
            listings={recentlyViewed}
            headingId="pdp-recently-viewed-heading"
          />
        </div>
      ) : null}
    </div>
  );
}
