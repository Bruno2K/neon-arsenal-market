import { useState, useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Filter, Search } from 'lucide-react';
import { motion } from 'framer-motion';
import { ProductCard } from '@/components/ProductCard';
import { products, categories, Rarity } from '@/services/mock-data';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

const rarities: Rarity[] = ['common', 'uncommon', 'rare', 'epic', 'legendary'];
const rarityLabels: Record<Rarity, string> = {
  common: 'Common', uncommon: 'Uncommon', rare: 'Rare', epic: 'Epic', legendary: 'Legendary',
};

export default function Products() {
  const [searchParams] = useSearchParams();
  const initialCategory = searchParams.get('category') || '';

  const [search, setSearch] = useState('');
  const [category, setCategory] = useState(initialCategory);
  const [rarity, setRarity] = useState('');
  const [sort, setSort] = useState('');
  const [showFilters, setShowFilters] = useState(false);

  const filtered = useMemo(() => {
    let result = [...products];
    if (search) result = result.filter(p => p.name.toLowerCase().includes(search.toLowerCase()));
    if (category) result = result.filter(p => p.category === category);
    if (rarity) result = result.filter(p => p.rarity === rarity);
    if (sort === 'price-asc') result.sort((a, b) => a.price - b.price);
    if (sort === 'price-desc') result.sort((a, b) => b.price - a.price);
    if (sort === 'rating') result.sort((a, b) => b.rating - a.rating);
    return result;
  }, [search, category, rarity, sort]);

  return (
    <div className="container py-8">
      <h1 className="text-3xl font-heading text-foreground mb-6">Market</h1>

      {/* Search & filter bar */}
      <div className="flex flex-col sm:flex-row gap-4 mb-8">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Buscar skins, contas, serviços..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="pl-10"
          />
        </div>
        <Button variant="outline" onClick={() => setShowFilters(!showFilters)} className="sm:w-auto">
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
            <label className="text-xs font-heading text-muted-foreground mb-2 block">Categoria</label>
            <div className="flex flex-wrap gap-2">
              <Button variant={category === '' ? 'default' : 'outline'} size="sm" onClick={() => setCategory('')}>Todas</Button>
              {categories.map(c => (
                <Button key={c.id} variant={category === c.id ? 'default' : 'outline'} size="sm" onClick={() => setCategory(c.id)}>
                  {c.name}
                </Button>
              ))}
            </div>
          </div>
          <div>
            <label className="text-xs font-heading text-muted-foreground mb-2 block">Raridade</label>
            <div className="flex flex-wrap gap-2">
              <Button variant={rarity === '' ? 'default' : 'outline'} size="sm" onClick={() => setRarity('')}>Todas</Button>
              {rarities.map(r => (
                <Button key={r} variant={rarity === r ? 'default' : 'outline'} size="sm" onClick={() => setRarity(r)}>
                  {rarityLabels[r]}
                </Button>
              ))}
            </div>
          </div>
          <div>
            <label className="text-xs font-heading text-muted-foreground mb-2 block">Ordenar</label>
            <div className="flex flex-wrap gap-2">
              <Button variant={sort === '' ? 'default' : 'outline'} size="sm" onClick={() => setSort('')}>Padrão</Button>
              <Button variant={sort === 'price-asc' ? 'default' : 'outline'} size="sm" onClick={() => setSort('price-asc')}>Menor Preço</Button>
              <Button variant={sort === 'price-desc' ? 'default' : 'outline'} size="sm" onClick={() => setSort('price-desc')}>Maior Preço</Button>
              <Button variant={sort === 'rating' ? 'default' : 'outline'} size="sm" onClick={() => setSort('rating')}>Melhor Avaliação</Button>
            </div>
          </div>
        </motion.div>
      )}

      {/* Results */}
      <p className="text-sm text-muted-foreground mb-4">{filtered.length} resultados</p>
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
        {filtered.map(p => (
          <ProductCard key={p.id} product={p} />
        ))}
      </div>
      {filtered.length === 0 && (
        <div className="text-center py-20 text-muted-foreground">
          <p className="font-heading text-lg">Nenhum item encontrado</p>
          <p className="text-sm mt-2">Tente ajustar os filtros</p>
        </div>
      )}
    </div>
  );
}
