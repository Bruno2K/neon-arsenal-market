// ─── Page: PaymentSuccess ─────────────────────────────────────────────────────
// PayPal redirects the buyer back to this page after a successful payment.
// URL example: /payment/success?token=PAYPAL_ORDER_ID&orderId=OUR_ORDER_ID
// The page shows a confirmation and links to the order detail.

import { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { CheckCircle, Loader2, Package, ArrowRight } from 'lucide-react';
import { motion } from 'framer-motion';
import { Button } from '@/components/ui/button';

export default function PaymentSuccess() {
  const [searchParams] = useSearchParams();
  const orderId = searchParams.get('orderId');
  const token = searchParams.get('token'); // PayPal order token

  // Brief "processing" UX before showing the confirmation card
  const [ready, setReady] = useState(false);
  useEffect(() => {
    const t = setTimeout(() => setReady(true), 1200);
    return () => clearTimeout(t);
  }, []);

  if (!ready) {
    return (
      <div className="container py-40 flex flex-col items-center gap-4">
        <Loader2 className="h-10 w-10 animate-spin text-primary" />
        <p className="text-muted-foreground font-heading text-sm">
          Processando pagamento…
        </p>
      </div>
    );
  }

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
          <div className="h-20 w-20 rounded-full bg-green-500/10 border border-green-500/20 flex items-center justify-center">
            <CheckCircle className="h-10 w-10 text-green-400" />
          </div>
        </div>

        {/* Heading */}
        <div className="space-y-2">
          <h1 className="text-3xl font-heading text-foreground">
            Pagamento Confirmado!
          </h1>
          <p className="text-muted-foreground">
            Seu pagamento foi processado com sucesso. O vendedor será notificado e
            seu pedido será preparado em breve.
          </p>
        </div>

        {/* Order reference */}
        {(orderId ?? token) && (
          <div className="p-4 rounded-lg border border-border bg-card text-left space-y-1">
            {orderId && (
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Pedido</span>
                <span className="font-mono text-foreground text-xs">
                  #{orderId.slice(0, 12)}…
                </span>
              </div>
            )}
            {token && (
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">PayPal ref.</span>
                <span className="font-mono text-foreground text-xs truncate max-w-[160px]">
                  {token}
                </span>
              </div>
            )}
          </div>
        )}

        {/* CTAs */}
        <div className="flex flex-col gap-3">
          {orderId ? (
            <Button asChild size="lg" className="w-full">
              <Link to={`/orders/${orderId}`}>
                <Package className="h-4 w-4 mr-2" />
                Ver Meu Pedido
                <ArrowRight className="h-4 w-4 ml-2" />
              </Link>
            </Button>
          ) : (
            <Button asChild size="lg" className="w-full">
              <Link to="/orders">
                <Package className="h-4 w-4 mr-2" />
                Meus Pedidos
              </Link>
            </Button>
          )}
          <Button asChild variant="outline" className="w-full">
            <Link to="/products">Continuar Comprando</Link>
          </Button>
        </div>
      </motion.div>
    </div>
  );
}
