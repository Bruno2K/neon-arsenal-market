import { useParams, Link, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { ArrowLeft, ShoppingCart, Package, TrendingUp } from 'lucide-react';
import { motion } from 'framer-motion';
import { ListingCard } from '@/components/ProductCard';
import { getListing, listListings } from '@/api/listings';
import { getPriceHistory } from '@/api/price-history';
import { useCart } from '@/contexts/CartContext';
import { Button } from '@/components/ui/button';

export default function ListingDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { addItem } = useCart();

  const { data: listing, isLoading, isError, error } = useQuery({
    queryKey: ['listing', id],
    queryFn: () => getListing(id!),
    enabled: !!id,
  });

  const { data: priceHistory } = useQuery({
    queryKey: ['priceHistory', id],
    queryFn: () => getPriceHistory(id!),
    enabled: !!id,
  });

  const { data: relatedData } = useQuery({
    queryKey: ['listings', { productId: listing?.productId, limit: 4 }],
    queryFn: () => listListings({ productId: listing?.productId, status: 'ACTIVE', limit: 4 }),
    enabled: !!listing?.productId,
  });

  const related = (relatedData?.items ?? []).filter((l) => l.id !== id).slice(0, 4);
  const productName = listing ? `${listing.product.weapon} | ${listing.product.skinName} (${listing.product.exterior})` : '';
  const isAvailable = listing?.status === 'ACTIVE' && (!listing.tradeLockUntil || new Date(listing.tradeLockUntil) <= new Date());

  if (isLoading) {
    return (
      <div className="container py-20 text-center">
        <p className="text-muted-foreground">Carregando...</p>
      </div>
    );
  }

  if (isError || !listing) {
    return (
      <div className="container py-20 text-center">
        <p className="text-muted-foreground font-heading text-xl">
          {error instanceof Error ? error.message : 'Listing não encontrado'}
        </p>
        <Button asChild className="mt-4">
          <Link to="/products">Voltar ao Market</Link>
        </Button>
      </div>
    );
  }

  const price = typeof listing.price === 'number' ? listing.price : Number(listing.price);
  const sellerName = listing.seller?.user?.name ?? listing.seller?.storeName ?? '';

  return (
    <div className="container py-8">
      <Button variant="ghost" size="sm" onClick={() => navigate(-1)} className="mb-6">
        <ArrowLeft className="h-4 w-4 mr-1" /> Voltar
      </Button>

      <div className="grid md:grid-cols-2 gap-8">
        <motion.div
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          className="aspect-square rounded-lg bg-muted flex items-center justify-center relative overflow-hidden border border-border"
        >
          <div className="scan-lines absolute inset-0" />
          <div className="text-center relative z-10">
            <span className="text-4xl font-heading text-foreground/70 block">{productName}</span>
            {listing.product.isStattrak && (
              <span className="text-lg text-primary mt-2 block">StatTrak™</span>
            )}
          </div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          className="space-y-6"
        >
          <div>
            <h1 className="text-3xl font-heading text-foreground mt-3 normal-case">{productName}</h1>
            <div className="mt-3 space-y-2">
              <div className="flex items-center gap-4 text-sm text-muted-foreground">
                <span><strong className="text-foreground">Raridade:</strong> {listing.product.rarity}</span>
                <span><strong className="text-foreground">Coleção:</strong> {listing.product.collection || 'N/A'}</span>
              </div>
              <div className="flex items-center gap-4 text-sm">
                <span className="text-muted-foreground"><strong className="text-foreground">Float:</strong> {listing.floatValue.toFixed(8)}</span>
                {listing.pattern && (
                  <span className="text-muted-foreground"><strong className="text-foreground">Pattern:</strong> {listing.pattern}</span>
                )}
              </div>
              {listing.tradeLockUntil && (
                <div className="text-sm text-muted-foreground">
                  <strong className="text-foreground">Trade Lock até:</strong> {new Date(listing.tradeLockUntil).toLocaleDateString()}
                </div>
              )}
            </div>
          </div>

          {sellerName && (
            <div className="p-4 rounded-lg border border-border bg-card flex items-center gap-4">
              <div className="h-10 w-10 rounded-full bg-muted flex items-center justify-center">
                <span className="text-sm font-heading text-muted-foreground">{sellerName[0]}</span>
              </div>
              <div>
                <span className="text-sm font-medium text-foreground">{sellerName}</span>
                {listing.seller.rating && (
                  <span className="text-xs text-muted-foreground block">Avaliação: {listing.seller.rating.toFixed(1)}</span>
                )}
              </div>
            </div>
          )}

          <div className="p-6 rounded-lg border border-primary/20 bg-primary/5 space-y-4">
            <div className="flex items-baseline gap-3">
              <span className="font-heading text-4xl text-primary">${price.toFixed(2)}</span>
              <span className="text-sm text-muted-foreground">{listing.currency}</span>
            </div>
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Package className="h-4 w-4" />
              <span>Status: {listing.status === 'ACTIVE' ? 'Disponível' : listing.status}</span>
            </div>
            {priceHistory && priceHistory.length > 0 && (
              <div className="text-sm text-muted-foreground">
                <div className="flex items-center gap-2">
                  <TrendingUp className="h-4 w-4" />
                  <span>Última alteração: ${priceHistory[0].newPrice.toFixed(2)}</span>
                </div>
              </div>
            )}
            <div className="flex gap-3">
              <Button
                className="flex-1"
                size="lg"
                onClick={() => addItem(listing)}
                disabled={!isAvailable}
                title={!isAvailable ? 'Item não disponível' : 'Adicionar ao carrinho'}
              >
                <ShoppingCart className="h-5 w-5 mr-2" /> Adicionar ao Carrinho
              </Button>
              <Button variant="outline" size="lg" asChild>
                <Link to="/cart">Ver Carrinho</Link>
              </Button>
            </div>
          </div>

          {priceHistory && priceHistory.length > 0 && (
            <div className="p-4 rounded-lg border border-border bg-card">
              <h3 className="font-heading text-sm text-foreground mb-3">Histórico de Preços</h3>
              <div className="space-y-2 text-sm">
                {priceHistory.slice(0, 5).map((entry) => (
                  <div key={entry.id} className="flex justify-between text-muted-foreground">
                    <span>{new Date(entry.changedAt).toLocaleDateString()}</span>
                    <span>${entry.oldPrice.toFixed(2)} → ${entry.newPrice.toFixed(2)}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </motion.div>
      </div>

      {related.length > 0 && (
        <section className="mt-16 border-t border-border pt-12">
          <h2 className="text-xl font-heading text-foreground mb-6">Outros Listings Desta Skin</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {related.map((l) => (
              <ListingCard key={l.id} listing={l} />
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
