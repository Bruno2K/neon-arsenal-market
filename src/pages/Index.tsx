import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { ListingCard } from "@/components/ProductCard";
import { RecentlyViewedRail } from "@/components/RecentlyViewedRail";
import { EmptyState, ErrorState } from "@/components/page-state";
import { listListings } from "@/api/listings";
import { listProducts } from "@/api/products";
import { listSellers } from "@/api/sellers";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { MARKET_VIEW_CTA } from "@/lib/listingCartCta";
import { track } from "@/lib/analytics";
import { useRecentlyViewedListings } from "@/hooks/useRecentlyViewedListings";
import {
  HOME_EMPTY_DESCRIPTION,
  HOME_EMPTY_TITLE,
  HOME_EXTERIOR_LINKS,
  HOME_LISTING_RAIL_LIMIT,
  HOME_NEW_HEADING,
  HOME_NEW_SORT_COPY,
  HOME_SELLER_CTA,
  HOME_SHORTCUTS_COPY,
  HOME_SHORTCUTS_HEADING,
  HOME_TRUST_HEADING,
  HOME_TRUST_ITEMS,
  HOME_VALUE_PROP,
  approvedSellersCountLabel,
  catalogDiscoveryLinks,
  listingsCountLabel,
} from "@/lib/homeDiscovery";

export default function IndexPage() {
  const listingsQuery = useQuery({
    queryKey: [
      "listings",
      { status: "ACTIVE", limit: HOME_LISTING_RAIL_LIMIT },
    ],
    queryFn: () =>
      listListings({ status: "ACTIVE", limit: HOME_LISTING_RAIL_LIMIT }),
  });
  const productsQuery = useQuery({
    queryKey: ["products", { limit: 24 }],
    queryFn: () => listProducts({ limit: 24 }),
  });
  const sellersQuery = useQuery({
    queryKey: ["sellers", { approved: true }],
    queryFn: () => listSellers({ approved: true }),
  });

  const listings = listingsQuery.data?.items ?? [];
  const listingsTotal = listingsQuery.data?.total;
  const approvedSellerCount = sellersQuery.data?.length;
  const shortcuts = catalogDiscoveryLinks(productsQuery.data?.items ?? []);
  const recentlyViewed = useRecentlyViewedListings();

  return (
    <div className="container space-y-12 py-10">
      <header className="max-w-2xl">
        <h1 className="text-3xl font-semibold tracking-tight">Neon Arsenal</h1>
        <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
          {HOME_VALUE_PROP}
        </p>
        <div className="mt-6 flex flex-wrap gap-3">
          <Button asChild>
            <Link to="/products">{MARKET_VIEW_CTA}</Link>
          </Button>
          <Button asChild variant="outline">
            <Link to="/register">{HOME_SELLER_CTA}</Link>
          </Button>
        </div>
        {(!listingsQuery.isLoading && listingsTotal != null) ||
        approvedSellerCount != null ? (
          <p className="mt-4 flex flex-wrap gap-x-3 text-sm tabular-nums text-muted-foreground">
            {!listingsQuery.isLoading && listingsTotal != null ? (
              <span>{listingsCountLabel(listingsTotal)}</span>
            ) : null}
            {approvedSellerCount != null ? (
              <span>{approvedSellersCountLabel(approvedSellerCount)}</span>
            ) : null}
          </p>
        ) : null}
      </header>

      <section aria-labelledby="home-shortcuts-heading">
        <h2
          id="home-shortcuts-heading"
          className="text-xl font-semibold tracking-tight"
        >
          {HOME_SHORTCUTS_HEADING}
        </h2>
        <p className="mt-1 text-sm text-muted-foreground">
          {HOME_SHORTCUTS_COPY}
        </p>
        {productsQuery.isLoading ? (
          <div
            className="mt-4 flex flex-wrap gap-2"
            role="status"
            aria-label="Carregando atalhos"
          >
            {Array.from({ length: 4 }).map((_, i) => (
              <Skeleton key={i} className="h-11 w-36" />
            ))}
          </div>
        ) : (
          <div className="mt-4 flex flex-wrap gap-2">
            <Button asChild variant="outline" size="sm">
              <Link to="/products">{MARKET_VIEW_CTA}</Link>
            </Button>
            {HOME_EXTERIOR_LINKS.map((shortcut) => (
              <Button
                key={shortcut.exterior}
                asChild
                variant="outline"
                size="sm"
              >
                <Link
                  to={shortcut.href}
                  onClick={() =>
                    track("category_view", {
                      category: shortcut.exterior,
                      source: "home",
                    })
                  }
                >
                  {shortcut.label}
                </Link>
              </Button>
            ))}
            {shortcuts.map((shortcut) => (
              <Button
                key={shortcut.productId}
                asChild
                variant="outline"
                size="sm"
              >
                <Link
                  to={shortcut.href}
                  onClick={() =>
                    track("category_view", {
                      productId: shortcut.productId,
                      source: "home",
                    })
                  }
                >
                  {shortcut.label}
                </Link>
              </Button>
            ))}
          </div>
        )}
      </section>

      <RecentlyViewedRail listings={recentlyViewed} />

      <section aria-labelledby="home-new-heading">
        <h2
          id="home-new-heading"
          className="text-xl font-semibold tracking-tight"
        >
          {HOME_NEW_HEADING}
        </h2>
        <p className="mt-1 text-sm text-muted-foreground">
          {HOME_NEW_SORT_COPY}
        </p>

        {listingsQuery.isLoading ? (
          <div
            className="mt-6 grid grid-cols-1 gap-3 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4"
            role="status"
            aria-label="Carregando"
          >
            {Array.from({ length: HOME_LISTING_RAIL_LIMIT }).map((_, i) => (
              <Skeleton key={i} className="h-64 w-full" />
            ))}
          </div>
        ) : null}

        {listingsQuery.isError ? (
          <ErrorState
            title="Erro ao carregar listings"
            error={listingsQuery.error}
            action={
              <Button
                type="button"
                variant="outline"
                onClick={() => listingsQuery.refetch()}
              >
                Tentar novamente
              </Button>
            }
          />
        ) : null}

        {!listingsQuery.isLoading &&
        !listingsQuery.isError &&
        listings.length === 0 ? (
          <EmptyState
            title={HOME_EMPTY_TITLE}
            description={HOME_EMPTY_DESCRIPTION}
            action={
              <Button asChild>
                <Link to="/register">{HOME_SELLER_CTA}</Link>
              </Button>
            }
          />
        ) : null}

        {!listingsQuery.isLoading &&
        !listingsQuery.isError &&
        listings.length > 0 ? (
          <div className="mt-6 grid grid-cols-1 gap-3 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
            {listings.map((listing) => (
              <ListingCard key={listing.id} listing={listing} source="home" />
            ))}
          </div>
        ) : null}
      </section>

      <section
        aria-labelledby="home-trust-heading"
        className="max-w-2xl border-t border-border pt-10"
      >
        <h2
          id="home-trust-heading"
          className="text-xl font-semibold tracking-tight"
        >
          {HOME_TRUST_HEADING}
        </h2>
        <ul className="mt-4 space-y-3 text-sm leading-relaxed text-muted-foreground">
          {HOME_TRUST_ITEMS.map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ul>
      </section>
    </div>
  );
}
