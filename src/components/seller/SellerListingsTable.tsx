import { DollarSign, EyeOff, Pencil, Trash2 } from "lucide-react";
import { productDisplayName, SkinThumb } from "@/components/ProductCard";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { listingStatusLabel } from "@/lib/userFacingApiError";
import type { Listing } from "@/types/api";

export function SellerListingsTable({
  listings,
  onEditPrice,
  onEdit,
  onCancel,
  onDelete,
}: {
  listings: Listing[];
  onEditPrice: (listing: Listing) => void;
  onEdit: (listing: Listing) => void;
  onCancel: (listing: Listing) => void;
  onDelete: (listing: Listing) => void;
}) {
  return (
    <div className="overflow-hidden rounded-lg border border-border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Skin</TableHead>
            <TableHead className="hidden md:table-cell">Float</TableHead>
            <TableHead>Preço</TableHead>
            <TableHead>Status</TableHead>
            <TableHead className="text-right">Ações</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {listings.map((listing) => {
            const productName = productDisplayName(listing.product);
            return (
              <TableRow key={listing.id}>
                <TableCell>
                  <div className="flex items-center gap-3">
                    <SkinThumb product={listing.product} size="md" decorative />
                    <span className="font-medium">{productName}</span>
                  </div>
                </TableCell>
                <TableCell className="hidden md:table-cell text-muted-foreground">
                  {Number(listing.floatValue).toFixed(8)}
                </TableCell>
                <TableCell className="tabular-nums font-medium">
                  R$ {Number(listing.price).toFixed(2)}
                </TableCell>
                <TableCell>
                  <span
                    className={`text-xs font-medium px-2 py-1 rounded ${
                      listing.status === "ACTIVE"
                        ? "bg-primary/10 text-primary"
                        : listing.status === "SOLD"
                          ? "bg-green-500/10 text-green-500"
                          : "bg-muted text-muted-foreground"
                    }`}
                  >
                    {listingStatusLabel(listing.status)}
                  </span>
                </TableCell>
                <TableCell className="text-right">
                  <div className="flex items-center justify-end gap-1">
                    {listing.status === "ACTIVE" && (
                      <>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => onEditPrice(listing)}
                          title="Atualizar preço"
                          aria-label="Atualizar preço"
                        >
                          <DollarSign className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => onEdit(listing)}
                          title="Editar"
                          aria-label="Editar"
                        >
                          <Pencil className="h-4 w-4" />
                        </Button>
                      </>
                    )}
                    {listing.status === "ACTIVE" && (
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => onCancel(listing)}
                        title="Cancelar listing"
                        aria-label="Cancelar listing"
                      >
                        <EyeOff className="h-4 w-4" />
                      </Button>
                    )}
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => onDelete(listing)}
                      title="Excluir"
                      aria-label="Excluir"
                      className="text-destructive hover:text-destructive"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </div>
  );
}
