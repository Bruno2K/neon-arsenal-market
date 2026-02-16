import { Link } from 'react-router-dom';
import { ShoppingCart, Star } from 'lucide-react';
import { motion } from 'framer-motion';
import { Product, getSellerById } from '@/services/mock-data';
import { RankBadge } from '@/components/RankBadge';
import { useCart } from '@/contexts/CartContext';
import { Button } from '@/components/ui/button';

const rarityBg: Record<string, string> = {
  common: 'rarity-bg-common',
  uncommon: 'rarity-bg-uncommon',
  rare: 'rarity-bg-rare',
  epic: 'rarity-bg-epic',
  legendary: 'rarity-bg-legendary',
};

const rarityAccent: Record<string, string> = {
  common: 'rarity-accent-common',
  uncommon: 'rarity-accent-uncommon',
  rare: 'rarity-accent-rare',
  epic: 'rarity-accent-epic',
  legendary: 'rarity-accent-legendary',
};

export function ProductCard({ product }: { product: Product }) {
  const seller = getSellerById(product.sellerId);
  const { addItem } = useCart();

  return (
    <motion.div
      whileHover={{ y: -4 }}
      transition={{ duration: 0.2 }}
      className={`group relative overflow-hidden rounded-lg border border-border bg-card ${rarityAccent[product.rarity]}`}
    >
      <Link to={`/product/${product.id}`}>
        <div className={`aspect-square ${rarityBg[product.rarity]} flex items-center justify-center p-6 relative overflow-hidden`}>
          <div className="scan-lines absolute inset-0" />
          <div className="text-center">
            <span className="text-3xl font-heading text-foreground/70 leading-tight block">{product.name.split(' | ')[0]}</span>
            <span className="text-sm font-heading text-foreground/40 mt-1 block">{product.name.split(' | ')[1]}</span>
          </div>
        </div>
      </Link>

      <div className="p-3 space-y-2">
        <Link to={`/product/${product.id}`}>
          <h3 className="font-heading text-sm text-foreground truncate hover:text-primary transition-colors normal-case">
            {product.name}
          </h3>
        </Link>

        <div className="flex items-center gap-2">
          {seller && <RankBadge rank={seller.rank} />}
          <span className="text-[11px] text-muted-foreground">{seller?.name}</span>
        </div>

        <div className="flex items-center gap-1">
          <Star className="h-3 w-3 fill-secondary text-secondary" />
          <span className="text-[11px] text-muted-foreground">{product.rating} ({product.reviewCount})</span>
        </div>

        <div className="flex items-center justify-between pt-1 border-t border-border">
          <div className="flex items-center gap-2">
            <span className="font-heading text-primary text-lg">${product.price.toFixed(2)}</span>
            {product.originalPrice && (
              <span className="text-[11px] text-muted-foreground line-through">${product.originalPrice.toFixed(2)}</span>
            )}
          </div>
          <Button
            size="icon"
            className="h-8 w-8"
            onClick={(e) => { e.preventDefault(); addItem(product); }}
          >
            <ShoppingCart className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </motion.div>
  );
}
