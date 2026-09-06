import { FormEvent, useState } from "react";
import { Link } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { applySeller, getSellerMe } from "@/api/sellers";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { userFacingApiError } from "@/lib/userFacingApiError";
import type { User } from "@/types/api";

const STORE_NAME_MAX = 120;

export function ApplySellerCard({ role }: { role: User["role"] }) {
  const queryClient = useQueryClient();
  const [storeName, setStoreName] = useState("");
  const sellerQuery = useQuery({
    queryKey: ["sellerMe"],
    queryFn: () => getSellerMe(),
    retry: false,
    enabled: role === "CUSTOMER" || role === "SELLER",
  });

  const apply = useMutation({
    mutationFn: () => applySeller({ storeName: storeName.trim() }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["sellerMe"] });
    },
  });

  if (role === "ADMIN") return null;

  if (role === "SELLER" && sellerQuery.data?.isApproved) {
    return (
      <div className="rounded-md border border-border p-4">
        <h2 className="text-lg font-semibold tracking-tight">Sua loja</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Conta de vendedor aprovada.
        </p>
        <Button asChild className="mt-3">
          <Link to="/seller">Ir ao dashboard</Link>
        </Button>
      </div>
    );
  }

  if (sellerQuery.data && sellerQuery.data.isApproved === false) {
    return (
      <div className="rounded-md border border-border p-4">
        <h2 className="text-lg font-semibold tracking-tight">Quero vender</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Pedido enviado para {sellerQuery.data.storeName}. Aguardando aprovação
          de um admin.
        </p>
      </div>
    );
  }

  if (role !== "CUSTOMER") return null;

  const handleSubmit = (event: FormEvent) => {
    event.preventDefault();
    if (!storeName.trim() || apply.isPending) return;
    apply.mutate();
  };

  return (
    <div className="rounded-md border border-border p-4">
      <h2 className="text-lg font-semibold tracking-tight">Quero vender</h2>
      <p className="mt-1 text-sm text-muted-foreground">
        Envie o nome da loja. Um admin aprova o cadastro nas telas atuais. Não
        enviamos e-mail de aprovação por aqui.
      </p>
      <form onSubmit={handleSubmit} className="mt-4 space-y-3">
        <div>
          <Label htmlFor="apply-store-name">Nome da loja</Label>
          <Input
            id="apply-store-name"
            value={storeName}
            maxLength={STORE_NAME_MAX}
            onChange={(event) => setStoreName(event.target.value)}
            className="mt-1.5"
            required
          />
        </div>
        {apply.isError ? (
          <p className="text-sm text-destructive" role="alert">
            {userFacingApiError(apply.error)}
          </p>
        ) : null}
        <Button type="submit" disabled={!storeName.trim() || apply.isPending}>
          {apply.isPending ? "Enviando..." : "Enviar candidatura"}
        </Button>
      </form>
    </div>
  );
}
