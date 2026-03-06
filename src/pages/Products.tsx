import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Filter } from "lucide-react";
import { ListingCard } from "@/components/ProductCard";
import { listListings } from "@/api/listings";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

const EXTERIORS = [
  "",
  "Factory New",
  "Minimal Wear",
  "Field-Tested",
  "Well-Worn",
  "Battle-Scarred",
] as const;

export default function Products() {
  const [exterior, setExterior] = useState("");
  const [isStattrak, setIsStattrak] = useState<boolean | undefined>(undefined);
  const [sort, setSort] = useState("");
  const [page, setPage] = useState(1);
  const [minPrice, setMinPrice] = useState("");
  const [maxPrice, setMaxPrice] = useState("");

  const { data, isLoading, isError, error } = useQuery({
    queryKey: [
      "listings",
      { page, exterior, isStattrak, sort, minPrice, maxPrice },
    ],
    queryFn: () =>
      listListings({
        page,
        limit: 20,
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
      <h1 className="text-3xl font-heading text-foreground mb-6">Market</h1>

      <div className="flex flex-col gap-4 mb-8">
        {/* Exterior filter */}
        <div className="flex flex-col gap-1">
          <label className="text-xs font-heading text-muted-foreground">
            Exterior
          </label>
          <div className="flex flex-wrap gap-2">
            {EXTERIORS.map((ext) => (
              <Button
                key={ext || "all"}
                variant={exterior === ext ? "default" : "outline"}
                size="sm"
                onClick={() => {
                  setExterior(ext);
                  setPage(1);
                }}
              >
                {ext || "Todos"}
              </Button>
            ))}
          </div>
        </div>

        {/* StatTrak + Price row */}
        <div className="flex flex-col sm:flex-row gap-4 flex-wrap">
          <div className="flex flex-col gap-1">
            <label className="text-xs font-heading text-muted-foreground">
              StatTrak™
            </label>
            <div className="flex gap-2">
              {[
                { value: undefined, label: "Todos" },
                { value: true, label: "StatTrak™" },
                { value: false, label: "Normal" },
              ].map(({ value, label }) => (
                <Button
                  key={String(value)}
                  variant={isStattrak === value ? "default" : "outline"}
                  size="sm"
                  onClick={() => {
                    setIsStattrak(value);
                    setPage(1);
                  }}
                >
                  {label}
                </Button>
              ))}
            </div>
          </div>

          <div className="flex flex-col gap-1">
            <label className="text-xs font-heading text-muted-foreground">
              Faixa de Preço (USD)
            </label>
            <div className="flex gap-2 items-center">
              <Input
                type="number"
                placeholder="Mín"
                value={minPrice}
                onChange={(e) => setMinPrice(e.target.value)}
                className="w-24"
              />
              <span className="text-muted-foreground text-sm">–</span>
              <Input
                type="number"
                placeholder="Máx"
                value={maxPrice}
                onChange={(e) => setMaxPrice(e.target.value)}
                className="w-24"
              />
              <Button size="sm" variant="outline" onClick={() => setPage(1)}>
                <Filter className="h-3 w-3 mr-1" />
                Filtrar
              </Button>
            </div>
          </div>
        </div>

        {/* Sort row */}
        <div>
          <label className="text-xs font-heading text-muted-foreground mb-2 block">
            Ordenar
          </label>
          <div className="flex flex-wrap gap-2">
            {[
              { value: "", label: "Padrão" },
              { value: "price-asc", label: "Menor Preço" },
              { value: "price-desc", label: "Maior Preço" },
              { value: "float-asc", label: "Menor Float" },
              { value: "float-desc", label: "Maior Float" },
            ].map(({ value, label }) => (
              <Button
                key={value}
                variant={sort === value ? "default" : "outline"}
                size="sm"
                onClick={() => setSort(value)}
              >
                {label}
              </Button>
            ))}
          </div>
        </div>
      </div>

      {isLoading && <p className="text-muted-foreground py-8">Carregando...</p>}
      {isError && (
        <div className="py-8 text-center">
          <p className="text-destructive font-heading">
            {error instanceof Error
              ? error.message
              : "Erro ao carregar listings"}
          </p>
        </div>
      )}
      {!isLoading && !isError && (
        <>
          <p className="text-sm text-muted-foreground mb-4">
            {total} resultado{total !== 1 ? "s" : ""}
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
            {sortedItems.map((listing) => (
              <ListingCard key={listing.id} listing={listing} />
            ))}
          </div>
          {sortedItems.length === 0 && (
            <div className="text-center py-20 text-muted-foreground">
              <p className="font-heading text-lg">Nenhum item encontrado</p>
              <p className="text-sm mt-2">Tente ajustar os filtros</p>
            </div>
          )}
          {total > 20 && (
            <div className="flex justify-center gap-2 mt-8">
              <Button
                variant="outline"
                size="sm"
                disabled={page === 1}
                onClick={() => setPage((p) => p - 1)}
              >
                Anterior
              </Button>
              <span className="text-sm text-muted-foreground self-center">
                Página {page}
              </span>
              <Button
                variant="outline"
                size="sm"
                disabled={page * 20 >= total}
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
