// ─── Page: OrderDetail (/orders/:id) ─────────────────────────────────────────
// Shows full order info with a visual status timeline and items breakdown.

import { Link, useParams } from 'react-router-dom';
import {
  ArrowLeft,
  Clock,
  CheckCircle,
  Truck,
  XCircle,
  Package,
  Loader2,
  AlertCircle,
  CreditCard,
} from 'lucide-react';
import { motion } from 'framer-motion';
import { useOrder } from '@/application/hooks/orders/useOrder';
import type { OrderStatus } from '@/domain/orders/entities/Order';
import { Button } from '@/components/ui/button';

// ─── Timeline steps ───────────────────────────────────────────────────────────

const TIMELINE: { status: OrderStatus; label: string; icon: React.ElementType }[] = [
  { status: 'PENDING',   label: 'Aguardando',  icon: Clock       },
  { status: 'CONFIRMED', label: 'Confirmado',  icon: CheckCircle },
  { status: 'SHIPPED',   label: 'Enviado',     icon: Truck       },
  { status: 'DELIVERED', label: 'Entregue',    icon: CheckCircle },
];

const STATUS_ORDER: Record<OrderStatus, number> = {
  PENDING:   0,
  CONFIRMED: 1,
  SHIPPED:   2,
  DELIVERED: 3,
  CANCELLED: -1,
};

// ─── Payment badge ────────────────────────────────────────────────────────────

const paymentStyle: Record<string, string> = {
  PENDING:  'bg-muted text-muted-foreground',
  PAID:     'bg-primary/10 text-primary',
  REFUNDED: 'bg-secondary/10 text-secondary',
};

// ─── Page ────────────────────────────────────────────────────────────────────

export default function OrderDetail() {
  const { id } = useParams<{ id: string }>();
  const { data: order, isLoading, isError } = useOrder(id ?? '');

  if (isLoading) {
    return (
      <div className="container py-20 flex justify-center">
        <Loader2 className="h-10 w-10 animate-spin text-primary" />
      </div>
    );
  }

  if (isError || !order) {
    return (
      <div className="container py-20 text-center">
        <AlertCircle className="h-12 w-12 text-destructive mx-auto mb-4" />
        <p className="text-muted-foreground font-heading text-xl mb-4">
          Pedido não encontrado
        </p>
        <Button asChild variant="outline">
          <Link to="/orders">Meus Pedidos</Link>
        </Button>
      </div>
    );
  }

  const currentStep = STATUS_ORDER[order.status] ?? -1;
  const isCancelled = order.status === 'CANCELLED';

  return (
    <div className="container py-8 max-w-2xl">
      {/* Back */}
      <Button variant="ghost" size="sm" asChild className="mb-6">
        <Link to="/orders">
          <ArrowLeft className="h-4 w-4 mr-1" /> Meus Pedidos
        </Link>
      </Button>

      <div className="flex items-start justify-between mb-8 gap-4">
        <div>
          <h1 className="text-2xl font-heading text-foreground">
            Pedido #{order.id.slice(0, 8)}…
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            {new Date(order.createdAt).toLocaleDateString('pt-BR', {
              day: '2-digit',
              month: 'long',
              year: 'numeric',
              hour: '2-digit',
              minute: '2-digit',
            })}
          </p>
        </div>
        <span
          className={`text-xs font-heading px-2 py-1 rounded flex items-center gap-1 flex-shrink-0 ${paymentStyle[order.paymentStatus] ?? paymentStyle.PENDING}`}
        >
          <CreditCard className="h-3 w-3" />
          {order.paymentStatus}
        </span>
      </div>

      {/* ── Status Timeline ──────────────────────────────────────────────── */}
      {isCancelled ? (
        <div className="flex items-center gap-3 p-4 rounded-lg bg-destructive/10 border border-destructive/20 mb-8">
          <XCircle className="h-5 w-5 text-destructive flex-shrink-0" />
          <div>
            <p className="text-sm font-medium text-destructive">Pedido Cancelado</p>
            <p className="text-xs text-muted-foreground">
              Este pedido foi cancelado e não será processado.
            </p>
          </div>
        </div>
      ) : (
        <div className="mb-8">
          <h2 className="text-sm font-heading text-muted-foreground mb-5">
            Status do Pedido
          </h2>
          <div className="relative">
            {/* Connector line */}
            <div className="absolute top-5 left-5 right-5 h-0.5 bg-border" />
            <div
              className="absolute top-5 left-5 h-0.5 bg-primary transition-all duration-700"
              style={{
                width:
                  currentStep <= 0
                    ? '0%'
                    : `${(currentStep / (TIMELINE.length - 1)) * 100}%`,
              }}
            />
            <div className="relative flex justify-between">
              {TIMELINE.map((step, idx) => {
                const done = idx <= currentStep;
                const active = idx === currentStep;
                const Icon = step.icon;

                return (
                  <motion.div
                    key={step.status}
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: idx * 0.08 }}
                    className="flex flex-col items-center gap-2"
                  >
                    <div
                      className={`h-10 w-10 rounded-full flex items-center justify-center border-2 transition-all z-10 ${
                        done
                          ? 'bg-primary border-primary text-primary-foreground'
                          : 'bg-card border-border text-muted-foreground'
                      } ${active ? 'ring-2 ring-primary/30 ring-offset-2 ring-offset-background' : ''}`}
                    >
                      <Icon className="h-4 w-4" />
                    </div>
                    <span
                      className={`text-[11px] font-heading text-center ${
                        done ? 'text-primary' : 'text-muted-foreground'
                      }`}
                    >
                      {step.label}
                    </span>
                  </motion.div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* ── Items ────────────────────────────────────────────────────────── */}
      <div className="rounded-lg border border-border bg-card overflow-hidden mb-6">
        <div className="p-4 border-b border-border bg-muted">
          <h2 className="font-heading text-sm text-muted-foreground">
            Itens do Pedido ({order.items.length})
          </h2>
        </div>
        <div className="divide-y divide-border">
          {order.items.map(item => (
            <div key={item.id} className="p-4 flex items-center justify-between">
              <div className="flex items-center gap-3 min-w-0">
                <div className="h-9 w-9 rounded bg-primary/10 flex items-center justify-center flex-shrink-0">
                  <Package className="h-4 w-4 text-primary" />
                </div>
                <div className="min-w-0">
                  <p className="text-sm text-foreground truncate">
                    {item.product?.name ?? `Produto #${item.productId.slice(0, 8)}`}
                  </p>
                  {item.seller && (
                    <p className="text-xs text-muted-foreground">
                      {item.seller.storeName}
                    </p>
                  )}
                </div>
              </div>
              <div className="flex items-center gap-4 flex-shrink-0 ml-4 text-right">
                <span className="text-xs text-muted-foreground">
                  ×{item.quantity}
                </span>
                <span className="font-heading text-primary text-sm">
                  ${(item.priceSnapshot * item.quantity).toFixed(2)}
                </span>
              </div>
            </div>
          ))}
        </div>
        <div className="p-4 border-t border-border flex justify-between items-center">
          <span className="font-heading text-foreground">Total</span>
          <span className="font-heading text-xl text-primary">
            ${order.totalAmount.toFixed(2)}
          </span>
        </div>
      </div>

      {/* PayPal ID */}
      {order.paypalOrderId && (
        <p className="text-xs text-muted-foreground">
          PayPal ID:{' '}
          <span className="font-mono">{order.paypalOrderId}</span>
        </p>
      )}
    </div>
  );
}
