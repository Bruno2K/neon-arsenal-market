// ─── Page: PaymentCancel ──────────────────────────────────────────────────────
// PayPal redirects the buyer here when they cancel the payment flow.
// URL example: /payment/cancel?orderId=OUR_ORDER_ID

import { useSearchParams, Link } from 'react-router-dom';
import { XCircle, ArrowLeft, ShoppingCart } from 'lucide-react';
import { motion } from 'framer-motion';
import { Button } from '@/components/ui/button';

export default function PaymentCancel() {
  const [searchParams] = useSearchParams();
  const orderId = searchParams.get('orderId');

  return (
    <div className="container py-20 flex justify-center">
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.35 }}
        className="w-full max-w-md text-center space-y-6"
      >
        {/* Icon */}
        <div className="flex justify-center">
          <div className="h-20 w-20 rounded-full bg-destructive/10 border border-destructive/20 flex items-center justify-center">
            <XCircle className="h-10 w-10 text-destructive" />
          </div>
        </div>

        {/* Heading */}
        <div className="space-y-2">
          <h1 className="text-3xl font-heading text-foreground">
            Pagamento Cancelado
          </h1>
          <p className="text-muted-foreground">
            Você cancelou o pagamento. Seu pedido ainda está pendente e pode ser
            pago a qualquer momento.
          </p>
        </div>

        {/* Info card */}
        <div className="p-4 rounded-lg border border-border bg-card text-left space-y-2 text-sm">
          <p className="text-muted-foreground">
            Nenhum valor foi cobrado. O estoque reservado será liberado
            automaticamente caso o pedido não seja pago.
          </p>
          {orderId && (
            <div className="flex justify-between pt-2 border-t border-border">
              <span className="text-muted-foreground">Pedido</span>
              <span className="font-mono text-xs text-foreground">
                #{orderId.slice(0, 12)}…
              </span>
            </div>
          )}
        </div>

        {/* CTAs */}
        <div className="flex flex-col gap-3">
          {orderId && (
            <Button asChild size="lg" className="w-full">
              <Link to={`/orders/${orderId}`}>
                Tentar Pagar Novamente
              </Link>
            </Button>
          )}
          <Button asChild variant="outline" className="w-full">
            <Link to="/cart">
              <ShoppingCart className="h-4 w-4 mr-2" />
              Voltar ao Carrinho
            </Link>
          </Button>
          <Button asChild variant="ghost" size="sm" className="w-full">
            <Link to="/products">
              <ArrowLeft className="h-4 w-4 mr-1" />
              Continuar Comprando
            </Link>
          </Button>
        </div>
      </motion.div>
    </div>
  );
}
