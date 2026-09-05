import { useEffect, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Trash2 } from "lucide-react";
import { useCart } from "@/contexts/CartContext";
import { useAuth } from "@/contexts/AuthContext";
import { createOrder } from "@/api/orders";
import { createPaymentLink } from "@/api/payments";
import { CartListingAlerts } from "@/components/CartListingAlerts";
import { EmptyState } from "@/components/page-state";
import { ReservationHold } from "@/components/ReservationHold";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useCartListingsRevalidation } from "@/hooks/useCartListingsRevalidation";
import {
  resolveCheckoutIdempotencyKey,
  type CheckoutIdempotencyState,
} from "@/lib/checkoutIdempotency";
import {
  earliestReservationExpiresAt,
  isReservationExpired,
} from "@/lib/orderPaymentView";
import { paypalCheckoutUrls } from "@/lib/paypalCheckoutUrls";
import { redirectToExternal } from "@/lib/redirect";
import type { Order } from "@/types/api";

export default function Checkout() {
  const { items, totalPrice, removeItem, removeItems, updateListing } =
    useCart();
  const { lines, blockage, canCheckout } = useCartListingsRevalidation(
    items,
    updateListing,
  );
  const { isAuthenticated, user } = useAuth();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [createdOrder, setCreatedOrder] = useState<Order | null>(null);
  const [now, setNow] = useState(() => Date.now());
  const inFlightRef = useRef(false);
  const idempotencyRef = useRef<CheckoutIdempotencyState | null>(null);
  const serviceFee = totalPrice * 0.05;
  const total = totalPrice * 1.05;
  const expiresAt = createdOrder
    ? earliestReservationExpiresAt(createdOrder)
    : null;
  const reservationExpired = createdOrder
    ? isReservationExpired(createdOrder, now)
    : false;

  useEffect(() => {
    if (expiresAt == null) return;
    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, [expiresAt]);

  if (items.length === 0 && !loading && !createdOrder) {
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
    if (inFlightRef.current || !canCheckout) return;
    inFlightRef.current = true;
    setError(null);
    setLoading(true);
    let createdOrderId: string | null = null;
    let leftCheckout = false;
    try {
      const listingIds = items.map(({ listing }) => listing.id);
      idempotencyRef.current = resolveCheckoutIdempotencyKey(
        idempotencyRef.current,
        listingIds,
      );
      const order = await createOrder(
        { items: listingIds.map((listingId) => ({ listingId })) },
        { idempotencyKey: idempotencyRef.current.key },
      );
      createdOrderId = order.id;
      setCreatedOrder(order);
      removeItems(listingIds);
      const payment = await createPaymentLink({
        orderId: order.id,
        ...paypalCheckoutUrls(order.id),
      });
      if (payment.approvalUrl) {
        leftCheckout = true;
        redirectToExternal(payment.approvalUrl);
        return;
      }
      leftCheckout = true;
      navigate(`/orders/${order.id}`);
    } catch (e) {
      if (createdOrderId) {
        leftCheckout = true;
        navigate(`/orders/${createdOrderId}`);
        return;
      }
      setError(e instanceof Error ? e.message : "Falha ao criar pedido");
    } finally {
      inFlightRef.current = false;
      if (!leftCheckout) setLoading(false);
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

      <div className="mb-6">
        <ReservationHold
          phase={createdOrder ? "order" : "pre-order"}
          expiresAt={expiresAt}
          now={now}
        />
      </div>

      <div className="space-y-6">
        <section className="space-y-3 rounded-md border border-border bg-card p-4">
          <h2 className="text-sm font-medium text-muted-foreground">
            Itens ({items.length})
          </h2>
          <ul className="space-y-2">
            {lines.map((line) => {
              if (line.kind === "loading") {
                return (
                  <li key={line.listingId}>
                    <Skeleton
                      className="h-10 w-full"
                      role="status"
                      aria-label="Carregando"
                    />
                  </li>
                );
              }

              const listing = line.display;
              const name = `${listing.product.weapon} | ${listing.product.skinName} (${listing.product.exterior})`;
              return (
                <li key={listing.id} className="space-y-1 text-sm">
                  <div className="flex items-start justify-between gap-4">
                    <span className="min-w-0 truncate text-foreground">
                      {name}
                    </span>
                    <span className="flex shrink-0 items-center gap-2">
                      <span className="tabular-price text-muted-foreground">
                        ${Number(listing.price).toFixed(2)}
                      </span>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 min-h-8 min-w-8 text-muted-foreground hover:text-destructive"
                        onClick={() => removeItem(listing.id)}
                        aria-label={`Remover ${name}`}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </span>
                  </div>
                  <CartListingAlerts line={line} />
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
            disabled={loading || reservationExpired || !canCheckout}
            title={
              reservationExpired
                ? "A reserva expirou. O item pode ter voltado ao Market."
                : blockage && !canCheckout
                  ? blockage
                  : undefined
            }
          >
            {loading
              ? "Abrindo o PayPal..."
              : error
                ? "Tentar novamente"
                : `Pagar com PayPal — $${total.toFixed(2)}`}
          </Button>
          {!canCheckout && blockage ? (
            <p className="text-sm text-destructive" role="status">
              {blockage}
            </p>
          ) : null}
          <p className="text-center text-xs text-muted-foreground">
            Sem confirmação local até o retorno do PayPal.
          </p>
        </section>
      </div>
    </div>
  );
}
