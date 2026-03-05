// ─── Presentation: ProductCard ────────────────────────────────────────────────
// Uses the domain Product entity (no mock-data dependency).
// Seller info comes from the nested product.seller object.

import { Link } from 'react-router-dom';
import { ShoppingCart, Star, Package } from 'lucide-react';
import { motion } from 'framer-motion';
import type { Product } from '@/domain/products/entities/Product';
import { useCart } from '@/contexts/CartContext';
import { Button } from '@/components/ui/button';

export function ProductCard({ product }: { product: Product }) {
  const { addItem } = useCart();

  return (
    <motion.div
      whileHover={{ y: -4 }}
      transition={{ duration: 0.2 }}
      className="group relative overflow-hidden rounded-lg border border-border bg-card"
    >
      {/* Thumbnail */}
      <Link to={`/product/${product.id}`}>
        <div className="aspect-square bg-gradient-to-br from-primary/10 via-background to-secondary/10 flex items-center justify-center relative overflow-hidden">
          <div className="scan-lines absolute inset-0" />
          {product.imageUrl ? (
            <img
              src={product.imageUrl}
              alt={product.name}
              className="w-full h-full object-cover relative z-10"
              onError={(e) => {
                (e.currentTarget as HTMLImageElement).style.display = 'none';
                (e.currentTarget.nextElementSibling as HTMLElement | null)?.classList.remove('hidden');
              }}
            />
          ) : null}
          {/* Fallback placeholder shown when no image or image fails */}
          <div className={`text-center relative z-10 p-6 ${product.imageUrl ? 'hidden' : ''}`}>
            <Package className="h-12 w-12 text-primary/40 mx-auto mb-2" />
            <span className="text-sm font-heading text-foreground/60 leading-tight block truncate max-w-[140px]">
              {product.name}
            </span>
          </div>
          {/* Category badge */}
          {product.category && (
            <span className="absolute bottom-2 left-2 text-[10px] font-heading px-1.5 py-0.5 rounded bg-background/80 text-muted-foreground border border-border/50 z-20 capitalize">
              {product.category}
            </span>
          )}
          {/* Stock badge */}
          {product.stock > 0 && product.stock <= 3 && (
            <span className="absolute top-2 right-2 text-[10px] font-heading px-1.5 py-0.5 rounded bg-secondary/20 text-secondary border border-secondary/30 z-20">
              {product.stock} left
            </span>
          )}
          {product.stock === 0 && (
            <span className="absolute top-2 right-2 text-[10px] font-heading px-1.5 py-0.5 rounded bg-destructive/20 text-destructive border border-destructive/30 z-20">
              Esgotado
            </span>
          )}
        </div>
      </Link>

      <div className="p-3 space-y-2">
        {/* Name */}
        <Link to={`/product/${product.id}`}>
          <h3 className="font-heading text-sm text-foreground truncate hover:text-primary transition-colors normal-case">
            {product.name}
          </h3>
        </Link>

        {/* Seller */}
        {product.seller && (
          <div className="flex items-center gap-1.5">
            <div className="h-4 w-4 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
              <span className="text-[8px] text-primary font-heading">S</span>
            </div>
            <div className="flex items-center gap-1 min-w-0">
              <span className="text-[11px] text-muted-foreground truncate">
                {product.seller.storeName}
              </span>
              {product.seller.rating > 0 && (
                <span className="flex items-center gap-0.5 flex-shrink-0">
                  <Star className="h-2.5 w-2.5 fill-secondary text-secondary" />
                  <span className="text-[10px] text-muted-foreground">
                    {product.seller.rating.toFixed(1)}
                  </span>
                </span>
              )}
            </div>
          </div>
        )}

        {/* Price + CTA */}
        <div className="flex items-center justify-between pt-1 border-t border-border">
          <span className="font-heading text-primary text-lg">
            ${product.price.toFixed(2)}
          </span>
          <Button
            size="icon"
            className="h-8 w-8"
            disabled={product.stock === 0}
            onClick={e => {
              e.preventDefault();
              addItem(product);
            }}
          >
            <ShoppingCart className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </motion.div>
  );
}
