import { FormEvent, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  createProduct,
  deleteProduct,
  listProducts,
  updateProduct,
} from "@/api/products";
import { EmptyState, ErrorState } from "@/components/page-state";
import { SkinThumb } from "@/components/ProductCard";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { MARKET_EXTERIORS } from "@/lib/marketQuery";
import { MARKET_RARITIES } from "@/lib/catalogTaxonomy";
import { useToast } from "@/hooks/use-toast";
import { userFacingApiError } from "@/lib/userFacingApiError";
import type { Product } from "@/types/api";

const PAGE_SIZE = 20;

interface ProductFormState {
  game: string;
  weapon: string;
  skinName: string;
  rarity: string;
  exterior: string;
  collection: string;
  imageUrl: string;
  isStattrak: boolean;
  isSouvenir: boolean;
}

const emptyForm = (): ProductFormState => ({
  game: "CS2",
  weapon: "",
  skinName: "",
  rarity: "Classified",
  exterior: "Field-Tested",
  collection: "",
  imageUrl: "",
  isStattrak: false,
  isSouvenir: false,
});

function formFromProduct(product: Product): ProductFormState {
  return {
    game: product.game,
    weapon: product.weapon,
    skinName: product.skinName,
    rarity: product.rarity,
    exterior: product.exterior,
    collection: product.collection ?? "",
    imageUrl: product.imageUrl ?? "",
    isStattrak: product.isStattrak,
    isSouvenir: product.isSouvenir,
  };
}

