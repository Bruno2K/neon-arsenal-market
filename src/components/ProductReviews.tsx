import { useEffect, useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Star } from "lucide-react";
import {
  createReview,
  deleteReview,
  listProductReviews,
  updateReview,
} from "@/api/reviews";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import {
  isAlreadyReviewedApiError,
  isRetryableReadError,
  userFacingApiError,
} from "@/lib/userFacingApiError";
import type { Review } from "@/types/api";

export const PRODUCT_REVIEWS_HEADING = "Avaliações desta skin";
export const PRODUCT_REVIEWS_SCOPE =
  "Notas e comentários sobre esta skin no catálogo — não sobre este listing específico.";
export const PRODUCT_REVIEWS_EMPTY = "Nenhuma avaliação ainda";
export const PRODUCT_REVIEWS_LOGIN_CTA = "Entrar para avaliar";
export const PRODUCT_REVIEWS_SUBMIT = "Publicar avaliação";
export const PRODUCT_REVIEWS_SAVE = "Salvar alterações";
export const PRODUCT_REVIEWS_DELETE = "Excluir avaliação";
export const PRODUCT_REVIEWS_RETRY = "Tentar novamente";

export function productReviewsQueryKey(productId: string) {
  return ["reviews", "product", productId] as const;
}

function formatReviewDate(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleDateString("pt-BR");
}

function StarRating({
  value,
  onChange,
  disabled,
}: {
  value: number;
  onChange?: (rating: number) => void;
  disabled?: boolean;
}) {
  const interactive = Boolean(onChange) && !disabled;
  return (
    <div
      className="flex items-center gap-1"
      role={interactive ? "radiogroup" : "img"}
      aria-label={
        interactive ? "Nota de 1 a 5 estrelas" : `${value} de 5 estrelas`
      }
    >
      {[1, 2, 3, 4, 5].map((star) => {
        const filled = star <= value;
        if (!interactive) {
          return (
            <Star
              key={star}
              className={
                filled
                  ? "h-4 w-4 fill-foreground text-foreground"
                  : "h-4 w-4 text-muted-foreground"
              }
              aria-hidden
            />
          );
        }
        return (
          <button
            key={star}
            type="button"
            role="radio"
            aria-checked={value === star}
            aria-label={`${star} ${star === 1 ? "estrela" : "estrelas"}`}
            disabled={disabled}
            onClick={() => onChange?.(star)}
            className="rounded-sm p-0.5 text-muted-foreground hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50"
          >
            <Star
              className={
                filled ? "h-5 w-5 fill-foreground text-foreground" : "h-5 w-5"
              }
              aria-hidden
            />
          </button>
        );
      })}
    </div>
  );
}

function ReviewForm({
  productId,
  existing,
  onSuccess,
}: {
  productId: string;
  existing?: Review;
  onSuccess: () => void;
}) {
  const [rating, setRating] = useState(existing?.rating ?? 0);
  const [comment, setComment] = useState(existing?.comment ?? "");
  const [submitError, setSubmitError] = useState<string | null>(null);

  useEffect(() => {
    setRating(existing?.rating ?? 0);
    setComment(existing?.comment ?? "");
    setSubmitError(null);
  }, [existing?.id, existing?.rating, existing?.comment]);

  const create = useMutation({
    mutationFn: () =>
      createReview({
        productId,
        rating,
        comment: comment.trim() || undefined,
      }),
    onSuccess: () => {
      setSubmitError(null);
      onSuccess();
    },
    onError: (error) => {
      setSubmitError(userFacingApiError(error));
      if (isAlreadyReviewedApiError(error)) {
        onSuccess();
      }
    },
  });

  const update = useMutation({
    mutationFn: () =>
      updateReview(existing!.id, {
        rating,
        comment: comment.trim(),
      }),
    onSuccess: () => {
      setSubmitError(null);
      onSuccess();
    },
    onError: (error) => {
      setSubmitError(userFacingApiError(error));
    },
  });

  const remove = useMutation({
    mutationFn: () => deleteReview(existing!.id),
    onSuccess: () => {
      setSubmitError(null);
      setRating(0);
      setComment("");
      onSuccess();
    },
    onError: (error) => {
      setSubmitError(userFacingApiError(error));
    },
  });

  const pending = create.isPending || update.isPending || remove.isPending;
  const canSubmit = rating >= 1 && rating <= 5 && !pending;
  const editing = Boolean(existing);

  return (
    <form
      className="space-y-4 rounded-md border border-border bg-card p-4"
      onSubmit={(event) => {
        event.preventDefault();
        if (!canSubmit) return;
        if (editing) {
          update.mutate();
          return;
        }
        create.mutate();
      }}
    >
      <div className="space-y-2">
        <Label id="review-rating-label">Sua nota</Label>
        <StarRating value={rating} onChange={setRating} disabled={pending} />
      </div>
      <div className="space-y-2">
        <Label htmlFor="review-comment">Comentário (opcional)</Label>
        <Textarea
          id="review-comment"
          value={comment}
          onChange={(event) => setComment(event.target.value)}
          disabled={pending}
          maxLength={2000}
          placeholder="Como foi a experiência com esta skin?"
        />
      </div>
      {submitError ? (
        <p className="text-sm text-destructive" role="alert">
          {submitError}
        </p>
      ) : null}
      <div className="flex flex-wrap gap-2">
        <Button type="submit" disabled={!canSubmit}>
          {editing ? PRODUCT_REVIEWS_SAVE : PRODUCT_REVIEWS_SUBMIT}
        </Button>
        {editing ? (
          <Button
            type="button"
            variant="outline"
            disabled={pending}
            onClick={() => remove.mutate()}
          >
            {PRODUCT_REVIEWS_DELETE}
          </Button>
        ) : null}
      </div>
    </form>
  );
}

