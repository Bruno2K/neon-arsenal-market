import { useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Filter, Search } from 'lucide-react';
import { motion } from 'framer-motion';
import { ListingCard } from '@/components/ProductCard';
import { listListings } from '@/api/listings';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

export default function Products() {
  const [searchParams] = useSearchParams();
  const [search, setSearch] = useState('');
  const [sort, setSort] = useState('');
  const [page, setPage] = useState(1);
  const [minPrice, setMinPrice] = useState('');
  const [maxPrice, setMaxPrice] = useState('');

  const { data, isLoading, isError, error } = useQuery({
    queryKey: ['listings', { page, search, sort, minPrice, maxPrice }],
    queryFn: () =>
      listListings({
        page,
        limit: 20,
        status: 'ACTIVE',
        ...(search ? { productId: search } : {}),
        ...(minPrice ? { minPrice: parseFloat(minPrice) } : {}),
        ...(maxPrice ? { maxPrice: parseFloat(maxPrice) } : {}),
      }),
  });

  const items = data?.items ?? [];
  const total = data?.total ?? 0;

  const sortedItems =
    sort === 'price-asc'
      ? [...items].sort((a, b) => Number(a.price) - Number(b.price))
      : sort === 'price-desc'
        ? [...items].sort((a, b) => Number(b.price) - Number(a.price))
        : sort === 'float-asc'
          ? [...items].sort((a, b) => Number(a.floatValue) - Number(b.floatValue))
          : sort === 'float-desc'
            ? [...items].sort((a, b) => Number(b.floatValue) - Number(a.floatValue))
            : items;

  return (
    <div className="container py-8">
      <h1 className="text-3xl font-heading text-foreground mb-6">Market</h1>

      <div className="flex flex-col gap-4 mb-8">
        <div className="flex flex-col sm:flex-row gap-4">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Buscar por Product ID..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && setPage(1)}
              className="pl-10"
            />
          </div>
          <div className="flex gap-2">
            <Input
              type="number"
              placeholder="Preço mín"
              value={minPrice}
              onChange={(e) => setMinPrice(e.target.value)}
              className="w-24"
            />
            <Input
              type="number"
              placeholder="Preço máx"
              value={maxPrice}
              onChange={(e) => setMaxPrice(e.target.value)}
              className="w-24"
            />
          </div>
        </div>
        <div>
          <label className="text-xs font-heading text-muted-foreground mb-2 block">Ordenar</label>
          <div className="flex flex-wrap gap-2">
            <Button
              variant={sort === '' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setSort('')}
            >
              Padrão
            </Button>
            <Button
              variant={sort === 'price-asc' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setSort('price-asc')}
            >
              Menor Preço
            </Button>
            <Button
              variant={sort === 'price-desc' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setSort('price-desc')}
            >
              Maior Preço
            </Button>
            <Button
              variant={sort === 'float-asc' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setSort('float-asc')}
            >
              Menor Float
            </Button>
            <Button
              variant={sort === 'float-desc' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setSort('float-desc')}
            >
              Maior Float
            </Button>
          </div>
        </div>
      </div>

      {isLoading && (
        <p className="text-muted-foreground py-8">Carregando...</p>
      )}
      {isError && (
        <div className="py-8 text-center">
          <p className="text-destructive font-heading">
            {error instanceof Error ? error.message : 'Erro ao carregar produtos'}
          </p>
        </div>
      )}
      {!isLoading && !isError && (
        <>
          <p className="text-sm text-muted-foreground mb-4">{total} resultados</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
            {sortedItems.map((listing) => (
              <ListingCard key={listing.id} listing={listing} />
            ))}
          </div>
          {sortedItems.length === 0 && (
            <div className="text-center py-20 text-muted-foreground">
              <p className="font-heading text-lg">Nenhum item encontrado</p>
              <p className="text-sm mt-2">Tente ajustar a busca</p>
            </div>
          )}
        </>
      )}
    </div>
  );
}
