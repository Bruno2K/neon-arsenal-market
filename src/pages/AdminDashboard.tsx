// ─── Page: AdminDashboard ─────────────────────────────────────────────────────
// Replaces all mock-data with real API hooks:
//   - useAllSellers    → seller list + approve/reject
//   - useAllOrders     → all orders overview + recharts revenue chart

import {
  BarChart3,
  Users,
  ShoppingBag,
  DollarSign,
  CheckCircle,
  XCircle,
  Clock,
  Loader2,
} from 'lucide-react';
import { motion } from 'framer-motion';
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';
import { useAllSellers } from '@/application/hooks/sellers/useSeller';
import { useAllOrders } from '@/application/hooks/orders/useOrders';
import { useApproveSeller } from '@/application/hooks/sellers/useApproveSeller';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';

// ─── Status helpers ───────────────────────────────────────────────────────────

const orderStatusStyle: Record<string, string> = {
  PENDING:   'bg-muted text-muted-foreground',
  CONFIRMED: 'bg-secondary/10 text-secondary',
  SHIPPED:   'bg-primary/10 text-primary',
  DELIVERED: 'bg-green-500/10 text-green-400',
  CANCELLED: 'bg-destructive/10 text-destructive',
};

// ─── Page ────────────────────────────────────────────────────────────────────