export function ProductReviews({ productId }: { productId: string }) {
  const location = useLocation();
  const queryClient = useQueryClient();
  const { user, isAuthenticated, isLoading: authLoading } = useAuth();
  const {
    data: reviews,
    isLoading,
    isError,
    error,
    refetch,
  } = useQuery({
    queryKey: productReviewsQueryKey(productId),
    queryFn: () => listProductReviews(productId),
    enabled: Boolean(productId),
  });

  const ownReview = reviews?.find((review) => review.userId === user?.id);
  const canCreate = isAuthenticated && user?.role === "CUSTOMER" && !ownReview;
  const canEditOwn = Boolean(ownReview);

  const refresh = () => {
    void queryClient.invalidateQueries({
      queryKey: productReviewsQueryKey(productId),
    });
  };

  return (
    <section
      className="mt-12 border-t border-border pt-10"
      aria-labelledby="product-reviews-heading"
    >
      <h2
        id="product-reviews-heading"
        className="text-xl font-semibold tracking-tight text-foreground"
      >
        {PRODUCT_REVIEWS_HEADING}
      </h2>
      <p className="mt-2 text-sm text-muted-foreground">
        {PRODUCT_REVIEWS_SCOPE}
      </p>

      {isLoading ? (
        <div
          className="mt-6 space-y-3"
          role="status"
          aria-label="Carregando avaliações"
        >
          <Skeleton className="h-20 w-full" />
          <Skeleton className="h-20 w-full" />
        </div>
      ) : null}

      {isError ? (
        <div className="mt-6" role="alert">
          <p className="text-sm text-muted-foreground">
            {userFacingApiError(error)}
          </p>
          {isRetryableReadError(error) ? (
            <Button
              type="button"
              variant="outline"
              className="mt-3"
              onClick={() => refetch()}
            >
              {PRODUCT_REVIEWS_RETRY}
            </Button>
          ) : null}
        </div>
      ) : null}

      {!isLoading && !isError && reviews && reviews.length === 0 ? (
        <p className="mt-6 text-sm text-muted-foreground" role="status">
          {PRODUCT_REVIEWS_EMPTY}
        </p>
      ) : null}

      {!isLoading && !isError && reviews && reviews.length > 0 ? (
        <ul className="mt-6 space-y-4">
          {reviews.map((review) => (
            <li
              key={review.id}
              className="rounded-md border border-border bg-card p-4"
            >
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="text-sm font-medium text-foreground">
                  {review.user?.name || "Comprador"}
                </p>
                <time
                  className="text-xs text-muted-foreground"
                  dateTime={review.createdAt}
                >
                  {formatReviewDate(review.createdAt)}
                </time>
              </div>
              <div className="mt-2">
                <StarRating value={review.rating} />
              </div>
              {review.comment ? (
                <p className="mt-2 text-sm text-muted-foreground">
                  {review.comment}
                </p>
              ) : null}
            </li>
          ))}
        </ul>
      ) : null}

      {!authLoading && !isAuthenticated ? (
        <div className="mt-6">
          <Button asChild>
            <Link to="/login" state={{ from: { pathname: location.pathname } }}>
              {PRODUCT_REVIEWS_LOGIN_CTA}
            </Link>
          </Button>
        </div>
      ) : null}

      {!authLoading && (canCreate || canEditOwn) ? (
        <div className="mt-6">
          <ReviewForm
            productId={productId}
            existing={ownReview}
            onSuccess={refresh}
          />
        </div>
      ) : null}
    </section>
  );
}
