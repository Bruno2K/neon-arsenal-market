import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import { listProducts } from "@/api/products";
import { productDisplayName, SkinThumb } from "@/components/ProductCard";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  logTechnicalError,
  userFacingApiError,
} from "@/lib/userFacingApiError";
import type { Product } from "@/types/api";

export const CATALOG_PICKER_PAGE_SIZE = 20;
export const CATALOG_PICKER_SEARCH_DEBOUNCE_MS = 300;

export function ProductCatalogPicker({
  selectedProduct,
  onSelect,
  disabled = false,
  enabled = true,
}: {
  selectedProduct?: Product;
  onSelect: (product: Product) => void;
  disabled?: boolean;
  enabled?: boolean;
}) {
  const [query, setQuery] = useState("");
  const [items, setItems] = useState<Product[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!enabled || disabled) return;
    let cancelled = false;
    const trimmed = query.trim();
    const delay = trimmed === "" ? 0 : CATALOG_PICKER_SEARCH_DEBOUNCE_MS;
    const timer = window.setTimeout(() => {
      setLoading(true);
      setError(null);
      void listProducts({
        page: 1,
        limit: CATALOG_PICKER_PAGE_SIZE,
        ...(trimmed ? { search: trimmed } : {}),
      })
        .then((res) => {
          if (cancelled) return;
          setItems(res.items);
          setTotal(res.total);
          setPage(1);
        })
        .catch((e: unknown) => {
          if (cancelled) return;
          logTechnicalError(e);
          setError(userFacingApiError(e));
          setItems([]);
          setTotal(0);
        })
        .finally(() => {
          if (!cancelled) setLoading(false);
        });
    }, delay);
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [enabled, disabled, query]);

  const loadMore = async () => {
    const trimmed = query.trim();
    setLoadingMore(true);
    setError(null);
    try {
      const nextPage = page + 1;
      const res = await listProducts({
        page: nextPage,
        limit: CATALOG_PICKER_PAGE_SIZE,
        ...(trimmed ? { search: trimmed } : {}),
      });
      setItems((current) => {
        const seen = new Set(current.map((item) => item.id));
        return [...current, ...res.items.filter((item) => !seen.has(item.id))];
      });
      setTotal(res.total);
      setPage(nextPage);
    } catch (e) {
      logTechnicalError(e);
      setError(userFacingApiError(e));
    } finally {
      setLoadingMore(false);
    }
  };

  if (disabled) {
    return null;
  }

  const hasMore = items.length < total;

  return (
    <div className="grid gap-2">
      <Label htmlFor="product-catalog-search">Buscar no catálogo</Label>
      <Input
        id="product-catalog-search"
        type="search"
        value={query}
        onChange={(event) => setQuery(event.target.value)}
        placeholder="Arma, skin ou nome Steam (ex: AK-47 Redline)"
        autoComplete="off"
        aria-controls="product-catalog-results"
      />
      <p className="text-xs text-muted-foreground">
        O catálogo tem milhares de skins. Digite para filtrar; a lista não
        carrega o inventário inteiro de uma vez.
      </p>
      {error ? (
        <p className="text-sm text-destructive" role="alert">
          {error}
        </p>
      ) : null}
      <div
        id="product-catalog-results"
        role="listbox"
        aria-label="Produtos do catálogo"
        aria-busy={loading || undefined}
        className="max-h-64 overflow-y-auto rounded-md border border-border"
      >
        {loading ? (
          <div
            className="flex items-center justify-center gap-2 py-8 text-sm text-muted-foreground"
            role="status"
            aria-label="Carregando"
          >
            <Loader2 className="h-4 w-4 animate-spin" />
            Carregando catálogo
          </div>
        ) : items.length === 0 ? (
          <p className="px-3 py-6 text-center text-sm text-muted-foreground">
            Nenhum produto encontrado
          </p>
        ) : (
          <ul>
            {items.map((product) => {
              const selected = product.id === selectedProduct?.id;
              const name = productDisplayName(product);
              return (
                <li key={product.id}>
                  <button
                    type="button"
                    role="option"
                    aria-selected={selected}
                    aria-label={name}
                    className={`flex w-full items-center gap-2 px-3 py-2 text-left text-sm hover:bg-accent ${
                      selected ? "bg-accent" : ""
                    }`}
                    onClick={() => onSelect(product)}
                  >
                    <SkinThumb product={product} size="sm" decorative />
                    <span className="min-w-0 truncate">{name}</span>
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </div>
      {!loading && items.length > 0 ? (
        <div className="flex items-center justify-between gap-2 text-xs text-muted-foreground">
          <span className="tabular-nums">
            Mostrando {items.length} de {total}
          </span>
          {hasMore ? (
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => void loadMore()}
              disabled={loadingMore}
            >
              {loadingMore ? (
                <Loader2 className="mr-2 h-3 w-3 animate-spin" />
              ) : null}
              Carregar mais
            </Button>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
