// ─── Page: Checkout ───────────────────────────────────────────────────────────
// Creates a real order via useCreateOrder, then redirects to PayPal via
// useCreatePaymentLink. The PayPal redirect is handled inside the hook itself.

import { useState } from 'react';
import { Link } from 'react-router-dom';
import { CreditCard, ShieldCheck, Loader2, AlertCircle } from 'lucide-react';
import { motion } from 'framer-motion';
import { useCart } from '@/contexts/CartContext';
import { useCreateOrder } from '@/application/hooks/orders/useCreateOrder';
import { useCreatePaymentLink } from '@/application/hooks/payments/useCreatePaymentLink';
import { Button } from '@/components/ui/button';

// 5% service fee
const FEE_RATE = 1.05;

export default function Checkout() {
  const { items, totalPrice, clearCart } = useCart();
  const createOrder = useCreateOrder();
  const createPaymentLink = useCreatePaymentLink();

  const [error, setError] = useState<string | null>(null);

  const total = totalPrice * FEE_RATE;

  if (items.length === 0) {
    return (
      <div className="container py-20 text-center">
        <p className="text-muted-foreground mb-4">Seu carrinho está vazio</p>
        <Button asChild>
          <Link to="/products">Ir ao Market</Link>
        </Button>
      </div>
    );
  }

  const handlePayWithPayPal = async () => {
    setError(null);
    try {
      // 1. Create order in the backend
      const order = await createOrder.mutateAsync({
        items: items.map(({ product, quantity }) => ({
          productId: product.id,
          quantity,
        })),
      });

      // 2. Generate PayPal approval link → hook redirects window.location.href
      await createPaymentLink.mutateAsync(order.id);

      // clearCart() is called after PayPal returns and confirms payment
      clearCart();
    } catch (err: unknown) {
      setError(
        err instanceof Error
          ? err.message
          : 'Erro ao processar pagamento. Tente novamente.',
      );
    }
  };

  const isLoading = createOrder.isPending || createPaymentLink.isPending;

  return (
    <div className="container py-8 max-w-2xl">
      <h1 className="text-3xl font-heading text-foreground mb-8">Checkout</h1>

      <div className="space-y-6">
        {/* Items summary */}
        <div className="p-4 rounded-lg border border-border bg-card space-y-3">
          <h2 className="font-heading text-sm text-muted-foreground">
            Itens ({items.length})
          </h2>
          {items.map(({ product, quantity }) => (
            <div key={product.id} className="flex justify-between text-sm">
              <span className="text-foreground">
                {product.name} × {quantity}
              </span>
              <span className="text-muted-foreground">
                ${(product.price * quantity).toFixed(2)}
              </span>
            </div>
          ))}
          <div className="border-t border-border pt-3 space-y-1">
            <div className="flex justify-between text-sm text-muted-foreground">
              <span>Subtotal</span>
              <span>${totalPrice.toFixed(2)}</span>
            </div>
            <div className="flex justify-between text-sm text-muted-foreground">
              <span>Taxa de serviço (5%)</span>
              <span>${(totalPrice * 0.05).toFixed(2)}</span>
            </div>
            <div className="flex justify-between font-heading text-lg pt-1">
              <span className="text-foreground">Total</span>
              <span className="text-primary">${total.toFixed(2)}</span>
            </div>
          </div>
        </div>

        {/* Error */}
        {error && (
          <div className="flex items-center gap-2 text-sm text-destructive bg-destructive/10 border border-destructive/20 rounded-lg px-3 py-2.5">
            <AlertCircle className="h-4 w-4 flex-shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {/* Payment */}
        <div className="p-6 rounded-lg border border-border bg-card space-y-4">
          <h2 className="font-heading text-foreground flex items-center gap-2">
            <CreditCard className="h-5 w-5" /> Pagamento
          </h2>
          <p className="text-sm text-muted-foreground">
            Você será redirecionado ao PayPal para concluir o pagamento com
            segurança.
          </p>

          <motion.div whileTap={{ scale: 0.98 }}>
            <Button
              className="w-full"
              size="lg"
              onClick={handlePayWithPayPal}
              disabled={isLoading}
            >
              {isLoading ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : null}
              {createOrder.isPending
                ? 'Criando pedido...'
                : createPaymentLink.isPending
                  ? 'Redirecionando ao PayPal...'
                  : `Pagar com PayPal — $${total.toFixed(2)}`}
            </Button>
          </motion.div>

          <div className="flex items-center justify-center gap-2 text-xs text-muted-foreground">
            <ShieldCheck className="h-3 w-3" />
            <span>Transação segura e protegida via PayPal</span>
          </div>
        </div>
      </div>
    </div>
  );
}
