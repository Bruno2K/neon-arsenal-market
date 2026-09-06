import { useEffect, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { Filter } from "lucide-react";
import { ListingCard } from "@/components/ProductCard";
import { EmptyState, ErrorState } from "@/components/page-state";
import {
  MARKET_SIMILAR_EMPTY_DESCRIPTION,
  MARKET_SIMILAR_EMPTY_TITLE,
  MARKET_VIEW_CTA,
} from "@/lib/listingCartCta";
import { fetchMarketListings } from "@/lib/marketListings";
import { MARKET_RARITIES, MARKET_WEAPONS } from "@/lib/catalogTaxonomy";
import {
  MARKET_CATALOG_EMPTY_DESCRIPTION,
  MARKET_CATALOG_EMPTY_TITLE,
  MARKET_EXTERIORS,
  MARKET_FILTERS_EMPTY_TITLE,
  MARKET_FLOAT_HINT,
  MARKET_FLOAT_RANGE_ERROR,
  MARKET_PAGE_SIZE,
  MARKET_SEARCH_DEBOUNCE_MS,
  MARKET_SORTS,
  MARKET_SORT_DEFAULT_COPY,
  describeMarketFilters,
  hasActiveMarketConstraints,
  hasMarketFilters,
  isValidNumericRange,
  marketPath,
  marketSearchEmptyTitle,
  parseMarketQuery,
  serializeMarketQuery,
  type MarketQuery,
} from "@/lib/marketQuery";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";
import { marketSearchQuery, track } from "@/lib/analytics";

function Chip({
  active,
  children,
  onClick,
}: {
  active: boolean;
  children: string;
  onClick: () => void;
}) {
  return (
    <Button
      type="button"
      variant={active ? "default" : "outline"}
      size="sm"
      aria-pressed={active}
      onClick={onClick}
    >
      {children}
    </Button>
  );
}

function ExteriorShortcuts({
  onPick,
}: {
  onPick?: (exterior: string) => void;
}) {
  return (
    <div className="flex flex-wrap justify-center gap-1.5">
      {MARKET_EXTERIORS.filter(Boolean).map((ext) => (
        <Button key={ext} size="sm" variant="outline" asChild>
          <Link
            to={marketPath({ exterior: ext })}
            onClick={() => onPick?.(ext)}
          >
            {ext}
          </Link>
        </Button>
      ))}
    </div>
  );
}

export default function Products() {
  const [searchParams, setSearchParams] = useSearchParams();
  const query = parseMarketQuery(searchParams);
  const [searchDraft, setSearchDraft] = useState(query.q);
  const [minPriceDraft, setMinPriceDraft] = useState(query.minPrice);
  const [maxPriceDraft, setMaxPriceDraft] = useState(query.maxPrice);
  const [minFloatDraft, setMinFloatDraft] = useState(query.minFloat);
  const [maxFloatDraft, setMaxFloatDraft] = useState(query.maxFloat);
  const [floatRangeError, setFloatRangeError] = useState<string | null>(null);

  useEffect(() => {
    setSearchDraft(query.q);
  }, [query.q]);

  useEffect(() => {
    setMinPriceDraft(query.minPrice);
    setMaxPriceDraft(query.maxPrice);
    setMinFloatDraft(query.minFloat);
    setMaxFloatDraft(query.maxFloat);
  }, [query.minPrice, query.maxPrice, query.minFloat, query.maxFloat]);

  useEffect(() => {
    const handle = window.setTimeout(() => {
      const next = searchDraft.trim();
      setSearchParams(
        (prev) => {
          const current = parseMarketQuery(prev);
          if (next === current.q) return prev;
          return serializeMarketQuery({ ...current, q: next, page: 1 });
        },
        { replace: true },
      );
    }, MARKET_SEARCH_DEBOUNCE_MS);
    return () => window.clearTimeout(handle);
  }, [searchDraft, setSearchParams]);

  const writeQuery = (
    patch: Partial<MarketQuery>,
    history: { replace?: boolean } = {},
  ) => {
    setSearchParams(
      (prev) => serializeMarketQuery({ ...parseMarketQuery(prev), ...patch }),
      history,
    );
  };

  const rangeValid = isValidNumericRange(query.minFloat, query.maxFloat);
  const { data, isLoading, isError, error, refetch } = useQuery({
    queryKey: ["listings", "market", query],
    queryFn: () => fetchMarketListings(query),
    enabled: rangeValid,
  });

  const items = data?.items ?? [];
  const total = data?.total ?? 0;
  const searchQuery = marketSearchQuery({
    q: query.q || undefined,
    productId: query.productId,
    exterior: query.exterior || undefined,
    isStattrak: query.isStattrak,
    minPrice: query.minPrice || undefined,
    maxPrice: query.maxPrice || undefined,
  });

  useEffect(() => {
    if (!searchQuery || isLoading || isError || !rangeValid) return;
    track("search", {
      query: searchQuery,
      productId: query.productId,
      source: "market",
      resultCount: total,
    });
  }, [searchQuery, query.productId, isLoading, isError, total, rangeValid]);

  const applyPriceFloat = () => {
    const minF = minFloatDraft.trim();
    const maxF = maxFloatDraft.trim();
    if (!isValidNumericRange(minF, maxF)) {
      setFloatRangeError(MARKET_FLOAT_RANGE_ERROR);
      return;
    }
    setFloatRangeError(null);
    writeQuery(
      {
        minPrice: minPriceDraft.trim(),
        maxPrice: maxPriceDraft.trim(),
        minFloat: minF,
        maxFloat: maxF,
        page: 1,
      },
      { replace: true },
    );
  };

  const clearFilters = () => {
    setFloatRangeError(null);
    setSearchParams(new URLSearchParams());
  };

  const clearSearch = () => {
    writeQuery({ q: "", page: 1 }, { replace: true });
  };

  const filterSummary = describeMarketFilters(query);
  const filteredEmpty = hasActiveMarketConstraints(query);

  return (
    <div className="container py-8">
      <Breadcrumb className="mb-4">
        <BreadcrumbList>
          <BreadcrumbItem>
            <BreadcrumbLink asChild>
              <Link to="/">Home</Link>
            </BreadcrumbLink>
          </BreadcrumbItem>
          <BreadcrumbSeparator />
          <BreadcrumbItem>
            {query.q ? (
              <BreadcrumbLink asChild>
                <Link to="/products">Market</Link>
              </BreadcrumbLink>
            ) : (
              <BreadcrumbPage>Market</BreadcrumbPage>
            )}
          </BreadcrumbItem>
          {query.q ? (
            <>
              <BreadcrumbSeparator />
              <BreadcrumbItem>
                <BreadcrumbPage>{query.q}</BreadcrumbPage>
              </BreadcrumbItem>
            </>
          ) : null}
        </BreadcrumbList>
      </Breadcrumb>

      <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Market</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {query.productId
              ? "Listings ativos desta skin · item único"
              : "Listings ativos · item único"}
          </p>
        </div>
        {!isLoading && !isError && rangeValid ? (
          <p className="text-sm tabular-nums text-muted-foreground">
            {query.q
              ? `${total} resultado${total !== 1 ? "s" : ""} para ${query.q}`
              : `${total} resultado${total !== 1 ? "s" : ""}`}
          </p>
        ) : null}
      </div>

      <div className="mb-8 space-y-4 border-b border-border pb-6">
        <div className="space-y-1.5">
          <Label htmlFor="market-search">Buscar</Label>
          <Input
            id="market-search"
            type="search"
            value={searchDraft}
            onChange={(event) => setSearchDraft(event.target.value)}
            placeholder="Arma, skin ou coleção"
            autoComplete="off"
            aria-label="Buscar no Market"
          />
        </div>

        <fieldset className="space-y-1.5">
          <legend className="text-xs text-muted-foreground">Arma</legend>
          <div className="flex flex-wrap gap-1.5">
            <Chip
              active={!query.weapon}
              onClick={() => writeQuery({ weapon: "", page: 1 })}
            >
              Todas
            </Chip>
            {MARKET_WEAPONS.map((weapon) => (
              <Chip
                key={weapon}
                active={query.weapon === weapon}
                onClick={() => writeQuery({ weapon, page: 1 })}
              >
                {weapon}
              </Chip>
            ))}
          </div>
        </fieldset>

        <fieldset className="space-y-1.5">
          <legend className="text-xs text-muted-foreground">Raridade</legend>
          <div className="flex flex-wrap gap-1.5">
            <Chip
              active={!query.rarity}
              onClick={() => writeQuery({ rarity: "", page: 1 })}
            >
              Todas
            </Chip>
            {MARKET_RARITIES.map((rarity) => (
              <Chip
                key={rarity}
                active={query.rarity === rarity}
                onClick={() => writeQuery({ rarity, page: 1 })}
              >
                {rarity}
              </Chip>
            ))}
          </div>
        </fieldset>

        <fieldset className="space-y-1.5">
          <legend className="text-xs text-muted-foreground">Exterior</legend>
          <div className="flex flex-wrap gap-1.5">
            {MARKET_EXTERIORS.map((ext) => (
              <Chip
                key={ext || "all"}
                active={query.exterior === ext}
                onClick={() => {
                  writeQuery({ exterior: ext, page: 1 });
                  if (ext) {
                    track("category_view", {
                      category: ext,
                      source: "market",
                    });
                  }
                }}
              >
                {ext || "Todos"}
              </Chip>
            ))}
          </div>
        </fieldset>

        <div className="flex flex-col gap-4 sm:flex-row sm:flex-wrap">
          <fieldset className="space-y-1.5">
            <legend className="text-xs text-muted-foreground">StatTrak™</legend>
            <div className="flex flex-wrap gap-1.5">
              {(
                [
                  { value: undefined, label: "Todos" },
                  { value: true, label: "StatTrak™" },
                  { value: false, label: "Normal" },
                ] as const
              ).map(({ value, label }) => (
                <Chip
                  key={String(value)}
                  active={query.isStattrak === value}
                  onClick={() => writeQuery({ isStattrak: value, page: 1 })}
                >
                  {label}
                </Chip>
              ))}
            </div>
          </fieldset>

          <fieldset className="space-y-1.5">
            <legend className="text-xs text-muted-foreground">
              Faixa de Preço (USD)
            </legend>
            <div className="flex items-center gap-2">
              <Label htmlFor="minPrice" className="sr-only">
                Preço mínimo
              </Label>
              <Input
                id="minPrice"
                type="number"
                placeholder="Mín"
                value={minPriceDraft}
                onChange={(e) => setMinPriceDraft(e.target.value)}
                className="w-24"
              />
              <span className="text-sm text-muted-foreground">–</span>
              <Label htmlFor="maxPrice" className="sr-only">
                Preço máximo
              </Label>
              <Input
                id="maxPrice"
                type="number"
                placeholder="Máx"
                value={maxPriceDraft}
                onChange={(e) => setMaxPriceDraft(e.target.value)}
                className="w-24"
              />
            </div>
          </fieldset>

          <fieldset className="space-y-1.5">
            <legend className="text-xs text-muted-foreground">
              Float ({MARKET_FLOAT_HINT})
            </legend>
            <div className="flex items-center gap-2">
              <Label htmlFor="minFloat" className="sr-only">
                Float mínimo
              </Label>
              <Input
                id="minFloat"
                type="number"
                step="0.01"
                min="0"
                max="1"
                placeholder="0.00"
                value={minFloatDraft}
                onChange={(e) => {
                  setMinFloatDraft(e.target.value);
                  setFloatRangeError(null);
                }}
                className="w-24"
                aria-invalid={floatRangeError ? true : undefined}
                aria-describedby="float-hint"
              />
              <span className="text-sm text-muted-foreground">–</span>
              <Label htmlFor="maxFloat" className="sr-only">
                Float máximo
              </Label>
              <Input
                id="maxFloat"
                type="number"
                step="0.01"
                min="0"
                max="1"
                placeholder="1.00"
                value={maxFloatDraft}
                onChange={(e) => {
                  setMaxFloatDraft(e.target.value);
                  setFloatRangeError(null);
                }}
                className="w-24"
                aria-invalid={floatRangeError ? true : undefined}
              />
              <Button
                size="sm"
                variant="outline"
                type="button"
                onClick={applyPriceFloat}
              >
                <Filter className="mr-1 h-3 w-3" />
                Filtrar
              </Button>
            </div>
            <p id="float-hint" className="text-xs text-muted-foreground">
              {MARKET_FLOAT_HINT}
            </p>
            {floatRangeError || !rangeValid ? (
              <p className="text-sm text-destructive" role="alert">
                {floatRangeError ?? MARKET_FLOAT_RANGE_ERROR}
              </p>
            ) : null}
          </fieldset>
        </div>

        <fieldset className="space-y-1.5">
          <legend className="text-xs text-muted-foreground">
            Ordenar ({MARKET_SORT_DEFAULT_COPY} no servidor)
          </legend>
          <div className="flex flex-wrap gap-1.5">
            {MARKET_SORTS.map(({ value, label }) => (
              <Chip
                key={value || "default"}
                active={query.sort === value}
                onClick={() => writeQuery({ sort: value, page: 1 })}
              >
                {label}
              </Chip>
            ))}
          </div>
        </fieldset>

        {hasMarketFilters(query) ? (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={clearFilters}
          >
            Limpar filtros
          </Button>
        ) : null}
      </div>

      {isLoading && rangeValid && (
        <div
          className="grid grid-cols-1 gap-3 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4"
          role="status"
          aria-label="Carregando"
        >
          {Array.from({ length: 8 }).map((_, i) => (
            <Skeleton key={i} className="h-64 w-full" />
          ))}
        </div>
      )}

      {isError && (
        <ErrorState
          title="Erro ao carregar listings"
          error={error}
          action={
            <Button type="button" variant="outline" onClick={() => refetch()}>
              Tentar novamente
            </Button>
          }
        />
      )}

      {!isLoading &&
        !isError &&
        rangeValid &&
        items.length === 0 &&
        (query.q ? (
          <EmptyState
            title={marketSearchEmptyTitle(query.q)}
            description="Tente outro termo, limpe a busca ou escolha um exterior."
            action={
              <div className="flex flex-col items-center gap-3">
                <div className="flex flex-wrap justify-center gap-2">
                  <Button type="button" variant="outline" onClick={clearSearch}>
                    Limpar busca
                  </Button>
                  <Button asChild>
                    <Link to="/products">Explorar Market</Link>
                  </Button>
                </div>
                <ExteriorShortcuts />
              </div>
            }
          />
        ) : query.productId ? (
          <EmptyState
            title={MARKET_SIMILAR_EMPTY_TITLE}
            description={MARKET_SIMILAR_EMPTY_DESCRIPTION}
            action={
              <Button asChild>
                <Link to="/products">{MARKET_VIEW_CTA}</Link>
              </Button>
            }
          />
        ) : filteredEmpty ? (
          <EmptyState
            title={MARKET_FILTERS_EMPTY_TITLE}
            description={
              filterSummary.length > 0
                ? `Nenhum listing para ${filterSummary.join(", ")}.`
                : "Nenhum listing combina com os filtros ativos."
            }
            action={
              <div className="flex flex-col items-center gap-3">
                <Button type="button" variant="outline" onClick={clearFilters}>
                  Limpar filtros
                </Button>
                <ExteriorShortcuts />
              </div>
            }
          />
        ) : (
          <EmptyState
            title={MARKET_CATALOG_EMPTY_TITLE}
            description={MARKET_CATALOG_EMPTY_DESCRIPTION}
          />
        ))}

      {!isLoading && !isError && rangeValid && items.length > 0 && (
        <>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
            {items.map((listing) => (
              <ListingCard key={listing.id} listing={listing} source="market" />
            ))}
          </div>
          {total > MARKET_PAGE_SIZE && (
            <div className="mt-8 flex justify-center gap-2">
              <Button
                variant="outline"
                size="sm"
                disabled={query.page === 1}
                onClick={() => writeQuery({ page: query.page - 1 })}
              >
                Anterior
              </Button>
              <span className="self-center text-sm tabular-nums text-muted-foreground">
                Página {query.page}
              </span>
              <Button
                variant="outline"
                size="sm"
                disabled={query.page * MARKET_PAGE_SIZE >= total}
                onClick={() => writeQuery({ page: query.page + 1 })}
              >
                Próxima
              </Button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
