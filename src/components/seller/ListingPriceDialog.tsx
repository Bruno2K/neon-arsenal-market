import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
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
import { useToast } from "@/hooks/use-toast";
import { parseListingPrice } from "@/lib/sellerListingForm";
import type { Listing } from "@/types/api";

export function ListingPriceDialog({
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
  onSubmit: (newPrice: number) => Promise<void>;
}) {
  const { toast } = useToast();
  const [newPrice, setNewPrice] = useState("");

  useEffect(() => {
    if (!open || !listing) return;
    setNewPrice(String(listing.price));
  }, [open, listing]);

  const handleUpdate = async () => {
    const parsed = parseListingPrice(newPrice);
    if ("title" in parsed) {
      toast({ title: parsed.title, variant: "destructive" });
      return;
    }
    if (!listing) return;
    await onSubmit(parsed.price);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Atualizar Preço</DialogTitle>
          <DialogDescription>
            Informe o novo preço deste listing.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 py-4">
          <div className="grid gap-2">
            <Label htmlFor="newPrice">Novo Preço</Label>
            <Input
              id="newPrice"
              type="number"
              min="0"
              step="0.01"
              value={newPrice}
              onChange={(e) => setNewPrice(e.target.value)}
              placeholder="0.00"
            />
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
          <Button onClick={() => void handleUpdate()} disabled={saving}>
            {saving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
            Atualizar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
