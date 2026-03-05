import { Link } from 'react-router-dom';
import { ShoppingCart } from 'lucide-react';
import { motion } from 'framer-motion';
import type { Listing } from '@/types/api';
import { useCart } from '@/contexts/CartContext';
import { Button } from '@/components/ui/button';

// Export both names for compatibility
export function ListingCard({ listing }: { listing: Listing }) {
  const { addItem } = useCart();
  const price = typeof listing.price === 'number' ? listing.price : Number(listing.price);
  const sellerName = listing.seller?.user?.name ?? listing.seller?.storeName ?? '';
  const productName = `${listing.product.weapon} | ${listing.product.skinName} (${listing.product.exterior})`;
  const isAvailable = listing.status === 'ACTIVE' && (!listing.tradeLockUntil || new Date(listing.tradeLockUntil) <= new Date());

  return (
    <motion.div
      whileHover={{ y: -4 }}
      transition={{ duration: 0.2 }}
      className="group relative overflow-hidden rounded-lg border border-border bg-card"
    >
      <Link to={`/listing/${listing.id}`}>
        <div className="aspect-square bg-muted flex items-center justify-center p-6 relative overflow-hidden border-b border-border">
          <div className="scan-lines absolute inset-0" />
          <div className="text-center">
            <span className="text-2xl font-heading text-foreground/70 leading-tight block line-clamp-2">
              {productName}
            </span>
            {listing.product.isStattrak && (
              <span className="text-xs text-primary mt-1 block">StatTrak™</span>
            )}
          </div>
        </div>
      </Link>

      <div className="p-3 space-y-2">
        <Link to={`/listing/${listing.id}`}>
          <h3 className="font-heading text-sm text-foreground truncate hover:text-primary transition-colors normal-case">
            {productName}
          </h3>
        </Link>
        <div className="flex items-center justify-between text-[11px] text-muted-foreground">
          <span>{sellerName}</span>
          <span>Float: {listing.floatValue.toFixed(8)}</span>
        </div>
        {listing.pattern && (
          <span className="text-[10px] text-muted-foreground block">Pattern: {listing.pattern}</span>
        )}
        <div className="flex items-center justify-between pt-1 border-t border-border">
          <span className="font-heading text-primary text-lg">${price.toFixed(2)}</span>
          <Button
            size="icon"
            className="h-8 w-8"
            onClick={(e) => {
              e.preventDefault();
              addItem(listing);
            }}
            disabled={!isAvailable}
            title={!isAvailable ? 'Item não disponível' : 'Adicionar ao carrinho'}
          >
            <ShoppingCart className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </motion.div>
  );
}

// Keep ProductCard export for backward compatibility (will be removed later)
export const ProductCard = ListingCard;
