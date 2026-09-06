import { useEffect } from "react";
import { Heart } from "lucide-react";
import { useLocation, useNavigate } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { addFavorite, listFavorites, removeFavorite } from "@/api/favorites";
import { useOptionalAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import {
  consumePendingFavoriteListingId,
  setPendingFavoriteListingId,
} from "@/lib/pendingFavorite";
import { userFacingApiError } from "@/lib/userFacingApiError";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export function FavoriteButton({
  listingId,
  className,
}: {
  listingId: string;
  className?: string;
}) {
  const auth = useOptionalAuth();
  const isAuthenticated = Boolean(auth?.isAuthenticated);
  const navigate = useNavigate();
  const location = useLocation();
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const favoritesQuery = useQuery({
    queryKey: ["favorites"],
    queryFn: listFavorites,
    enabled: isAuthenticated,
  });

  const favorited = (favoritesQuery.data ?? []).some(
    (item) => item.listingId === listingId || item.listing?.id === listingId,
  );

  const toggle = useMutation({
    mutationFn: async () => {
      if (favorited) {
        await removeFavorite(listingId);
        return false;
      }
      await addFavorite(listingId);
      return true;
    },
    onMutate: async () => {
      await queryClient.cancelQueries({ queryKey: ["favorites"] });
      const previous = queryClient.getQueryData(["favorites"]);
      queryClient.setQueryData(["favorites"], (current: unknown) => {
        const items = Array.isArray(current) ? current : [];
        if (favorited) {
          return items.filter(
            (item: { listingId?: string; listing?: { id?: string } }) =>
              item.listingId !== listingId && item.listing?.id !== listingId,
          );
        }
        return [
          ...items,
          { id: `optimistic-${listingId}`, userId: "", listingId },
        ];
      });
      return { previous };
    },
    onError: (error, _vars, context) => {
      if (context?.previous !== undefined) {
        queryClient.setQueryData(["favorites"], context.previous);
      }
      toast({
        title: userFacingApiError(error),
        variant: "destructive",
      });
    },
    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey: ["favorites"] });
    },
  });

  useEffect(() => {
    if (!isAuthenticated) return;
    const pending = consumePendingFavoriteListingId();
    if (pending === listingId) toggle.mutate();
    // one-shot pending favorite after login
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAuthenticated, listingId]);

  const onClick = () => {
    if (!isAuthenticated) {
      setPendingFavoriteListingId(listingId);
      navigate("/login", {
        state: { from: `${location.pathname}${location.search}` },
      });
      return;
    }
    toggle.mutate();
  };

  return (
    <Button
      type="button"
      variant="ghost"
      size="icon"
      className={cn("min-h-11 min-w-11", className)}
      aria-pressed={favorited}
      aria-label={
        favorited ? "Remover dos favoritos" : "Adicionar aos favoritos"
      }
      disabled={toggle.isPending}
      onClick={onClick}
    >
      <Heart
        className={cn(
          "h-4 w-4",
          favorited
            ? "fill-foreground text-foreground"
            : "text-muted-foreground",
        )}
      />
    </Button>
  );
}
