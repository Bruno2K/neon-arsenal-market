import { BarChart3, Package, DollarSign, TrendingUp, Star, Eye } from 'lucide-react';
import { motion } from 'framer-motion';
import { sellers, getProductsBySeller, getOrdersBySeller } from '@/services/mock-data';
import { RankBadge } from '@/components/RankBadge';
import { Button } from '@/components/ui/button';

const seller = sellers[0]; // Mock: NeonTrader
const sellerProducts = getProductsBySeller(seller.id);
const sellerOrders = getOrdersBySeller(seller.id);

const stats = [
  { icon: DollarSign, label: 'Total Vendido', value: `$${seller.totalSales.toLocaleString()}`, color: 'text-primary' },
  { icon: Package, label: 'Produtos Ativos', value: seller.activeProducts.toString(), color: 'text-secondary' },
  { icon: TrendingUp, label: 'Saldo Disponível', value: `$${seller.balance.toFixed(2)}`, color: 'text-primary' },
  { icon: Star, label: 'Avaliação', value: seller.rating.toString(), color: 'text-secondary' },
];

export default function SellerDashboard() {
  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-heading text-foreground">Dashboard</h1>
          <div className="flex items-center gap-3 mt-2">
            <span className="text-muted-foreground">Olá, {seller.name}</span>
            <RankBadge rank={seller.rank} size="md" />
          </div>
        </div>
        <Button><Package className="h-4 w-4 mr-2" /> Novo Produto</Button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {stats.map((s, i) => (
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

      {/* Products */}
      <div>
        <h2 className="text-xl font-heading text-foreground mb-4">Meus Produtos</h2>
        <div className="rounded-lg border border-border overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-muted">
              <tr>
                <th className="text-left p-3 font-heading text-muted-foreground text-xs">Produto</th>
                <th className="text-left p-3 font-heading text-muted-foreground text-xs hidden sm:table-cell">Preço</th>
                <th className="text-left p-3 font-heading text-muted-foreground text-xs hidden md:table-cell">Estoque</th>
                <th className="text-left p-3 font-heading text-muted-foreground text-xs hidden md:table-cell">Rating</th>
                <th className="text-right p-3 font-heading text-muted-foreground text-xs">Ações</th>
              </tr>
            </thead>
            <tbody>
              {sellerProducts.map(p => (
                <tr key={p.id} className="border-t border-border hover:bg-muted/50 transition-colors">
                  <td className="p-3 text-foreground">{p.name}</td>
                  <td className="p-3 text-primary font-heading hidden sm:table-cell">${p.price.toFixed(2)}</td>
                  <td className="p-3 text-muted-foreground hidden md:table-cell">{p.stock}</td>
                  <td className="p-3 hidden md:table-cell"><span className="flex items-center gap-1"><Star className="h-3 w-3 fill-secondary text-secondary" />{p.rating}</span></td>
                  <td className="p-3 text-right">
                    <Button variant="ghost" size="sm"><Eye className="h-4 w-4" /></Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Orders */}
      <div>
        <h2 className="text-xl font-heading text-foreground mb-4">Pedidos Recebidos</h2>
        <div className="rounded-lg border border-border overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-muted">
              <tr>
                <th className="text-left p-3 font-heading text-muted-foreground text-xs">Pedido</th>
                <th className="text-left p-3 font-heading text-muted-foreground text-xs">Item</th>
                <th className="text-left p-3 font-heading text-muted-foreground text-xs hidden sm:table-cell">Total</th>
                <th className="text-left p-3 font-heading text-muted-foreground text-xs">Status</th>
              </tr>
            </thead>
            <tbody>
              {sellerOrders.map(o => (
                <tr key={o.id} className="border-t border-border hover:bg-muted/50 transition-colors">
                  <td className="p-3 text-muted-foreground font-mono text-xs">#{o.id}</td>
                  <td className="p-3 text-foreground">{o.items[0]?.name}</td>
                  <td className="p-3 text-primary font-heading hidden sm:table-cell">${o.total.toFixed(2)}</td>
                  <td className="p-3">
                    <span className={`text-xs font-heading px-2 py-1 rounded ${
                      o.status === 'completed' ? 'bg-primary/10 text-primary' :
                      o.status === 'processing' ? 'bg-secondary/10 text-secondary' :
                      o.status === 'pending' ? 'bg-muted text-muted-foreground' :
                      'bg-destructive/10 text-destructive'
                    }`}>
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
