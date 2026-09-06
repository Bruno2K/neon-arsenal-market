import { useState } from "react";
import { Navigate } from "react-router-dom";
import { Loader2, Package } from "lucide-react";
import { ListingCancelDialog } from "@/components/seller/ListingCancelDialog";
import { ListingFormDialog } from "@/components/seller/ListingFormDialog";
import { ListingPriceDialog } from "@/components/seller/ListingPriceDialog";
import { SellerListingsTable } from "@/components/seller/SellerListingsTable";
import { EmptyState, ErrorState } from "@/components/page-state";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/contexts/AuthContext";
import { useSellerListings } from "@/hooks/useSellerListings";
import type { Listing } from "@/types/api";

function CreateListingButton({
  canCreateListing,
  pendingApproval,
  onClick,
}: {
  canCreateListing: boolean;
  pendingApproval: boolean;
  onClick: () => void;
}) {
  const label = pendingApproval ? "Disponível após aprovação" : "Novo Listing";
  return (
    <Button
      onClick={onClick}
      disabled={!canCreateListing}
      title={pendingApproval ? "Disponível após aprovação" : undefined}
    >
      {canCreateListing ? <Package className="mr-2 h-4 w-4" /> : null}
      {label}
    </Button>
  );
}

export default function SellerListings() {
  const { user } = useAuth();
  const isAdmin = user?.role === "ADMIN";
  const {
    listings,
    loading,
    error,
    reload,
    canCreateListing,
    pendingApproval,
    create,
    update,
    updatePrice,
    cancel,
    isSaving,
    isCanceling,
  } = useSellerListings({ enabled: !isAdmin });

  const [formOpen, setFormOpen] = useState(false);
  const [editingListing, setEditingListing] = useState<Listing | null>(null);
  const [priceListing, setPriceListing] = useState<Listing | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Listing | null>(null);

  if (isAdmin) {
    return <Navigate to="/admin" replace />;
  }

  const openCreate = () => {
    if (!canCreateListing) return;
    setEditingListing(null);
    setFormOpen(true);
  };

  if (error) {
    return (
      <ErrorState
        title="Erro ao carregar listings"
        description={error}
        action={
          <Button type="button" variant="outline" onClick={() => void reload()}>
            Tentar novamente
          </Button>
        }
      />
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">
            Meus listings
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            CRUD de itens únicos. O catálogo de produtos é somente leitura.
          </p>
        </div>
        <CreateListingButton
          canCreateListing={canCreateListing}
          pendingApproval={pendingApproval}
          onClick={openCreate}
        />
      </div>

      {loading ? (
        <div
          className="flex items-center justify-center py-12"
          role="status"
          aria-label="Carregando"
        >
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      ) : listings.length === 0 ? (
        <EmptyState
          title="Nenhum listing"
          description={
            pendingApproval
              ? "Você poderá anunciar depois que um admin aprovar."
              : "Crie um item único a partir do catálogo de produtos."
          }
          action={
            <CreateListingButton
              canCreateListing={canCreateListing}
              pendingApproval={pendingApproval}
              onClick={openCreate}
            />
          }
        />
      ) : (
        <SellerListingsTable
          listings={listings}
          onEditPrice={setPriceListing}
          onEdit={(listing) => {
            setEditingListing(listing);
            setFormOpen(true);
          }}
          onCancel={(listing) => {
            void cancel.mutateAsync(listing).catch(() => undefined);
          }}
          onDelete={setDeleteTarget}
        />
      )}

      <ListingFormDialog
        open={formOpen}
        listing={editingListing}
        saving={isSaving}
        onOpenChange={(open) => {
          setFormOpen(open);
          if (!open) setEditingListing(null);
        }}
        onSubmit={async (payload) => {
          try {
            if (payload.mode === "update") {
              if (!editingListing) return;
              await update.mutateAsync({
                id: editingListing.id,
                body: payload.input,
              });
            } else {
              await create.mutateAsync(payload.input);
            }
            setFormOpen(false);
            setEditingListing(null);
          } catch {
            // Toast is owned by the mutation.
          }
        }}
      />

      <ListingPriceDialog
        open={!!priceListing}
        listing={priceListing}
        saving={isSaving}
        onOpenChange={(open) => {
          if (!open) setPriceListing(null);
        }}
        onSubmit={async (newPrice) => {
          if (!priceListing) return;
          try {
            await updatePrice.mutateAsync({ id: priceListing.id, newPrice });
            setPriceListing(null);
          } catch {
            // Toast is owned by the mutation.
          }
        }}
      />

      <ListingCancelDialog
        listing={deleteTarget}
        deleting={isCanceling}
        onOpenChange={(open) => {
          if (!open) setDeleteTarget(null);
        }}
        onConfirm={() => {
          if (!deleteTarget) return;
          void cancel
            .mutateAsync(deleteTarget)
            .then(() => {
              setDeleteTarget(null);
            })
            .catch(() => undefined);
        }}
      />
    </div>
  );
}
