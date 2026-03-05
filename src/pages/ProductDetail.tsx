// ─── Page: ProductDetail ──────────────────────────────────────────────────────
// Real API: useProduct for product data, useReviews for reviews section.
// useCreateReview allows authenticated users to submit reviews.

import { useState, type FormEvent } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import {
  ArrowLeft,
  Star,
  ShoppingCart,
  Shield,
  Package,
  Loader2,
  AlertCircle,
  MessageSquare,
} from 'lucide-react';
import { motion } from 'framer-motion';
import { useProduct } from '@/application/hooks/products/useProduct';
import { useProducts } from '@/application/hooks/products/useProducts';
import { useReviews } from '@/application/hooks/reviews/useReviews';
import { useCreateReview } from '@/application/hooks/reviews/useCreateReview';
import { useCart } from '@/contexts/CartContext';
import { useAuth } from '@/contexts/AuthContext';
import { ProductCard } from '@/components/ProductCard';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';

// ─── Star rating selector ────────────────────────────────────────────────────

function StarRating({
  value,
  onChange,
}: {
  value: number;
  onChange: (n: number) => void;
}) {
  return (
    <div className="flex gap-1">
      {[1, 2, 3, 4, 5].map(n => (
        <button
          key={n}
          type="button"
          onClick={() => onChange(n)}
          className="focus:outline-none"
        >
          <Star
            className={`h-5 w-5 transition-colors ${
              n <= value
                ? 'fill-secondary text-secondary'
                : 'text-muted-foreground'
            }`}
          />
        </button>
      ))}
    </div>
  );
}

// ─── Page ────────────────────────────────────────────────────────────────────

