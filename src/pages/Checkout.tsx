import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useCart } from "@/contexts/CartContext";
import { useAuth } from "@/contexts/AuthContext";
import { createOrder } from "@/api/orders";
import { createPaymentLink } from "@/api/payments";
import { EmptyState } from "@/components/page-state";
import { Button } from "@/components/ui/button";

export default function Checkout() {
  const { items, totalPrice } = useCart();
  const { isAuthenticated, user } = useAuth();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const serviceFee = totalPrice * 0.05;
  const total = totalPrice * 1.05;

  if (items.length === 0) {
    return (
      <div className="container py-8">
        <h1 className="sr-only">Checkout</h1>
        <EmptyState
          title="Carrinho vazio"
          description="Adicione um listing ativo antes de pagar."
          action={
            <Button asChild>
              <Link to="/products">Ir ao Market</Link>
            </Button>
          }
        />
      </div>
    );
  }

  if (!isAuthenticated || user?.role !== "CUSTOMER") {
    return (
      <div className="container py-8">
        <h1 className="sr-only">Checkout</h1>
        <EmptyState
          title="Login de comprador necessário"
          description="Faça login como comprador para finalizar a compra."
          action={
            <Button
              onClick={() =>
                navigate("/login", {
                  state: { from: { pathname: "/checkout" } },
                })
              }
            >
              Ir para Login
            </Button>
          }
        />
      </div>
    );
  }

  const handlePay = async () => {
    setError(null);
    setLoading(true);
    try {
      const order = await createOrder({
        items: items.map(({ listing }) => ({ listingId: listing.id })),
      });
      const payment = await createPaymentLink({ orderId: order.id });
      if (payment.approvalUrl) {
        window.location.href = payment.approvalUrl;
        return;
      }
      setError(
        "Não foi possível obter o link do PayPal. O pagamento ainda não foi confirmado.",
      );
    } catch (e) {
      setError(e instanceof Error ? e.message : "Falha ao criar pedido");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="container max-w-2xl py-8">
      <div className="mb-8">
        <h1 className="text-2xl font-semibold tracking-tight">Checkout</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Revise os itens e pague no PayPal. Nada é confirmado nesta tela.
        </p>
      </div>

      <div className="space-y-6">
        <section className="space-y-3 rounded-md border border-border bg-card p-4">
          <h2 className="text-sm font-medium text-muted-foreground">
            Itens ({items.length})
          </h2>
          <ul className="space-y-2">
            {items.map(({ listing }) => {
              const name = `${listing.product.weapon} | ${listing.product.skinName} (${listing.product.exterior})`;
              return (
                <li
                  key={listing.id}
                  className="flex justify-between gap-4 text-sm"
                >
                  <span className="min-w-0 truncate text-foreground">
                    {name}
                  </span>
                  <span className="shrink-0 tabular-price text-muted-foreground">
                    ${Number(listing.price).toFixed(2)}
                  </span>
                </li>
              );
            })}
          </ul>
          <dl className="space-y-1 border-t border-border pt-3 text-sm">
            <div className="flex justify-between text-muted-foreground">
              <dt>Subtotal</dt>
              <dd className="tabular-price">${totalPrice.toFixed(2)}</dd>
            </div>
            <div className="flex justify-between text-muted-foreground">
              <dt>Taxa de serviço</dt>
              <dd className="tabular-price">${serviceFee.toFixed(2)}</dd>
            </div>
            <div className="flex justify-between pt-1 text-base font-medium text-foreground">
              <dt>Total</dt>
              <dd className="tabular-price">${total.toFixed(2)}</dd>
            </div>
          </dl>
        </section>

        <section className="space-y-4 rounded-md border border-border bg-card p-6">
          <h2 className="text-sm font-semibold tracking-tight">PayPal</h2>
          <p className="text-sm text-muted-foreground">
            Você será redirecionado ao PayPal. O pagamento só é confirmado
            depois que o provedor retornar o resultado — esta página não marca o
            pedido como pago.
          </p>
          {error ? (
            <p className="text-sm text-destructive" role="alert">
              {error}
            </p>
          ) : null}
          <Button
            className="w-full"
            size="lg"
            onClick={handlePay}
            disabled={loading}
          >
            {loading
              ? "Abrindo o PayPal..."
              : `Pagar com PayPal — $${total.toFixed(2)}`}
          </Button>
          <p className="text-center text-xs text-muted-foreground">
            Sem confirmação local até o retorno do PayPal.
          </p>
        </section>
      </div>
    </div>
  );
}
