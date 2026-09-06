import { useEffect } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  cancelListing,
  createListing,
  getSellerListings,
  getSellerMe,
  updateListing,
  updateListingPrice,
} from "@/api";
import { useToast } from "@/hooks/use-toast";
import { analyticsPrice, track } from "@/lib/analytics";
import {
  logTechnicalError,
  userFacingApiError,
} from "@/lib/userFacingApiError";
import type { Listing } from "@/types/api";

export const SELLER_ME_QUERY_KEY = ["sellerMe"] as const;
export const SELLER_LISTINGS_QUERY_KEY = ["sellerListings"] as const;

type CreateListingInput = Parameters<typeof createListing>[0];
type UpdateListingBody = Parameters<typeof updateListing>[1];

export function useSellerListings(options?: { enabled?: boolean }) {
  const enabled = options?.enabled ?? true;
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const sellerQuery = useQuery({
    queryKey: SELLER_ME_QUERY_KEY,
    queryFn: getSellerMe,
    enabled,
  });

  const listingsQuery = useQuery({
    queryKey: SELLER_LISTINGS_QUERY_KEY,
    queryFn: getSellerListings,
    enabled: enabled && sellerQuery.isSuccess,
  });

  const queryError = sellerQuery.isError
    ? sellerQuery.error
    : listingsQuery.isError
      ? listingsQuery.error
      : null;
  const isRetrying =
    Boolean(queryError) && (sellerQuery.isFetching || listingsQuery.isFetching);
  const loading =
    sellerQuery.isLoading || listingsQuery.isLoading || isRetrying;
  const error =
    queryError && !isRetrying ? userFacingApiError(queryError) : null;

  useEffect(() => {
    if (queryError && !isRetrying) {
      logTechnicalError(queryError);
    }
  }, [queryError, isRetrying]);

  const invalidateListings = () =>
    queryClient.invalidateQueries({ queryKey: SELLER_LISTINGS_QUERY_KEY });

  const create = useMutation({
    mutationFn: (input: CreateListingInput) => createListing(input),
    onSuccess: (created) => {
      track("seller_listing_created", {
        listingId: created.id,
        productId: created.productId,
        price: analyticsPrice(created.price),
        source: "seller",
      });
      toast({ title: "Listing criado" });
      void invalidateListings();
    },
    onError: (e) => {
      logTechnicalError(e);
      toast({
        title: "Erro ao criar",
        description: userFacingApiError(e),
        variant: "destructive",
      });
    },
  });

  const update = useMutation({
    mutationFn: ({ id, body }: { id: string; body: UpdateListingBody }) =>
      updateListing(id, body),
    onSuccess: () => {
      toast({ title: "Listing atualizado" });
      void invalidateListings();
    },
    onError: (e) => {
      logTechnicalError(e);
      toast({
        title: "Erro ao atualizar",
        description: userFacingApiError(e),
        variant: "destructive",
      });
    },
  });

  const updatePrice = useMutation({
    mutationFn: ({ id, newPrice }: { id: string; newPrice: number }) =>
      updateListingPrice(id, { newPrice }),
    onSuccess: () => {
      toast({ title: "Preço atualizado" });
      void invalidateListings();
    },
    onError: (e) => {
      logTechnicalError(e);
      toast({
        title: "Erro ao atualizar preço",
        description: userFacingApiError(e),
        variant: "destructive",
      });
    },
  });

  const cancel = useMutation({
    mutationFn: (listing: Listing) => cancelListing(listing.id),
    onSuccess: () => {
      toast({ title: "Listing cancelado" });
      void invalidateListings();
    },
    onError: (e) => {
      toast({
        title: "Erro ao cancelar",
        description: userFacingApiError(e),
        variant: "destructive",
      });
    },
  });

  const seller = sellerQuery.data ?? null;
  const pendingApproval = seller?.isApproved === false;
  const canCreateListing = seller?.isApproved === true;

  const reload = async () => {
    const sellerResult = await sellerQuery.refetch();
    if (sellerResult.isSuccess) {
      await listingsQuery.refetch();
    }
  };

  return {
    seller,
    listings: listingsQuery.data?.items ?? [],
    total: listingsQuery.data?.total ?? 0,
    loading,
    error,
    reload,
    canCreateListing,
    pendingApproval,
    create,
    update,
    updatePrice,
    cancel,
    isSaving: create.isPending || update.isPending || updatePrice.isPending,
    isCanceling: cancel.isPending,
  };
}
