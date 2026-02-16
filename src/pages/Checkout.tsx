import { useState } from 'react';
import { Link } from 'react-router-dom';
import { CreditCard, CheckCircle, ShieldCheck } from 'lucide-react';
import { motion } from 'framer-motion';
import { useCart } from '@/contexts/CartContext';
import { Button } from '@/components/ui/button';

export default function Checkout() {
  const { items, totalPrice, clearCart } = useCart();
  const [completed, setCompleted] = useState(false);
  const total = totalPrice * 1.05;

  if (completed) {
    return (
      <div className="container py-20 text-center">
        <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ type: 'spring' }}>
          <CheckCircle className="h-20 w-20 text-primary mx-auto mb-6" />
        </motion.div>
        <h1 className="text-3xl font-heading text-foreground mb-4">Pedido Confirmado!</h1>
        <p className="text-muted-foreground mb-8">Seu pagamento foi processado com sucesso. Você receberá os itens em breve.</p>
        <Button asChild><Link to="/products">Continuar Comprando</Link></Button>
      </div>
    );
  }

  if (items.length === 0) {
    return (
      <div className="container py-20 text-center">
        <p className="text-muted-foreground mb-4">Seu carrinho está vazio</p>
        <Button asChild><Link to="/products">Ir ao Market</Link></Button>
      </div>
    );
  }

  return (
    <div className="container py-8 max-w-2xl">
      <h1 className="text-3xl font-heading text-foreground mb-8">Checkout</h1>

      <div className="space-y-6">
        {/* Items summary */}
        <div className="p-4 rounded-lg border border-border bg-card space-y-3">
          <h2 className="font-heading text-sm text-muted-foreground">Itens ({items.length})</h2>
          {items.map(({ product, quantity }) => (
            <div key={product.id} className="flex justify-between text-sm">
              <span className="text-foreground">{product.name} × {quantity}</span>
              <span className="text-muted-foreground">${(product.price * quantity).toFixed(2)}</span>
            </div>
          ))}
          <div className="border-t border-border pt-3 flex justify-between font-heading text-lg">
            <span className="text-foreground">Total</span>
            <span className="text-primary">${total.toFixed(2)}</span>
          </div>
        </div>

        {/* Payment */}
        <div className="p-6 rounded-lg border border-border bg-card space-y-4">
          <h2 className="font-heading text-foreground flex items-center gap-2">
            <CreditCard className="h-5 w-5" /> Pagamento
          </h2>
          <p className="text-sm text-muted-foreground">Simulação de pagamento via PayPal</p>
          <Button
            className="w-full"
            size="lg"
            onClick={() => { setCompleted(true); clearCart(); }}
          >
            Pagar com PayPal — ${total.toFixed(2)}
          </Button>
          <div className="flex items-center justify-center gap-2 text-xs text-muted-foreground">
            <ShieldCheck className="h-3 w-3" />
            <span>Transação segura e protegida</span>
          </div>
        </div>
      </div>
    </div>
  );
}
