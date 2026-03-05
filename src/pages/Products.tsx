// ─── Page: Products ───────────────────────────────────────────────────────────
// Replaces mock-data with real API via useProducts hook.
// Server-side: search, category filter, pagination. Client-side: price sort.

import { useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Filter, Search, ChevronLeft, ChevronRight, AlertCircle, X } from 'lucide-react';
import { motion } from 'framer-motion';
import { ProductCard } from '@/components/ProductCard';
import { ProductGridSkeleton } from '@/components/ProductCardSkeleton';
import { useProducts } from '@/application/hooks/products/useProducts';
import type { ProductCategory } from '@/domain/products/entities/Product';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

const LIMIT = 12;

type SortOption = '' | 'price-asc' | 'price-desc';

const sortLabels: Record<SortOption, string> = {
  '': 'Padrão',
  'price-asc': 'Menor Preço',
  'price-desc': 'Maior Preço',
};

const CATEGORIES: { value: ProductCategory; label: string }[] = [
  { value: 'rifles',   label: '🔫 Rifles'   },
  { value: 'pistols',  label: '🔫 Pistolas'  },
  { value: 'knives',   label: '🔪 Facas'     },
  { value: 'gloves',   label: '🧤 Luvas'     },
  { value: 'accounts', label: '🎮 Contas'    },
  { value: 'services', label: '⚙️ Serviços'  },
  { value: 'other',    label: '📦 Outros'    },
];

export default function Products() {
  const [searchParams] = useSearchParams();

  const [search, setSearch] = useState(searchParams.get('search') ?? '');
  const [debouncedSearch, setDebouncedSearch] = useState(search);
  const [category, setCategory] = useState<ProductCategory | undefined>(undefined);
  const [sort, setSort] = useState<SortOption>('');
  const [page, setPage] = useState(1);
  const [showFilters, setShowFilters] = useState(false);

  // Debounce search to avoid hammering the API on every keystroke
  const handleSearchChange = (value: string) => {
    setSearch(value);
    clearTimeout((window as unknown as Record<string, number>)._searchTimer);
    (window as unknown as Record<string, number>)._searchTimer = window.setTimeout(() => {
      setDebouncedSearch(value);
      setPage(1);
    }, 400);
  };

  const handleCategoryClick = (cat: ProductCategory) => {
    setCategory(prev => prev === cat ? undefined : cat);
    setPage(1);
  };

  const { data, isLoading, isError } = useProducts({
    search: debouncedSearch || undefined,
    category,
    page,
    limit: LIMIT,
  });

  // Client-side sort on the current page results
  const items = [...(data?.items ?? [])].sort((a, b) => {
    if (sort === 'price-asc') return a.price - b.price;
    if (sort === 'price-desc') return b.price - a.price;
    return 0;
  });

  const totalPages = data ? Math.ceil(data.total / LIMIT) : 0;

  return (
    <div className="container py-8">
      <h1 className="text-3xl font-heading text-foreground mb-6">Market</h1>

      {/* Category chips */}
      <div className="flex flex-wrap gap-2 mb-4">
        {CATEGORIES.map(cat => (
          <button
            key={cat.value}
            onClick={() => handleCategoryClick(cat.value)}
            className={`text-xs font-heading px-3 py-1.5 rounded-full border transition-colors ${
              category === cat.value
                ? 'bg-primary text-primary-foreground border-primary'
                : 'bg-card text-muted-foreground border-border hover:border-primary/40 hover:text-foreground'
            }`}
          >
            {cat.label}
          </button>
        ))}
        {category && (
          <button
            onClick={() => { setCategory(undefined); setPage(1); }}
            className="text-xs font-heading px-3 py-1.5 rounded-full border border-destructive/40 text-destructive hover:bg-destructive/10 transition-colors flex items-center gap-1"
          >
            <X className="h-3 w-3" /> Limpar
          </button>
        )}
      </div>

      {/* Search & filter bar */}
      <div className="flex flex-col sm:flex-row gap-4 mb-8">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Buscar skins, contas, serviços..."
            value={search}
            onChange={e => handleSearchChange(e.target.value)}
            className="pl-10"
          />
        </div>
        <Button
          variant="outline"
          onClick={() => setShowFilters(!showFilters)}
          className="sm:w-auto"
        >
          <Filter className="h-4 w-4 mr-2" /> Filtros
        </Button>
      </div>

      {/* Filters panel */}
      {showFilters && (
        <motion.div
          initial={{ opacity: 0, height: 0 }}
          animate={{ opacity: 1, height: 'auto' }}
          className="mb-8 p-4 rounded-lg border border-border bg-card space-y-4"
        >
          <div>
            <label className="text-xs font-heading text-muted-foreground mb-2 block">
              Ordenar por Preço
            </label>
            <div className="flex flex-wrap gap-2">
              {(Object.keys(sortLabels) as SortOption[]).map(s => (
                <Button
                  key={s}
                  variant={sort === s ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setSort(s)}
                >
                  {sortLabels[s]}
                </Button>
              ))}
            </div>
          </div>
        </motion.div>
      )}

      {/* Loading state */}
      {isLoading && <ProductGridSkeleton count={12} />}

      {/* Error state */}
      {isError && (
        <div className="flex items-center gap-2 text-destructive bg-destructive/10 border border-destructive/20 rounded-lg px-4 py-3 mb-6">
          <AlertCircle className="h-5 w-5 flex-shrink-0" />
          <span className="text-sm">Não foi possível carregar os produtos. Verifique a conexão com o servidor.</span>
        </div>
      )}

      {/* Results */}
      {!isLoading && !isError && (
        <>
          <p className="text-sm text-muted-foreground mb-4">
            {data?.total ?? 0} resultado{(data?.total ?? 0) !== 1 ? 's' : ''}
          </p>

          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
            {items.map(p => (
              <ProductCard key={p.id} product={p} />
            ))}
          </div>

          {items.length === 0 && (
            <div className="text-center py-20 text-muted-foreground">
              <p className="font-heading text-lg">Nenhum item encontrado</p>
              <p className="text-sm mt-2">Tente ajustar a busca</p>
            </div>
          )}

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-center gap-2 mt-10">
              <Button
                variant="outline"
                size="icon"
                disabled={page === 1}
                onClick={() => setPage(p => p - 1)}
              >
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <span className="text-sm text-muted-foreground px-3">
                {page} / {totalPages}
              </span>
              <Button
                variant="outline"
                size="icon"
                disabled={page === totalPages}
                onClick={() => setPage(p => p + 1)}
              >
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
