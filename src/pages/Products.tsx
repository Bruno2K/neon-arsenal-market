import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Filter } from "lucide-react";
import { ListingCard } from "@/components/ProductCard";
import { EmptyState, ErrorState } from "@/components/page-state";
import { listListings } from "@/api/listings";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";

const EXTERIORS = [
  "",
  "Factory New",
  "Minimal Wear",
  "Field-Tested",
  "Well-Worn",
  "Battle-Scarred",
] as const;

const SORTS = [
  { value: "", label: "Padrão" },
  { value: "price-asc", label: "Menor Preço" },
  { value: "price-desc", label: "Maior Preço" },
  { value: "float-asc", label: "Menor Float" },
  { value: "float-desc", label: "Maior Float" },
] as const;

const PAGE_SIZE = 20;

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

export default function Products() {
  const [exterior, setExterior] = useState("");
  const [isStattrak, setIsStattrak] = useState<boolean | undefined>(undefined);
  const [sort, setSort] = useState("");
  const [page, setPage] = useState(1);
  const [minPrice, setMinPrice] = useState("");
  const [maxPrice, setMaxPrice] = useState("");

  const { data, isLoading, isError, error, refetch } = useQuery({
    queryKey: [
      "listings",
      { page, exterior, isStattrak, sort, minPrice, maxPrice },
    ],
    queryFn: () =>
      listListings({
        page,
        limit: PAGE_SIZE,
        status: "ACTIVE",
        ...(exterior ? { exterior } : {}),
        ...(isStattrak !== undefined ? { isStattrak } : {}),
        ...(minPrice ? { minPrice: parseFloat(minPrice) } : {}),
        ...(maxPrice ? { maxPrice: parseFloat(maxPrice) } : {}),
      }),
  });

  const items = data?.items ?? [];
  const total = data?.total ?? 0;

  const sortedItems =
    sort === "price-asc"
      ? [...items].sort((a, b) => Number(a.price) - Number(b.price))
      : sort === "price-desc"
        ? [...items].sort((a, b) => Number(b.price) - Number(a.price))
        : sort === "float-asc"
          ? [...items].sort(
              (a, b) => Number(a.floatValue) - Number(b.floatValue),
            )
          : sort === "float-desc"
            ? [...items].sort(
                (a, b) => Number(b.floatValue) - Number(a.floatValue),
              )
            : items;

  return (
    <div className="container py-8">
      <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Market</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Listings ativos · item único
          </p>
        </div>
        {!isLoading && !isError ? (
          <p className="text-sm tabular-nums text-muted-foreground">
            {total} resultado{total !== 1 ? "s" : ""}
          </p>
        ) : null}
      </div>

      <div className="mb-8 space-y-4 border-b border-border pb-6">
        <fieldset className="space-y-1.5">
          <legend className="text-xs text-muted-foreground">Exterior</legend>
          <div className="flex flex-wrap gap-1.5">
            {EXTERIORS.map((ext) => (
              <Chip
                key={ext || "all"}
                active={exterior === ext}
                onClick={() => {
                  setExterior(ext);
                  setPage(1);
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
                  active={isStattrak === value}
                  onClick={() => {
                    setIsStattrak(value);
                    setPage(1);
                  }}
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
                value={minPrice}
                onChange={(e) => setMinPrice(e.target.value)}
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
                value={maxPrice}
                onChange={(e) => setMaxPrice(e.target.value)}
                className="w-24"
              />
              <Button size="sm" variant="outline" onClick={() => setPage(1)}>
                <Filter className="mr-1 h-3 w-3" />
                Filtrar
              </Button>
            </div>
          </fieldset>
        </div>

        <fieldset className="space-y-1.5">
          <legend className="text-xs text-muted-foreground">Ordenar</legend>
          <div className="flex flex-wrap gap-1.5">
            {SORTS.map(({ value, label }) => (
              <Chip
                key={value || "default"}
                active={sort === value}
                onClick={() => setSort(value)}
              >
                {label}
              </Chip>
            ))}
          </div>
        </fieldset>
      </div>

      {isLoading && (
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
      )}

      {!isLoading && !isError && sortedItems.length === 0 && (
        <EmptyState
          title="Nenhum item encontrado"
          description="Tente ajustar os filtros"
        />
      )}

      {!isLoading && !isError && sortedItems.length > 0 && (
        <>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
            {sortedItems.map((listing) => (
              <ListingCard key={listing.id} listing={listing} />
            ))}
          </div>
          {total > PAGE_SIZE && (
            <div className="mt-8 flex justify-center gap-2">
              <Button
                variant="outline"
                size="sm"
                disabled={page === 1}
                onClick={() => setPage((p) => p - 1)}
              >
                Anterior
              </Button>
              <span className="self-center text-sm tabular-nums text-muted-foreground">
                Página {page}
              </span>
              <Button
                variant="outline"
                size="sm"
                disabled={page * PAGE_SIZE >= total}
                onClick={() => setPage((p) => p + 1)}
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
