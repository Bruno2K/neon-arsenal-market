// ─── Page: CustomerOrders (/orders) ──────────────────────────────────────────
// Lists all orders for the logged-in customer with status badges and totals.

import { Link } from 'react-router-dom';
import {
  ShoppingBag,
  ChevronRight,
  Loader2,
  AlertCircle,
  Clock,
  CheckCircle,
  Truck,
  XCircle,
  Package,
} from 'lucide-react';
import { motion } from 'framer-motion';
import { useCustomerOrders } from '@/application/hooks/orders/useOrders';
import type { OrderStatus } from '@/domain/orders/entities/Order';
import { Button } from '@/components/ui/button';

// ─── Status config ────────────────────────────────────────────────────────────

const statusConfig: Record<
  OrderStatus,
  { label: string; className: string; icon: React.ElementType }
> = {
  PENDING:   { label: 'Aguardando',  className: 'bg-muted text-muted-foreground',       icon: Clock       },
  CONFIRMED: { label: 'Confirmado',  className: 'bg-secondary/10 text-secondary',        icon: CheckCircle },
  SHIPPED:   { label: 'Enviado',     className: 'bg-primary/10 text-primary',            icon: Truck       },
  DELIVERED: { label: 'Entregue',    className: 'bg-green-500/10 text-green-400',        icon: CheckCircle },
  CANCELLED: { label: 'Cancelado',   className: 'bg-destructive/10 text-destructive',    icon: XCircle     },
};

// ─── Page ────────────────────────────────────────────────────────────────────

export default function CustomerOrders() {
  const { data: orders = [], isLoading, isError } = useCustomerOrders();

  return (
    <div className="container py-8 max-w-3xl">
      <div className="flex items-center gap-3 mb-8">
        <ShoppingBag className="h-6 w-6 text-primary" />
        <h1 className="text-3xl font-heading text-foreground">Meus Pedidos</h1>
      </div>

      {/* Loading */}
      {isLoading && (
        <div className="flex justify-center py-20">
          <Loader2 className="h-10 w-10 animate-spin text-primary" />
        </div>
      )}

      {/* Error */}
      {isError && (
        <div className="flex items-center gap-2 text-destructive bg-destructive/10 border border-destructive/20 rounded-lg px-4 py-3">
          <AlertCircle className="h-5 w-5 flex-shrink-0" />
          <span className="text-sm">Não foi possível carregar seus pedidos.</span>
        </div>
      )}

      {/* Empty state */}
      {!isLoading && !isError && orders.length === 0 && (
        <div className="text-center py-20">
          <Package className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
          <p className="font-heading text-lg text-foreground mb-2">
            Nenhum pedido ainda
          </p>
          <p className="text-sm text-muted-foreground mb-6">
            Explore o market e encontre o item perfeito.
          </p>
          <Button asChild>
            <Link to="/products">Explorar Market</Link>
          </Button>
        </div>
      )}

      {/* Order list */}
      {!isLoading && !isError && orders.length > 0 && (
        <div className="space-y-4">
          {orders.map((order, i) => {
            const cfg = statusConfig[order.status] ?? statusConfig.PENDING;
            const Icon = cfg.icon;

            return (
              <motion.div
                key={order.id}
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.04 }}
              >
                <Link to={`/orders/${order.id}`}>
                  <div className="p-4 rounded-lg border border-border bg-card hover:border-primary/40 transition-colors group">
                    <div className="flex items-center justify-between">
                      {/* Left: ID + date + items */}
                      <div className="space-y-1 min-w-0">
                        <p className="text-xs text-muted-foreground font-mono">
                          #{order.id.slice(0, 12)}…
                        </p>
                        <p className="text-sm text-foreground font-medium">
                          {order.items.length} item{order.items.length !== 1 ? 's' : ''}
                          {order.items[0]?.product?.name
                            ? ` — ${order.items[0].product.name}${order.items.length > 1 ? ` +${order.items.length - 1}` : ''}`
                            : ''}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {new Date(order.createdAt).toLocaleDateString('pt-BR', {
                            day: '2-digit',
                            month: 'short',
                            year: 'numeric',
                          })}
                        </p>
                      </div>

                      {/* Right: total + status + arrow */}
                      <div className="flex items-center gap-4 flex-shrink-0 ml-4">
                        <span className="font-heading text-primary text-lg hidden sm:block">
                          ${order.totalAmount.toFixed(2)}
                        </span>
                        <span
                          className={`inline-flex items-center gap-1 text-xs font-heading px-2 py-1 rounded ${cfg.className}`}
                        >
                          <Icon className="h-3 w-3" />
                          {cfg.label}
                        </span>
                        <ChevronRight className="h-4 w-4 text-muted-foreground group-hover:text-primary transition-colors" />
                      </div>
                    </div>
                  </div>
                </Link>
              </motion.div>
            );
          })}
        </div>
      )}
    </div>
  );
}
