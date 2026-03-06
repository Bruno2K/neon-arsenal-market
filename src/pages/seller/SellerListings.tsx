import { useEffect, useState } from "react";
import {
  Package,
  Pencil,
  Trash2,
  EyeOff,
  Eye,
  Loader2,
  DollarSign,
} from "lucide-react";
import {
  getSellerMe,
  getSellerListings,
  createListing,
  updateListing,
  updateListingPrice,
  cancelListing,
} from "@/api";
import type { Seller, Listing, Product } from "@/types/api";
import { listProducts } from "@/api/products";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

const emptyForm = {
  productId: "",
  floatValue: "",
  pattern: "",
  price: "",
  currency: "USD",
  tradeLockUntil: "",
  steamAssetId: "",
};

export default function SellerListings() {
  const [seller, setSeller] = useState<Seller | null>(null);
  const [listings, setListings] = useState<Listing[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [priceFormOpen, setPriceFormOpen] = useState(false);
  const [editingListing, setEditingListing] = useState<Listing | null>(null);
  const [priceListing, setPriceListing] = useState<Listing | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [newPrice, setNewPrice] = useState("");
  const [saving, setSaving] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<Listing | null>(null);
  const [deleting, setDeleting] = useState(false);
  const { toast } = useToast();

  const loadSeller = async () => {
    try {
      const s = await getSellerMe();
      setSeller(s);
      return s.id;
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erro ao carregar vendedor");
      return null;
    }
  };

  const loadListings = async () => {
    try {
      const res = await getSellerListings();
      setListings(res.items);
      setTotal(res.total);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erro ao carregar listings");
    } finally {
      setLoading(false);
    }
  };

  const loadProducts = async () => {
    try {
      const res = await listProducts({ page: 1, limit: 100 });
      setProducts(res.items);
    } catch (e) {
      console.error("Erro ao carregar produtos:", e);
    }
  };

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      setError(null);
      const sellerId = await loadSeller();
      if (cancelled || !sellerId) {
        if (!sellerId) setLoading(false);
        return;
      }
      await Promise.all([loadListings(), loadProducts()]);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const openCreate = () => {
    setEditingListing(null);
    setForm(emptyForm);
    setFormOpen(true);
  };

  const openEdit = (l: Listing) => {
    setEditingListing(l);
    setForm({
      productId: l.productId,
      floatValue: String(l.floatValue),
      pattern: l.pattern ? String(l.pattern) : "",
      price: String(l.price),
      currency: l.currency,
      tradeLockUntil: l.tradeLockUntil
        ? new Date(l.tradeLockUntil).toISOString().slice(0, 16)
        : "",
      steamAssetId: l.steamAssetId || "",
    });
    setFormOpen(true);
  };

  const openPriceEdit = (l: Listing) => {
    setPriceListing(l);
    setNewPrice(String(l.price));
    setPriceFormOpen(true);
  };

  const handleSave = async () => {
    const floatValue = parseFloat(form.floatValue);
    const price = parseFloat(form.price);
    const pattern = form.pattern ? parseInt(form.pattern, 10) : undefined;

    if (!form.productId) {
      toast({ title: "Produto é obrigatório", variant: "destructive" });
      return;
    }
    if (isNaN(floatValue) || floatValue < 0 || floatValue > 1) {
      toast({ title: "Float deve estar entre 0 e 1", variant: "destructive" });
      return;
    }
    if (isNaN(price) || price <= 0) {
      toast({ title: "Preço inválido", variant: "destructive" });
      return;
    }
    if (pattern !== undefined && (isNaN(pattern) || pattern < 0)) {
      toast({ title: "Pattern inválido", variant: "destructive" });
      return;
    }

    setSaving(true);
    try {
      if (editingListing) {
        await updateListing(editingListing.id, {
          price,
          tradeLockUntil: form.tradeLockUntil ? form.tradeLockUntil : null,
        });
        toast({ title: "Listing atualizado" });
      } else {
        await createListing({
          productId: form.productId,
          floatValue,
          pattern,
          price,
          currency: form.currency,
          tradeLockUntil: form.tradeLockUntil || undefined,
          steamAssetId: form.steamAssetId || undefined,
        });
        toast({ title: "Listing criado" });
      }
      setFormOpen(false);
      await loadListings();
    } catch (e) {
      toast({
        title: editingListing ? "Erro ao atualizar" : "Erro ao criar",
        description: e instanceof Error ? e.message : undefined,
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  const handlePriceUpdate = async () => {
    const price = parseFloat(newPrice);
    if (!priceListing) return;
    if (isNaN(price) || price <= 0) {
      toast({ title: "Preço inválido", variant: "destructive" });
      return;
    }
    setSaving(true);
    try {
      await updateListingPrice(priceListing.id, { newPrice: price });
      toast({ title: "Preço atualizado" });
      setPriceFormOpen(false);
      await loadListings();
    } catch (e) {
      toast({
        title: "Erro ao atualizar preço",
        description: e instanceof Error ? e.message : undefined,
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  const handleCancel = async (l: Listing) => {
    try {
      await cancelListing(l.id);
      toast({ title: "Listing cancelado" });
      await loadListings();
    } catch (e) {
      toast({
        title: "Erro ao cancelar",
        description: e instanceof Error ? e.message : undefined,
        variant: "destructive",
      });
    }
  };

  const confirmDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await cancelListing(deleteTarget.id);
      toast({ title: "Listing cancelado" });
      setDeleteTarget(null);
      await loadListings();
    } catch (e) {
      toast({
        title: "Erro ao cancelar",
        description: e instanceof Error ? e.message : undefined,
        variant: "destructive",
      });
    } finally {
      setDeleting(false);
    }
  };

  if (error && !seller) {
    return (
      <div className="space-y-4">
        <h1 className="text-2xl font-heading text-foreground">Meus Listings</h1>
        <p className="text-destructive">{error}</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-heading text-foreground">Meus Listings</h1>
        <Button onClick={openCreate} disabled={!seller}>
          <Package className="h-4 w-4 mr-2" />
          Novo Listing
        </Button>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      ) : (
        <div className="rounded-lg border border-border overflow-hidden">
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
              {listings.length === 0 ? (
                <TableRow>
                  <TableCell
                    colSpan={5}
                    className="text-center text-muted-foreground py-8"
                  >
                    Nenhum listing. Clique em Novo Listing para criar.
                  </TableCell>
                </TableRow>
              ) : (
                listings.map((l) => {
                  const productName = `${l.product.weapon} | ${l.product.skinName} (${l.product.exterior})`;
                  return (
                    <TableRow key={l.id}>
                      <TableCell className="font-medium">
                        {productName}
                      </TableCell>
                      <TableCell className="hidden md:table-cell text-muted-foreground">
                        {Number(l.floatValue).toFixed(8)}
                      </TableCell>
                      <TableCell className="text-primary font-heading">
                        ${Number(l.price).toFixed(2)}
                      </TableCell>
                      <TableCell>
                        <span
                          className={`text-xs font-medium px-2 py-1 rounded ${
                            l.status === "ACTIVE"
                              ? "bg-primary/10 text-primary"
                              : l.status === "SOLD"
                                ? "bg-green-500/10 text-green-500"
                                : "bg-muted text-muted-foreground"
                          }`}
                        >
                          {l.status}
                        </span>
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-1">
                          {l.status === "ACTIVE" && (
                            <>
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => openPriceEdit(l)}
                                title="Atualizar preço"
                              >
                                <DollarSign className="h-4 w-4" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => openEdit(l)}
                                title="Editar"
                              >
                                <Pencil className="h-4 w-4" />
                              </Button>
                            </>
                          )}
                          {l.status === "ACTIVE" && (
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => handleCancel(l)}
                              title="Cancelar listing"
                            >
                              <EyeOff className="h-4 w-4" />
                            </Button>
                          )}
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => setDeleteTarget(l)}
                            title="Excluir"
                            className="text-destructive hover:text-destructive"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        </div>
      )}

      <Dialog open={formOpen} onOpenChange={setFormOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>
              {editingListing ? "Editar listing" : "Novo listing"}
            </DialogTitle>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="productId">Produto</Label>
              <Select
                value={form.productId}
                onValueChange={(value) =>
                  setForm((f) => ({ ...f, productId: value }))
                }
                disabled={!!editingListing}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Selecione um produto" />
                </SelectTrigger>
                <SelectContent>
                  {products.map((p) => (
                    <SelectItem key={p.id} value={p.id}>
                      {p.weapon} | {p.skinName} ({p.exterior})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
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
                    setForm((f) => ({ ...f, floatValue: e.target.value }))
                  }
                  placeholder="0.00000000"
                  disabled={!!editingListing}
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
                    setForm((f) => ({ ...f, pattern: e.target.value }))
                  }
                  placeholder="Opcional"
                  disabled={!!editingListing}
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
                    setForm((f) => ({ ...f, price: e.target.value }))
                  }
                  placeholder="0.00"
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="currency">Moeda</Label>
                <Select
                  value={form.currency}
                  onValueChange={(value) =>
                    setForm((f) => ({ ...f, currency: value }))
                  }
                >
                  <SelectTrigger>
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
                <Label htmlFor="tradeLockUntil">
                  Trade Lock Até (opcional)
                </Label>
                <Input
                  id="tradeLockUntil"
                  type="datetime-local"
                  value={form.tradeLockUntil}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, tradeLockUntil: e.target.value }))
                  }
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="steamAssetId">Steam Asset ID (opcional)</Label>
                <Input
                  id="steamAssetId"
                  value={form.steamAssetId}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, steamAssetId: e.target.value }))
                  }
                  placeholder="Opcional"
                />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setFormOpen(false)}
              disabled={saving}
            >
              Cancelar
            </Button>
            <Button onClick={handleSave} disabled={saving}>
              {saving ? (
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
              ) : null}
              {editingListing ? "Salvar" : "Criar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={priceFormOpen} onOpenChange={setPriceFormOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Atualizar Preço</DialogTitle>
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
              onClick={() => setPriceFormOpen(false)}
              disabled={saving}
            >
              Cancelar
            </Button>
            <Button onClick={handlePriceUpdate} disabled={saving}>
              {saving ? (
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
              ) : null}
              Atualizar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog
        open={!!deleteTarget}
        onOpenChange={(open) => !open && setDeleteTarget(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Cancelar listing?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta ação cancelará o listing permanentemente.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmDelete}
              disabled={deleting}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deleting ? (
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
              ) : null}
              Confirmar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
