import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import { ProductCatalogPicker } from "@/components/seller/ProductCatalogPicker";
import { productDisplayName, SkinVisual } from "@/components/ProductCard";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import {
  emptyListingForm,
  listingToForm,
  parseListingForm,
  type ListingFormValues,
} from "@/lib/sellerListingForm";
import type { Listing, Product } from "@/types/api";

export type ListingFormCreateInput = {
  productId: string;
  floatValue: number;
  pattern?: number;
  price: number;
  currency: string;
  tradeLockUntil?: string;
  steamAssetId?: string;
};

export type ListingFormUpdateInput = {
  price: number;
  tradeLockUntil: string | null;
};

export type ListingFormSubmit =
  | { mode: "create"; input: ListingFormCreateInput }
  | { mode: "update"; input: ListingFormUpdateInput };

export function ListingFormDialog({
  open,
  listing,
  saving,
  onOpenChange,
  onSubmit,
}: {
  open: boolean;
  listing: Listing | null;
  saving: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (payload: ListingFormSubmit) => Promise<void>;
}) {
  const { toast } = useToast();
  const [form, setForm] = useState<ListingFormValues>(emptyListingForm);
  const [selectedProduct, setSelectedProduct] = useState<Product | undefined>();

  useEffect(() => {
    if (!open) return;
    if (listing) {
      setForm(listingToForm(listing));
      setSelectedProduct(listing.product);
      return;
    }
    setForm(emptyListingForm);
    setSelectedProduct(undefined);
  }, [open, listing]);

  const handleSave = async () => {
    const parsed = parseListingForm(form);
    if ("title" in parsed) {
      toast({ title: parsed.title, variant: "destructive" });
      return;
    }

    if (listing) {
      await onSubmit({
        mode: "update",
        input: {
          price: parsed.value.price,
          tradeLockUntil: form.tradeLockUntil ? form.tradeLockUntil : null,
        },
      });
      return;
    }

    await onSubmit({
      mode: "create",
      input: {
        productId: form.productId,
        floatValue: parsed.value.floatValue,
        pattern: parsed.value.pattern,
        price: parsed.value.price,
        currency: form.currency,
        tradeLockUntil: form.tradeLockUntil || undefined,
        steamAssetId: form.steamAssetId || undefined,
      },
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] max-w-2xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {listing ? "Editar listing" : "Novo listing"}
          </DialogTitle>
          <DialogDescription>
            {listing
              ? "Atualize os dados deste item único."
              : "Cadastre um item único a partir do catálogo."}
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 py-4">
          <div className="grid gap-2">
            <Label id="productId-label">Produto</Label>
            {listing ? null : (
              <ProductCatalogPicker
                selectedProduct={selectedProduct}
                enabled={open}
                onSelect={(product) => {
                  setSelectedProduct(product);
                  setForm((current) => ({ ...current, productId: product.id }));
                }}
              />
            )}
            {selectedProduct ? (
              <div className="flex items-center gap-3 rounded-md border border-border bg-muted/40 p-3">
                <div className="flex h-20 w-28 shrink-0 items-center justify-center overflow-hidden rounded-md bg-black/40 ring-1 ring-border">
                  <SkinVisual
                    product={selectedProduct}
                    className="text-sm"
                    padded={false}
                  />
                </div>
                <p className="text-sm font-medium">
                  {productDisplayName(selectedProduct)}
                </p>
              </div>
            ) : null}
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="grid gap-2">
              <Label htmlFor="floatValue">Float (0-1)</Label>
              <Input
                id="floatValue"
                type="number"
                min="0"
                max="1"
                step="0.00000001"
                value={form.floatValue}
                onChange={(e) =>
                  setForm((current) => ({
                    ...current,
                    floatValue: e.target.value,
                  }))
                }
                placeholder="0.00000000"
                disabled={!!listing}
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="pattern">Pattern (opcional)</Label>
              <Input
                id="pattern"
                type="number"
                min="0"
                value={form.pattern}
                onChange={(e) =>
                  setForm((current) => ({
                    ...current,
                    pattern: e.target.value,
                  }))
                }
                placeholder="Opcional"
                disabled={!!listing}
              />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="grid gap-2">
              <Label htmlFor="price">Preço</Label>
              <Input
                id="price"
                type="number"
                min="0"
                step="0.01"
                value={form.price}
                onChange={(e) =>
                  setForm((current) => ({ ...current, price: e.target.value }))
                }
                placeholder="0.00"
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="currency" id="currency-label">
                Moeda
              </Label>
              <Select
                value={form.currency}
                onValueChange={(value) =>
                  setForm((current) => ({ ...current, currency: value }))
                }
              >
                <SelectTrigger id="currency" aria-labelledby="currency-label">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="USD">USD</SelectItem>
                  <SelectItem value="BRL">BRL</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="grid gap-2">
              <Label htmlFor="tradeLockUntil">Trade Lock Até (opcional)</Label>
              <Input
                id="tradeLockUntil"
                type="datetime-local"
                value={form.tradeLockUntil}
                onChange={(e) =>
                  setForm((current) => ({
                    ...current,
                    tradeLockUntil: e.target.value,
                  }))
                }
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="steamAssetId">Steam Asset ID (opcional)</Label>
              <Input
                id="steamAssetId"
                value={form.steamAssetId}
                onChange={(e) =>
                  setForm((current) => ({
                    ...current,
                    steamAssetId: e.target.value,
                  }))
                }
                placeholder="Opcional"
              />
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={saving}
          >
            Cancelar
          </Button>
          <Button onClick={() => void handleSave()} disabled={saving}>
            {saving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
            {listing ? "Salvar" : "Criar"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
