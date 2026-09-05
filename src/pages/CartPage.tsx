import { Link } from "react-router-dom";
import { Trash2 } from "lucide-react";
import { useCart } from "@/contexts/CartContext";
import { EmptyState } from "@/components/page-state";
import { Button } from "@/components/ui/button";

function listingLabel(listing: {
  product: { weapon: string; skinName: string; exterior: string };
}) {
  return `${listing.product.weapon} | ${listing.product.skinName} (${listing.product.exterior})`;
}

export default function CartPage() {
  const { items, removeItem, totalPrice, totalItems } = useCart();
  const serviceFee = totalPrice * 0.05;
  const total = totalPrice * 1.05;

  if (items.length === 0) {
    return (
      <div className="container py-8">
        <h1 className="sr-only">Carrinho</h1>
        <EmptyState
          title="Carrinho vazio"
          description="Adicione itens do marketplace para começar."
          action={
            <Button asChild>
              <Link to="/products">Explorar Market</Link>
            </Button>
          }
        />
      </div>
    );
  }

  return (
    <div className="container py-8">
      <div className="mb-8">
        <h1 className="text-2xl font-semibold tracking-tight">Carrinho</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {totalItems} item{totalItems !== 1 ? "s" : ""} · item único
        </p>
      </div>

      <div className="grid gap-8 lg:grid-cols-3">
        <ul className="space-y-3 lg:col-span-2">
          {items.map(({ listing }) => {
            const name = listingLabel(listing);
            return (
              <li
                key={listing.id}
                className="flex items-center gap-4 rounded-md border border-border bg-card p-4"
              >
                <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-md bg-muted px-1 text-center text-[10px] leading-tight text-muted-foreground">
                  {listing.product.weapon}
                </div>
                <div className="min-w-0 flex-1">
                  <Link
                    to={`/listing/${listing.id}`}
                    className="block truncate text-sm font-medium text-foreground hover:underline"
                  >
                    {name}
                  </Link>
                  <p className="mt-1 text-xs tabular-float text-muted-foreground">
                    Float {Number(listing.floatValue).toFixed(8)}
                    {listing.pattern ? ` · Pattern ${listing.pattern}` : ""}
                  </p>
                  <p className="mt-1 text-sm tabular-price text-foreground">
                    ${Number(listing.price).toFixed(2)}
                  </p>
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  className="text-muted-foreground hover:text-destructive"
                  onClick={() => removeItem(listing.id)}
                  aria-label={`Remover ${name}`}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </li>
            );
          })}
        </ul>

        <aside className="h-fit space-y-4 rounded-md border border-border bg-card p-6 lg:sticky lg:top-20">
          <h2 className="text-sm font-semibold tracking-tight">Resumo</h2>
          <dl className="space-y-2 text-sm">
            <div className="flex justify-between text-muted-foreground">
              <dt>Subtotal</dt>
              <dd className="tabular-price">${totalPrice.toFixed(2)}</dd>
            </div>
            <div className="flex justify-between text-muted-foreground">
              <dt>Taxa de serviço</dt>
              <dd className="tabular-price">${serviceFee.toFixed(2)}</dd>
            </div>
            <div className="flex justify-between border-t border-border pt-2 text-base font-medium text-foreground">
              <dt>Total</dt>
              <dd className="tabular-price">${total.toFixed(2)}</dd>
            </div>
          </dl>
          <Button asChild className="w-full" size="lg">
            <Link to="/checkout">Finalizar compra</Link>
          </Button>
          <p className="text-xs text-muted-foreground">
            O pagamento é confirmado só depois do retorno do PayPal.
          </p>
        </aside>
      </div>
    </div>
  );
}
