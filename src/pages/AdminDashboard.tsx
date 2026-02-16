import { BarChart3, Users, ShoppingBag, DollarSign, CheckCircle, XCircle, Clock } from 'lucide-react';
import { motion } from 'framer-motion';
import { sellers, orders, products } from '@/services/mock-data';
import { RankBadge } from '@/components/RankBadge';
import { Button } from '@/components/ui/button';

const totalRevenue = orders.reduce((s, o) => s + o.total, 0);
const globalStats = [
  { icon: DollarSign, label: 'Receita Total', value: `$${totalRevenue.toLocaleString()}`, color: 'text-primary' },
  { icon: ShoppingBag, label: 'Produtos', value: products.length.toString(), color: 'text-secondary' },
  { icon: Users, label: 'Vendedores', value: sellers.length.toString(), color: 'text-primary' },
  { icon: BarChart3, label: 'Pedidos', value: orders.length.toString(), color: 'text-secondary' },
];

export default function AdminDashboard() {
  const pendingSellers = sellers.filter(s => !s.approved);

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

      {/* Pending Sellers */}
      <div>
        <h2 className="text-xl font-heading text-foreground mb-4">
          Aprovação de Vendedores
          {pendingSellers.length > 0 && (
            <span className="ml-2 text-sm bg-secondary/10 text-secondary px-2 py-0.5 rounded">{pendingSellers.length} pendente(s)</span>
          )}
        </h2>
        {pendingSellers.length === 0 ? (
          <p className="text-muted-foreground text-sm p-4 rounded-lg border border-border bg-card">Nenhum vendedor pendente</p>
        ) : (
          <div className="space-y-3">
            {pendingSellers.map(s => (
              <div key={s.id} className="flex items-center justify-between p-4 rounded-lg border border-border bg-card">
                <div className="flex items-center gap-3">
                  <div className="h-10 w-10 rounded-full bg-muted flex items-center justify-center">
                    <Users className="h-5 w-5 text-muted-foreground" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium text-foreground">{s.name}</span>
                      <RankBadge rank={s.rank} />
                    </div>
                    <span className="text-xs text-muted-foreground">{s.totalSales} vendas · Rating: {s.rating}</span>
                  </div>
                </div>
                <div className="flex gap-2">
                  <Button size="sm"><CheckCircle className="h-4 w-4 mr-1" /> Aprovar</Button>
                  <Button variant="outline" size="sm"><XCircle className="h-4 w-4 mr-1" /> Rejeitar</Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* All Sellers */}
      <div>
        <h2 className="text-xl font-heading text-foreground mb-4">Todos os Vendedores</h2>
        <div className="rounded-lg border border-border overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-muted">
              <tr>
                <th className="text-left p-3 font-heading text-muted-foreground text-xs">Vendedor</th>
                <th className="text-left p-3 font-heading text-muted-foreground text-xs hidden sm:table-cell">Rank</th>
                <th className="text-left p-3 font-heading text-muted-foreground text-xs hidden md:table-cell">Vendas</th>
                <th className="text-left p-3 font-heading text-muted-foreground text-xs hidden md:table-cell">Rating</th>
                <th className="text-left p-3 font-heading text-muted-foreground text-xs">Status</th>
              </tr>
            </thead>
            <tbody>
              {sellers.map(s => (
                <tr key={s.id} className="border-t border-border hover:bg-muted/50 transition-colors">
                  <td className="p-3 text-foreground font-medium">{s.name}</td>
                  <td className="p-3 hidden sm:table-cell"><RankBadge rank={s.rank} /></td>
                  <td className="p-3 text-muted-foreground hidden md:table-cell">{s.totalSales.toLocaleString()}</td>
                  <td className="p-3 text-muted-foreground hidden md:table-cell">★ {s.rating}</td>
                  <td className="p-3">
                    <span className={`text-xs font-heading px-2 py-1 rounded ${s.approved ? 'bg-primary/10 text-primary' : 'bg-secondary/10 text-secondary'}`}>
                      {s.approved ? 'Aprovado' : 'Pendente'}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Recent Orders */}
      <div>
        <h2 className="text-xl font-heading text-foreground mb-4">Pedidos Recentes</h2>
        <div className="rounded-lg border border-border overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-muted">
              <tr>
                <th className="text-left p-3 font-heading text-muted-foreground text-xs">ID</th>
                <th className="text-left p-3 font-heading text-muted-foreground text-xs">Item</th>
                <th className="text-left p-3 font-heading text-muted-foreground text-xs hidden sm:table-cell">Total</th>
                <th className="text-left p-3 font-heading text-muted-foreground text-xs hidden md:table-cell">Data</th>
                <th className="text-left p-3 font-heading text-muted-foreground text-xs">Status</th>
              </tr>
            </thead>
            <tbody>
              {orders.map(o => (
                <tr key={o.id} className="border-t border-border hover:bg-muted/50 transition-colors">
                  <td className="p-3 text-muted-foreground font-mono text-xs">#{o.id}</td>
                  <td className="p-3 text-foreground">{o.items[0]?.name}</td>
                  <td className="p-3 text-primary font-heading hidden sm:table-cell">${o.total.toFixed(2)}</td>
                  <td className="p-3 text-muted-foreground hidden md:table-cell">{o.createdAt}</td>
                  <td className="p-3">
                    <span className={`inline-flex items-center gap-1 text-xs font-heading px-2 py-1 rounded ${
                      o.status === 'completed' ? 'bg-primary/10 text-primary' :
                      o.status === 'processing' ? 'bg-secondary/10 text-secondary' :
                      o.status === 'pending' ? 'bg-muted text-muted-foreground' :
                      'bg-destructive/10 text-destructive'
                    }`}>
                      {o.status === 'pending' && <Clock className="h-3 w-3" />}
                      {o.status === 'completed' && <CheckCircle className="h-3 w-3" />}
                      {o.status}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