export default function AdminProducts() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [page, setPage] = useState(1);
  const [editor, setEditor] = useState<
    { mode: "create" } | { mode: "edit"; product: Product } | null
  >(null);
  const [form, setForm] = useState<ProductFormState>(emptyForm);
  const [formError, setFormError] = useState<string | null>(null);
  const [pendingDelete, setPendingDelete] = useState<Product | null>(null);

  const listQuery = useQuery({
    queryKey: ["admin-products", page],
    queryFn: () => listProducts({ page, limit: PAGE_SIZE }),
  });

  const invalidate = () => {
    void queryClient.invalidateQueries({ queryKey: ["admin-products"] });
  };

  const save = useMutation({
    mutationFn: async () => {
      const body = {
        game: form.game.trim() || "CS2",
        weapon: form.weapon.trim(),
        skinName: form.skinName.trim(),
        rarity: form.rarity,
        exterior: form.exterior,
        collection: form.collection.trim() || undefined,
        imageUrl: form.imageUrl.trim() || undefined,
        isStattrak: form.isStattrak,
        isSouvenir: form.isSouvenir,
      };
      if (editor?.mode === "edit") {
        return updateProduct(editor.product.id, body);
      }
      return createProduct(body);
    },
    onSuccess: () => {
      toast({
        title:
          editor?.mode === "edit" ? "Produto atualizado" : "Produto criado",
      });
      setEditor(null);
      invalidate();
    },
    onError: (error) => {
      setFormError(userFacingApiError(error));
    },
  });

  const remove = useMutation({
    mutationFn: (id: string) => deleteProduct(id),
    onSuccess: () => {
      toast({ title: "Produto removido" });
      setPendingDelete(null);
      invalidate();
    },
    onError: (error) => {
      toast({ title: userFacingApiError(error), variant: "destructive" });
    },
  });

  const openCreate = () => {
    setForm(emptyForm());
    setFormError(null);
    setEditor({ mode: "create" });
  };

  const openEdit = (product: Product) => {
    setForm(formFromProduct(product));
    setFormError(null);
    setEditor({ mode: "edit", product });
  };

  const handleSubmit = (event: FormEvent) => {
    event.preventDefault();
    if (!form.weapon.trim() || !form.skinName.trim()) {
      setFormError("Informe arma e nome da skin.");
      return;
    }
    save.mutate();
  };

  if (listQuery.isLoading) {
    return (
      <div className="space-y-4" role="status" aria-label="Carregando">
        <Skeleton className="h-8 w-40" />
        <Skeleton className="h-48 w-full" />
      </div>
    );
  }

  if (listQuery.isError) {
    return (
      <ErrorState
        title="Erro ao carregar produtos"
        error={listQuery.error}
        action={
          <Button
            type="button"
            variant="outline"
            onClick={() => void listQuery.refetch()}
          >
            Tentar novamente
          </Button>
        }
      />
    );
  }

  const items = listQuery.data?.items ?? [];
  const total = listQuery.data?.total ?? 0;
  const pageCount = Math.max(1, Math.ceil(total / PAGE_SIZE));

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Produtos</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Catálogo base. Sellers só leem; só admin cria, edita e remove.
          </p>
        </div>
        <Button type="button" onClick={openCreate}>
          Novo produto
        </Button>
      </div>

      {items.length === 0 ? (
        <EmptyState
          title="Nenhum produto no catálogo"
          description="Cadastre a primeira skin para os sellers anunciarem."
          action={
            <Button type="button" onClick={openCreate}>
              Novo produto
            </Button>
          }
        />
      ) : (
        <div className="overflow-hidden rounded-md border border-border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Skin</TableHead>
                <TableHead>Raridade</TableHead>
                <TableHead className="hidden md:table-cell">Exterior</TableHead>
                <TableHead className="text-right">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {items.map((product) => (
                <TableRow key={product.id}>
                  <TableCell>
                    <div className="flex items-center gap-3">
                      <SkinThumb product={product} size="md" decorative />
                      <span className="font-medium">
                        {product.weapon} | {product.skinName}
                      </span>
                    </div>
                  </TableCell>
                  <TableCell>{product.rarity}</TableCell>
                  <TableCell className="hidden text-muted-foreground md:table-cell">
                    {product.exterior}
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-2">
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        onClick={() => openEdit(product)}
                      >
                        Editar
                      </Button>
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        onClick={() => setPendingDelete(product)}
                      >
                        Excluir
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      {total > PAGE_SIZE ? (
        <div className="flex justify-between text-sm text-muted-foreground">
          <span className="tabular-nums">{total} produtos</span>
          <div className="flex gap-2">
            <Button
              type="button"
              size="sm"
              variant="outline"
              disabled={page <= 1}
              onClick={() => setPage((current) => Math.max(1, current - 1))}
            >
              Anterior
            </Button>
            <Button
              type="button"
              size="sm"
              variant="outline"
              disabled={page >= pageCount}
              onClick={() => setPage((current) => current + 1)}
            >
              Próxima
            </Button>
          </div>
        </div>
      ) : null}

      <Dialog
        open={editor != null}
        onOpenChange={(open) => !open && setEditor(null)}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {editor?.mode === "edit" ? "Editar produto" : "Novo produto"}
            </DialogTitle>
            <DialogDescription>
              Campos do DTO de produto. Sellers não usam este formulário.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-3">
            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <Label htmlFor="product-weapon">Arma</Label>
                <Input
                  id="product-weapon"
                  className="mt-1.5"
                  value={form.weapon}
                  onChange={(event) =>
                    setForm((current) => ({
                      ...current,
                      weapon: event.target.value,
                    }))
                  }
                  required
                />
              </div>
              <div>
                <Label htmlFor="product-skin">Skin</Label>
                <Input
                  id="product-skin"
                  className="mt-1.5"
                  value={form.skinName}
                  onChange={(event) =>
                    setForm((current) => ({
                      ...current,
                      skinName: event.target.value,
                    }))
                  }
                  required
                />
              </div>
              <div>
                <Label htmlFor="product-rarity">Raridade</Label>
                <select
                  id="product-rarity"
                  className="mt-1.5 flex h-11 w-full rounded-md border border-input bg-background px-3 text-sm"
                  value={form.rarity}
                  onChange={(event) =>
                    setForm((current) => ({
                      ...current,
                      rarity: event.target.value,
                    }))
                  }
                >
                  {MARKET_RARITIES.map((rarity) => (
                    <option key={rarity} value={rarity}>
                      {rarity}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <Label htmlFor="product-exterior">Exterior</Label>
                <select
                  id="product-exterior"
                  className="mt-1.5 flex h-11 w-full rounded-md border border-input bg-background px-3 text-sm"
                  value={form.exterior}
                  onChange={(event) =>
                    setForm((current) => ({
                      ...current,
                      exterior: event.target.value,
                    }))
                  }
                >
                  {MARKET_EXTERIORS.filter(Boolean).map((exterior) => (
                    <option key={exterior} value={exterior}>
                      {exterior}
                    </option>
                  ))}
                </select>
              </div>
            </div>
            <div>
              <Label htmlFor="product-collection">Coleção</Label>
              <Input
                id="product-collection"
                className="mt-1.5"
                value={form.collection}
                onChange={(event) =>
                  setForm((current) => ({
                    ...current,
                    collection: event.target.value,
                  }))
                }
              />
            </div>
            <div>
              <Label htmlFor="product-image">imageUrl</Label>
              <Input
                id="product-image"
                className="mt-1.5"
                value={form.imageUrl}
                onChange={(event) =>
                  setForm((current) => ({
                    ...current,
                    imageUrl: event.target.value,
                  }))
                }
              />
            </div>
            <div className="flex gap-4 text-sm">
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={form.isStattrak}
                  onChange={(event) =>
                    setForm((current) => ({
                      ...current,
                      isStattrak: event.target.checked,
                    }))
                  }
                />
                StatTrak™
              </label>
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={form.isSouvenir}
                  onChange={(event) =>
                    setForm((current) => ({
                      ...current,
                      isSouvenir: event.target.checked,
                    }))
                  }
                />
                Souvenir
              </label>
            </div>
            {formError ? (
              <p className="text-sm text-destructive" role="alert">
                {formError}
              </p>
            ) : null}
            <DialogFooter>
              <Button type="submit" disabled={save.isPending}>
                {save.isPending ? "Salvando..." : "Salvar"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <AlertDialog
        open={pendingDelete != null}
        onOpenChange={(open) => !open && setPendingDelete(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir produto?</AlertDialogTitle>
            <AlertDialogDescription>
              {pendingDelete
                ? `${pendingDelete.weapon} | ${pendingDelete.skinName} será removido do catálogo.`
                : ""}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => pendingDelete && remove.mutate(pendingDelete.id)}
            >
              Confirmar exclusão
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