export default function AdminDashboard() {
  const { data: sellers = [], isLoading: loadingSellers } = useAllSellers();
  const { data: orders  = [], isLoading: loadingOrders  } = useAllOrders();
  const approveSeller = useApproveSeller();

  const pendingSellers = sellers.filter(s => !s.isApproved);

  const totalRevenue = orders.reduce((sum, o) => sum + o.totalAmount, 0);

  // ── Revenue chart: aggregate orders by day (last 30 days) ────────────────
  const revenueChartData = (() => {
    const days = 30;
    const now = Date.now();
    const buckets: Record<string, number> = {};
    for (let i = days - 1; i >= 0; i--) {
      const d = new Date(now - i * 86400000);
      buckets[d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })] = 0;
    }
    const cutoff = now - days * 86400000;
    for (const o of orders) {
      const t = new Date(o.createdAt).getTime();
      if (t < cutoff) continue;
      const label = new Date(o.createdAt).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });
      if (label in buckets) buckets[label] += o.totalAmount;
    }
    return Object.entries(buckets).map(([date, revenue]) => ({ date, revenue: parseFloat(revenue.toFixed(2)) }));
  })();

  const globalStats = [
    { icon: DollarSign,  label: 'Receita Total', value: `$${totalRevenue.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`, color: 'text-primary'   },
    { icon: ShoppingBag, label: 'Pedidos',        value: orders.length.toString(),              color: 'text-secondary' },
    { icon: Users,       label: 'Vendedores',      value: sellers.length.toString(),             color: 'text-primary'   },
    { icon: BarChart3,   label: 'Pendentes',       value: pendingSellers.length.toString(),      color: 'text-secondary' },
  ];

  const handleApprove = (sellerId: string, isApproved: boolean) => {
    approveSeller.mutate(
      { sellerId, isApproved },
      {
        onSuccess: () =>
          toast.success(isApproved ? 'Vendedor aprovado!' : 'Vendedor rejeitado', {
            description: isApproved ? 'O vendedor foi notificado por e-mail.' : 'O vendedor foi notificado.',
          }),
        onError: (err) =>
          toast.error('Erro ao atualizar vendedor', {
            description: err instanceof Error ? err.message : 'Tente novamente.',
          }),
      },
    );
  };

  return (
    <div className="space-y-8">
      <h1 className="text-3xl font-heading text-foreground">Admin Panel</h1>

      {/* Global Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {globalStats.map((s, i) => (
          <motion.div
            key={s.label}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.05 }}
            className="p-4 rounded-lg border border-border bg-card"
          >
            <div className="flex items-center gap-2 mb-2">
              <s.icon className={`h-4 w-4 ${s.color}`} />
              <span className="text-xs text-muted-foreground font-heading">{s.label}</span>
            </div>
            <span className={`font-heading text-2xl ${s.color}`}>{s.value}</span>
          </motion.div>
        ))}
      </div>

      {/* Revenue Chart */}
      <div className="p-6 rounded-lg border border-border bg-card">
        <h2 className="text-base font-heading text-foreground mb-4 flex items-center gap-2">
          <BarChart3 className="h-4 w-4 text-primary" />
          Receita dos Últimos 30 Dias
        </h2>
        {loadingOrders ? (
          <div className="flex justify-center py-10">
            <Loader2 className="h-6 w-6 animate-spin text-primary" />
          </div>
        ) : (
          <ResponsiveContainer width="100%" height={220}>
            <AreaChart data={revenueChartData} margin={{ top: 4, right: 4, left: 0, bottom: 0 }}>
              <defs>
                <linearGradient id="revGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%"  stopColor="hsl(var(--primary))" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0}   />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
              <XAxis
                dataKey="date"
                tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }}
                tickLine={false}
                interval={4}
              />
              <YAxis
                tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }}
                tickLine={false}
                axisLine={false}
                tickFormatter={v => `$${v}`}
              />
              <Tooltip
                contentStyle={{
                  background: 'hsl(var(--card))',
                  border: '1px solid hsl(var(--border))',
                  borderRadius: '8px',
                  fontSize: '12px',
                  color: 'hsl(var(--foreground))',
                }}
                formatter={(v: number) => [`$${v.toFixed(2)}`, 'Receita']}
              />
              <Area
                type="monotone"
                dataKey="revenue"
                stroke="hsl(var(--primary))"
                strokeWidth={2}
                fill="url(#revGrad)"
              />
            </AreaChart>
          </ResponsiveContainer>
        )}
      </div>

      {/* Pending Sellers */}
      <div>
        <h2 className="text-xl font-heading text-foreground mb-4">
          Aprovação de Vendedores
          {pendingSellers.length > 0 && (
            <span className="ml-2 text-sm bg-secondary/10 text-secondary px-2 py-0.5 rounded">
              {pendingSellers.length} pendente{pendingSellers.length !== 1 ? 's' : ''}
            </span>
          )}
        </h2>

        {loadingSellers ? (
          <div className="flex justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin text-primary" />
          </div>
        ) : pendingSellers.length === 0 ? (
          <p className="text-muted-foreground text-sm p-4 rounded-lg border border-border bg-card">
            Nenhum vendedor pendente
          </p>
        ) : (
          <div className="space-y-3">
            {pendingSellers.map(s => (
              <div
                key={s.id}
                className="flex items-center justify-between p-4 rounded-lg border border-border bg-card"
              >
                <div className="flex items-center gap-3">
                  <div className="h-10 w-10 rounded-full bg-muted flex items-center justify-center flex-shrink-0">
                    <Users className="h-5 w-5 text-muted-foreground" />
                  </div>
                  <div>
                    <span className="text-sm font-medium text-foreground">
                      {s.storeName}
                    </span>
                    {s.user && (
                      <p className="text-xs text-muted-foreground">{s.user.email}</p>
                    )}
                    {s.rating > 0 && (
                      <p className="text-xs text-muted-foreground">★ {s.rating.toFixed(1)}</p>
                    )}
                  </div>
                </div>
                <div className="flex gap-2">
                  <Button
                    size="sm"
                    disabled={approveSeller.isPending}
                    onClick={() => handleApprove(s.id, true)}
                  >
                    {approveSeller.isPending ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <CheckCircle className="h-4 w-4 mr-1" />
                    )}
                    Aprovar
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={approveSeller.isPending}
                    onClick={() => handleApprove(s.id, false)}
                  >
                    <XCircle className="h-4 w-4 mr-1" /> Rejeitar
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* All Sellers */}
      <div>
        <h2 className="text-xl font-heading text-foreground mb-4">Todos os Vendedores</h2>
        {loadingSellers ? (
          <div className="flex justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin text-primary" />
          </div>
        ) : (
          <div className="rounded-lg border border-border overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-muted">
                <tr>
                  <th className="text-left p-3 font-heading text-muted-foreground text-xs">Loja</th>
                  <th className="text-left p-3 font-heading text-muted-foreground text-xs hidden sm:table-cell">E-mail</th>
                  <th className="text-left p-3 font-heading text-muted-foreground text-xs hidden md:table-cell">Rating</th>
                  <th className="text-left p-3 font-heading text-muted-foreground text-xs">Status</th>
                </tr>
              </thead>
              <tbody>
                {sellers.length === 0 && (
                  <tr>
                    <td colSpan={4} className="p-6 text-center text-muted-foreground text-sm">
                      Nenhum vendedor cadastrado.
                    </td>
                  </tr>
                )}
                {sellers.map(s => (
                  <tr key={s.id} className="border-t border-border hover:bg-muted/50 transition-colors">
                    <td className="p-3 text-foreground font-medium">{s.storeName}</td>
                    <td className="p-3 text-muted-foreground hidden sm:table-cell">
                      {s.user?.email ?? '—'}
                    </td>
                    <td className="p-3 text-muted-foreground hidden md:table-cell">
                      {s.rating > 0 ? `★ ${s.rating.toFixed(1)}` : '—'}
                    </td>
                    <td className="p-3">
                      <span
                        className={`text-xs font-heading px-2 py-1 rounded ${
                          s.isApproved
                            ? 'bg-primary/10 text-primary'
                            : 'bg-secondary/10 text-secondary'
                        }`}
                      >
                        {s.isApproved ? 'Aprovado' : 'Pendente'}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Recent Orders */}
      <div>
        <h2 className="text-xl font-heading text-foreground mb-4">Pedidos Recentes</h2>
        {loadingOrders ? (
          <div className="flex justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin text-primary" />
          </div>
        ) : (
          <div className="rounded-lg border border-border overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-muted">
                <tr>
                  <th className="text-left p-3 font-heading text-muted-foreground text-xs">ID</th>
                  <th className="text-left p-3 font-heading text-muted-foreground text-xs hidden sm:table-cell">Total</th>
                  <th className="text-left p-3 font-heading text-muted-foreground text-xs hidden md:table-cell">Cliente</th>
                  <th className="text-left p-3 font-heading text-muted-foreground text-xs hidden md:table-cell">Data</th>
                  <th className="text-left p-3 font-heading text-muted-foreground text-xs">Status</th>
                </tr>
              </thead>
              <tbody>
                {orders.length === 0 && (
                  <tr>
                    <td colSpan={5} className="p-6 text-center text-muted-foreground text-sm">
                      Nenhum pedido encontrado.
                    </td>
                  </tr>
                )}
                {orders.map(o => (
                  <tr key={o.id} className="border-t border-border hover:bg-muted/50 transition-colors">
                    <td className="p-3 text-muted-foreground font-mono text-xs">
                      #{o.id.slice(0, 8)}
                    </td>
                    <td className="p-3 text-primary font-heading hidden sm:table-cell">
                      ${o.totalAmount.toFixed(2)}
                    </td>
                    <td className="p-3 text-muted-foreground hidden md:table-cell">
                      {o.customer?.name ?? '—'}
                    </td>
                    <td className="p-3 text-muted-foreground hidden md:table-cell">
                      {new Date(o.createdAt).toLocaleDateString('pt-BR')}
                    </td>
                    <td className="p-3">
                      <span
                        className={`inline-flex items-center gap-1 text-xs font-heading px-2 py-1 rounded ${
                          orderStatusStyle[o.status] ?? 'bg-muted text-muted-foreground'
                        }`}
                      >
                        {o.status === 'PENDING'   && <Clock className="h-3 w-3" />}
                        {o.status === 'DELIVERED' && <CheckCircle className="h-3 w-3" />}
                        {o.status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