export default function ProductDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { addItem } = useCart();
  const { user } = useAuth();

  const { data: product, isLoading, isError } = useProduct(id ?? '');
  const { data: relatedData } = useProducts({ limit: 4 });
  const { data: reviews = [] } = useReviews(id ?? '');

  const createReview = useCreateReview();

  const [rating, setRating] = useState(5);
  const [comment, setComment] = useState('');
  const [reviewError, setReviewError] = useState<string | null>(null);

  if (isLoading) {
    return (
      <div className="container py-20 flex justify-center">
        <Loader2 className="h-10 w-10 animate-spin text-primary" />
      </div>
    );
  }

  if (isError || !product) {
    return (
      <div className="container py-20 text-center">
        <p className="text-muted-foreground font-heading text-xl">
          Produto não encontrado
        </p>
        <Button asChild className="mt-4">
          <Link to="/products">Voltar ao Market</Link>
        </Button>
      </div>
    );
  }

  const related = (relatedData?.items ?? [])
    .filter(p => p.id !== product.id)
    .slice(0, 4);

  const avgRating =
    reviews.length > 0
      ? reviews.reduce((sum, r) => sum + r.rating, 0) / reviews.length
      : 0;

  const handleReviewSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setReviewError(null);
    try {
      await createReview.mutateAsync({ productId: product.id, rating, comment });
      setComment('');
      setRating(5);
    } catch (err: unknown) {
      setReviewError(
        err instanceof Error ? err.message : 'Erro ao enviar avaliação.',
      );
    }
  };

  return (
    <div className="container py-8">
      <Button
        variant="ghost"
        size="sm"
        onClick={() => navigate(-1)}
        className="mb-6"
      >
        <ArrowLeft className="h-4 w-4 mr-1" /> Voltar
      </Button>

      <div className="grid md:grid-cols-2 gap-8">
        {/* Thumbnail */}
        <motion.div
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          className="aspect-square rounded-lg bg-gradient-to-br from-primary/10 via-background to-secondary/10 flex items-center justify-center relative overflow-hidden border border-border"
        >
          <div className="scan-lines absolute inset-0" />
          {product.imageUrl ? (
            <img
              src={product.imageUrl}
              alt={product.name}
              className="w-full h-full object-cover relative z-10"
              onError={(e) => {
                (e.currentTarget as HTMLImageElement).style.display = 'none';
                const fb = e.currentTarget.nextElementSibling as HTMLElement | null;
                fb?.classList.remove('hidden');
              }}
            />
          ) : null}
          {/* Fallback */}
          <div className={`text-center relative z-10 px-8 ${product.imageUrl ? 'hidden' : ''}`}>
            <Package className="h-16 w-16 text-primary/30 mx-auto mb-4" />
            <span className="text-2xl font-heading text-foreground/60 block leading-tight">
              {product.name}
            </span>
          </div>
          {/* Category tag */}
          {product.category && (
            <span className="absolute bottom-3 left-3 text-xs font-heading px-2 py-1 rounded bg-background/80 text-muted-foreground border border-border/50 z-20 capitalize">
              {product.category}
            </span>
          )}
        </motion.div>

        {/* Info */}
        <motion.div
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          className="space-y-6"
        >
          <div>
            {product.category && (
              <span className="inline-block text-xs font-heading px-2 py-0.5 rounded bg-primary/10 text-primary border border-primary/20 capitalize mb-2">
                {product.category}
              </span>
            )}
            <h1 className="text-3xl font-heading text-foreground normal-case">
              {product.name}
            </h1>
            <p className="text-muted-foreground mt-3 leading-relaxed">
              {product.description}
            </p>
          </div>

          {reviews.length > 0 && (
            <div className="flex items-center gap-3">
              <Star className="h-5 w-5 fill-secondary text-secondary" />
              <span className="text-foreground font-medium">
                {avgRating.toFixed(1)}
              </span>
              <span className="text-muted-foreground text-sm">
                ({reviews.length} avaliação{reviews.length !== 1 ? 'ões' : ''})
              </span>
            </div>
          )}

          {/* Seller */}
          {product.seller && (
            <div className="p-4 rounded-lg border border-border bg-card flex items-center gap-4">
              <div className="h-10 w-10 rounded-full bg-muted flex items-center justify-center flex-shrink-0">
                <Shield className="h-5 w-5 text-muted-foreground" />
              </div>
              <div>
                <span className="text-sm font-medium text-foreground">
                  {product.seller.storeName}
                </span>
                {product.seller.rating > 0 && (
                  <div className="text-xs text-muted-foreground flex items-center gap-1 mt-0.5">
                    <Star className="h-3 w-3 fill-secondary text-secondary" />
                    {product.seller.rating.toFixed(1)} de avaliação
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Price & CTA */}
          <div className="p-6 rounded-lg border border-primary/20 bg-primary/5 space-y-4">
            <span className="font-heading text-4xl text-primary">
              ${product.price.toFixed(2)}
            </span>
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Package className="h-4 w-4" />
              <span>{product.stock} em estoque</span>
            </div>
            <div className="flex gap-3">
              <Button
                className="flex-1"
                size="lg"
                disabled={product.stock === 0}
                onClick={() => addItem(product)}
              >
                <ShoppingCart className="h-5 w-5 mr-2" />
                {product.stock === 0 ? 'Esgotado' : 'Adicionar ao Carrinho'}
              </Button>
              <Button variant="outline" size="lg" asChild>
                <Link to="/cart">Ver Carrinho</Link>
              </Button>
            </div>
          </div>
        </motion.div>
      </div>

      {/* Reviews */}
      <section className="mt-16 border-t border-border pt-12">
        <h2 className="text-xl font-heading text-foreground mb-6 flex items-center gap-2">
          <MessageSquare className="h-5 w-5" />
          Avaliações ({reviews.length})
        </h2>

        {reviews.length === 0 ? (
          <p className="text-sm text-muted-foreground mb-8">
            Nenhuma avaliação ainda. Seja o primeiro!
          </p>
        ) : (
          <div className="space-y-4 mb-10">
            {reviews.map(r => (
              <div key={r.id} className="p-4 rounded-lg border border-border bg-card">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <div className="h-7 w-7 rounded-full bg-muted flex items-center justify-center text-xs font-heading text-muted-foreground">
                      {r.user?.name?.[0]?.toUpperCase() ?? 'U'}
                    </div>
                    <span className="text-sm font-medium text-foreground">
                      {r.user?.name ?? 'Usuário'}
                    </span>
                  </div>
                  <div className="flex gap-0.5">
                    {[1, 2, 3, 4, 5].map(n => (
                      <Star
                        key={n}
                        className={`h-3.5 w-3.5 ${
                          n <= r.rating
                            ? 'fill-secondary text-secondary'
                            : 'text-muted-foreground'
                        }`}
                      />
                    ))}
                  </div>
                </div>
                {r.comment && (
                  <p className="text-sm text-muted-foreground">{r.comment}</p>
                )}
                <p className="text-[11px] text-muted-foreground/60 mt-2">
                  {new Date(r.createdAt).toLocaleDateString('pt-BR')}
                </p>
              </div>
            ))}
          </div>
        )}

        {user ? (
          <form
            onSubmit={handleReviewSubmit}
            className="p-6 rounded-lg border border-border bg-card space-y-4"
          >
            <h3 className="font-heading text-foreground text-sm">
              Avaliar produto
            </h3>
            <StarRating value={rating} onChange={setRating} />
            <Textarea
              placeholder="Deixe um comentário (opcional)"
              value={comment}
              onChange={e => setComment(e.target.value)}
              rows={3}
            />
            {reviewError && (
              <div className="flex items-center gap-2 text-sm text-destructive">
                <AlertCircle className="h-4 w-4" />
                {reviewError}
              </div>
            )}
            <Button type="submit" disabled={createReview.isPending} size="sm">
              {createReview.isPending && (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              )}
              Enviar Avaliação
            </Button>
          </form>
        ) : (
          <p className="text-sm text-muted-foreground">
            <Link to="/login" className="text-primary hover:underline">
              Faça login
            </Link>{' '}
            para avaliar este produto.
          </p>
        )}
      </section>

      {/* Related */}
      {related.length > 0 && (
        <section className="mt-16 border-t border-border pt-12">
          <h2 className="text-xl font-heading text-foreground mb-6">
            Outros Produtos
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {related.map(p => (
              <ProductCard key={p.id} product={p} />
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
