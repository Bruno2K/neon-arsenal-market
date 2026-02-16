import { useParams, Link, useNavigate } from 'react-router-dom';
import { ArrowLeft, Star, ShoppingCart, Shield, Package } from 'lucide-react';
import { motion } from 'framer-motion';
import { getProductById, getSellerById, products } from '@/services/mock-data';
import { ProductCard } from '@/components/ProductCard';
import { RankBadge } from '@/components/RankBadge';
import { useCart } from '@/contexts/CartContext';
import { Button } from '@/components/ui/button';

const rarityBg: Record<string, string> = {
  common: 'rarity-bg-common', uncommon: 'rarity-bg-uncommon', rare: 'rarity-bg-rare', epic: 'rarity-bg-epic', legendary: 'rarity-bg-legendary',
};

const rarityLabel: Record<string, string> = {
  common: 'Common', uncommon: 'Uncommon', rare: 'Rare', epic: 'Epic', legendary: 'Legendary',
};

export default function ProductDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { addItem } = useCart();
  const product = getProductById(id || '');
  const seller = product ? getSellerById(product.sellerId) : null;

  if (!product) {
    return (
      <div className="container py-20 text-center">
        <p className="text-muted-foreground font-heading text-xl">Produto não encontrado</p>
        <Button asChild className="mt-4"><Link to="/products">Voltar ao Market</Link></Button>
      </div>
    );
  }

  const related = products.filter(p => p.category === product.category && p.id !== product.id).slice(0, 4);

  return (
    <div className="container py-8">
      <Button variant="ghost" size="sm" onClick={() => navigate(-1)} className="mb-6">
        <ArrowLeft className="h-4 w-4 mr-1" /> Voltar
      </Button>

      <div className="grid md:grid-cols-2 gap-8">
        {/* Image */}
        <motion.div
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          className={`aspect-square rounded-lg ${rarityBg[product.rarity]} flex items-center justify-center relative overflow-hidden border border-border`}
        >
          <div className="scan-lines absolute inset-0" />
          <div className="text-center relative z-10">
            <span className="text-5xl font-heading text-foreground/70 block">{product.name.split(' | ')[0]}</span>
            <span className="text-xl font-heading text-foreground/40 mt-2 block">{product.name.split(' | ')[1]}</span>
          </div>
        </motion.div>

        {/* Info */}
        <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} className="space-y-6">
          <div>
            <span className={`rarity-accent-${product.rarity} inline-block text-xs font-heading px-2 py-1 rounded border border-border bg-muted`}>
              {rarityLabel[product.rarity]}
            </span>
            <h1 className="text-3xl font-heading text-foreground mt-3 normal-case">{product.name}</h1>
            <p className="text-muted-foreground mt-3 leading-relaxed">{product.description}</p>
          </div>

          <div className="flex items-center gap-3">
            <Star className="h-5 w-5 fill-secondary text-secondary" />
            <span className="text-foreground font-medium">{product.rating}</span>
            <span className="text-muted-foreground text-sm">({product.reviewCount} avaliações)</span>
          </div>

          {/* Seller */}
          {seller && (
            <div className="p-4 rounded-lg border border-border bg-card flex items-center gap-4">
              <div className="h-10 w-10 rounded-full bg-muted flex items-center justify-center">
                <Shield className="h-5 w-5 text-muted-foreground" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium text-foreground">{seller.name}</span>
                  <RankBadge rank={seller.rank} />
                </div>
                <span className="text-xs text-muted-foreground">{seller.totalSales.toLocaleString()} vendas · ★ {seller.rating}</span>
              </div>
            </div>
          )}

          {/* Price & CTA */}
          <div className="p-6 rounded-lg border border-primary/20 bg-primary/5 space-y-4">
            <div className="flex items-baseline gap-3">
              <span className="font-heading text-4xl text-primary">${product.price.toFixed(2)}</span>
              {product.originalPrice && (
                <span className="text-lg text-muted-foreground line-through">${product.originalPrice.toFixed(2)}</span>
              )}
            </div>
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Package className="h-4 w-4" />
              <span>{product.stock} em estoque</span>
            </div>
            <div className="flex gap-3">
              <Button className="flex-1" size="lg" onClick={() => addItem(product)}>
                <ShoppingCart className="h-5 w-5 mr-2" /> Adicionar ao Carrinho
              </Button>
              <Button variant="outline" size="lg" asChild>
                <Link to="/cart">Ver Carrinho</Link>
              </Button>
            </div>
          </div>

          {/* Tags */}
          <div className="flex flex-wrap gap-2">
            {product.tags.map(tag => (
              <span key={tag} className="text-[11px] px-2 py-1 rounded bg-muted text-muted-foreground font-heading">
                {tag}
              </span>
            ))}
          </div>
        </motion.div>
      </div>

      {/* Related */}
      {related.length > 0 && (
        <section className="mt-16 border-t border-border pt-12">
          <h2 className="text-xl font-heading text-foreground mb-6">Itens Relacionados</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {related.map(p => <ProductCard key={p.id} product={p} />)}
          </div>
        </section>
      )}
    </div>
  );
}
