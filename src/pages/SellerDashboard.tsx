// ─── Page: SellerDashboard ────────────────────────────────────────────────────
// Replaces all mock-data with real API hooks:
//   - useSellerMe         → seller profile
//   - useSellerProducts   → product list
//   - useSellerOrders     → received orders
//   - useSellerBalance    → balance & transactions

import { useState } from 'react';
import { toast } from 'sonner';
import {
  Package,
  DollarSign,
  TrendingUp,
  Star,
  Eye,
  Loader2,
  AlertCircle,
  Plus,
  X,
} from 'lucide-react';
import { motion } from 'framer-motion';
import { Link } from 'react-router-dom';
import { useSellerMe } from '@/application/hooks/sellers/useSeller';
import { useSellerProducts } from '@/application/hooks/products/useSellerProducts';
import { useSellerOrders } from '@/application/hooks/orders/useOrders';
import { useSellerBalance, useSellerTransactions } from '@/application/hooks/sellers/useSellerFinancials';
import { useCreateProduct } from '@/application/hooks/products/useCreateProduct';
import { useUpdateOrderStatus } from '@/application/hooks/orders/useUpdateOrderStatus';
import type { ProductCategory } from '@/domain/products/entities/Product';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';

// ─── Status badge ─────────────────────────────────────────────────────────────

const statusColors: Record<string, string> = {
  PENDING:   'bg-muted text-muted-foreground',
  CONFIRMED: 'bg-secondary/10 text-secondary',
  SHIPPED:   'bg-primary/10 text-primary',
  DELIVERED: 'bg-green-500/10 text-green-400',
  CANCELLED: 'bg-destructive/10 text-destructive',
};

// ─── New Product modal (inline for simplicity) ───────────────────────────────

const CATEGORIES: { value: ProductCategory; label: string }[] = [
  { value: 'rifles',   label: 'Rifles'    },
  { value: 'pistols',  label: 'Pistolas'  },
  { value: 'knives',   label: 'Facas'     },
  { value: 'gloves',   label: 'Luvas'     },
  { value: 'accounts', label: 'Contas'    },
  { value: 'services', label: 'Serviços'  },
  { value: 'other',    label: 'Outros'    },
];

function NewProductForm({ onClose }: { onClose: () => void }) {
  const createProduct = useCreateProduct();

  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [price, setPrice] = useState('');
  const [stock, setStock] = useState('1');
  const [imageUrl, setImageUrl] = useState('');
  const [category, setCategory] = useState<ProductCategory | ''>('');
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    try {
      await createProduct.mutateAsync({
        name,
        description,
        price: parseFloat(price),
        stock: parseInt(stock, 10),
        ...(imageUrl.trim() && { imageUrl: imageUrl.trim() }),
        ...(category && { category }),
      });
      toast.success('Produto criado com sucesso!', {
        description: name,
      });
      onClose();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Erro ao criar produto.');
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm p-4">
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="bg-card border border-border rounded-xl p-6 w-full max-w-md space-y-4 max-h-[90vh] overflow-y-auto"
      >
        <div className="flex items-center justify-between">
          <h2 className="font-heading text-foreground">Novo Produto</h2>
          <Button variant="ghost" size="icon" onClick={onClose}>
            <X className="h-4 w-4" />
          </Button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-3">
          <div className="space-y-1.5">
            <Label htmlFor="p-name">Nome</Label>
            <Input id="p-name" value={name} onChange={e => setName(e.target.value)} required />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="p-desc">Descrição</Label>
            <Textarea id="p-desc" value={description} onChange={e => setDescription(e.target.value)} rows={3} required />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="p-price">Preço (USD)</Label>
              <Input id="p-price" type="number" min="0.01" step="0.01" value={price} onChange={e => setPrice(e.target.value)} required />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="p-stock">Estoque</Label>
              <Input id="p-stock" type="number" min="0" value={stock} onChange={e => setStock(e.target.value)} required />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="p-image">URL da Imagem <span className="text-muted-foreground">(opcional)</span></Label>
            <Input
              id="p-image"
              type="url"
              placeholder="https://..."
              value={imageUrl}
              onChange={e => setImageUrl(e.target.value)}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="p-category">Categoria <span className="text-muted-foreground">(opcional)</span></Label>
            <select
              id="p-category"
              value={category}
              onChange={e => setCategory(e.target.value as ProductCategory | '')}
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
            >
              <option value="">Selecionar categoria...</option>
              {CATEGORIES.map(c => (
                <option key={c.value} value={c.value}>{c.label}</option>
              ))}
            </select>
          </div>

          {error && (
            <div className="flex items-center gap-2 text-sm text-destructive">
              <AlertCircle className="h-4 w-4" />
              {error}
            </div>
          )}

          <Button type="submit" className="w-full" disabled={createProduct.isPending}>
            {createProduct.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            Criar Produto
          </Button>
        </form>
      </motion.div>
    </div>
  );
}

// ─── Page ────────────────────────────────────────────────────────────────────

type Tab = 'overview' | 'products' | 'orders' | 'financeiro';

const TAB_LABELS: Record<Tab, string> = {
  overview:   'Visão Geral',
  products:   'Produtos',
  orders:     'Pedidos',
  financeiro: 'Financeiro',
};

export default function SellerDashboard() {
  const [showNewProduct, setShowNewProduct] = useState(false);
  const [activeTab, setActiveTab] = useState<Tab>('overview');

  const { data: seller, isLoading: loadingSeller, isError: errorSeller } = useSellerMe();
  const { data: products = [], isLoading: loadingProducts } = useSellerProducts();
  const { data: orders = [], isLoading: loadingOrders } = useSellerOrders();
  const { data: balance } = useSellerBalance();
  const { data: transactions = [], isLoading: loadingTx } = useSellerTransactions();
  const updateOrderStatus = useUpdateOrderStatus();

  if (loadingSeller) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-10 w-10 animate-spin text-primary" />
      </div>
    );
  }

  // Seller not yet registered → show apply prompt
  if (errorSeller || !seller) {
    return (
      <div className="flex flex-col items-center justify-center py-20 gap-4 text-center">
        <Package className="h-12 w-12 text-muted-foreground" />
        <h2 className="text-xl font-heading text-foreground">Você ainda não é vendedor</h2>
        <p className="text-muted-foreground text-sm max-w-xs">
          Solicite acesso de vendedor para começar a listar seus produtos na plataforma.
        </p>
        <Button asChild>
          <Link to="/seller/apply">Solicitar Acesso</Link>
        </Button>
      </div>
    );
  }

  const stats = [
    { icon: DollarSign, label: 'Saldo Disponível', value: `$${(balance?.balance ?? seller.balance).toFixed(2)}`, color: 'text-primary' },
    { icon: Package,    label: 'Produtos Ativos',  value: products.filter(p => p.isActive).length.toString(), color: 'text-secondary' },
    { icon: TrendingUp, label: 'Pedidos Recebidos', value: orders.length.toString(), color: 'text-primary' },
    { icon: Star,       label: 'Avaliação',         value: seller.rating > 0 ? seller.rating.toFixed(1) : '—', color: 'text-secondary' },
  ];

  return (
    <>
      {showNewProduct && <NewProductForm onClose={() => setShowNewProduct(false)} />}

      <div className="space-y-8">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-heading text-foreground">Dashboard</h1>
            <p className="text-muted-foreground mt-1">
              Olá,{' '}
              <span className="text-foreground font-medium">{seller.storeName}</span>
              {!seller.isApproved && (
                <span className="ml-2 text-xs bg-secondary/10 text-secondary px-2 py-0.5 rounded">
                  Aprovação pendente
                </span>
              )}
            </p>
          </div>
          <Button onClick={() => setShowNewProduct(true)} disabled={!seller.isApproved}>
            <Plus className="h-4 w-4 mr-2" /> Novo Produto
          </Button>
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

        {/* Tab navigation */}
        <div className="flex gap-1 p-1 bg-muted rounded-lg w-fit">
          {(Object.keys(TAB_LABELS) as Tab[]).map(tab => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`px-4 py-1.5 text-sm font-heading rounded-md transition-colors ${
                activeTab === tab
                  ? 'bg-background text-foreground shadow-sm'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              {TAB_LABELS[tab]}
            </button>
          ))}
        </div>

        {/* ── Tab: Visão Geral ─────────────────────────────────────────────────── */}
        {activeTab === 'overview' && (
          <div className="space-y-6">
            <div className="grid sm:grid-cols-2 gap-4">
              <div className="p-4 rounded-lg border border-border bg-card space-y-1">
                <span className="text-xs text-muted-foreground font-heading">Receita Bruta (todos os pedidos)</span>
                <div className="font-heading text-2xl text-primary">
                  ${transactions.reduce((sum, t) => sum + t.grossAmount, 0).toFixed(2)}
                </div>
              </div>
              <div className="p-4 rounded-lg border border-border bg-card space-y-1">
                <span className="text-xs text-muted-foreground font-heading">Receita Líquida (após comissão)</span>
                <div className="font-heading text-2xl text-secondary">
                  ${transactions.reduce((sum, t) => sum + t.netAmount, 0).toFixed(2)}
                </div>
              </div>
            </div>
            <div className="p-4 rounded-lg border border-border bg-card">
              <h3 className="text-sm font-heading text-muted-foreground mb-3">Últimas Transações</h3>
              {loadingTx ? (
                <div className="flex justify-center py-4"><Loader2 className="h-5 w-5 animate-spin text-primary" /></div>
              ) : transactions.length === 0 ? (
                <p className="text-sm text-muted-foreground">Nenhuma transação ainda.</p>
              ) : (
                <div className="space-y-2">
                  {transactions.slice(0, 5).map(t => (
                    <div key={t.id} className="flex items-center justify-between text-sm border-b border-border/50 pb-2 last:border-0 last:pb-0">
                      <div>
                        <span className="font-mono text-xs text-muted-foreground">#{t.orderId.slice(0, 8)}</span>
                        <span className="ml-2 text-xs text-muted-foreground">
                          {new Date(t.createdAt).toLocaleDateString('pt-BR')}
                        </span>
                      </div>
                      <div className="text-right">
                        <span className="text-primary font-heading">+${t.netAmount.toFixed(2)}</span>
                        <span className="ml-2 text-xs text-muted-foreground line-through">${t.grossAmount.toFixed(2)}</span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {/* ── Tab: Produtos ────────────────────────────────────────────────────── */}
        {activeTab === 'products' && (
        <div>
          <h2 className="text-xl font-heading text-foreground mb-4">Meus Produtos</h2>
          {loadingProducts ? (
            <div className="flex justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-primary" />
            </div>
          ) : (
            <div className="rounded-lg border border-border overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-muted">
                  <tr>
                    <th className="text-left p-3 font-heading text-muted-foreground text-xs">Produto</th>
                    <th className="text-left p-3 font-heading text-muted-foreground text-xs hidden sm:table-cell">Preço</th>
                    <th className="text-left p-3 font-heading text-muted-foreground text-xs hidden md:table-cell">Estoque</th>
                    <th className="text-left p-3 font-heading text-muted-foreground text-xs hidden md:table-cell">Status</th>
                    <th className="text-right p-3 font-heading text-muted-foreground text-xs">Ações</th>
                  </tr>
                </thead>
                <tbody>
                  {products.length === 0 && (
                    <tr>
                      <td colSpan={5} className="p-6 text-center text-muted-foreground text-sm">
                        Nenhum produto cadastrado ainda.
                      </td>
                    </tr>
                  )}
                  {products.map(p => (
                    <tr key={p.id} className="border-t border-border hover:bg-muted/50 transition-colors">
                      <td className="p-3 text-foreground">{p.name}</td>
                      <td className="p-3 text-primary font-heading hidden sm:table-cell">${p.price.toFixed(2)}</td>
                      <td className="p-3 text-muted-foreground hidden md:table-cell">{p.stock}</td>
                      <td className="p-3 hidden md:table-cell">
                        <span className={`text-xs font-heading px-2 py-1 rounded ${p.isActive ? 'bg-primary/10 text-primary' : 'bg-muted text-muted-foreground'}`}>
                          {p.isActive ? 'Ativo' : 'Inativo'}
                        </span>
                      </td>
                      <td className="p-3 text-right">
                        <Button variant="ghost" size="sm" asChild>
                          <Link to={`/product/${p.id}`}>
                            <Eye className="h-4 w-4" />
                          </Link>
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        )}

        {/* ── Tab: Pedidos ─────────────────────────────────────────────────────── */}
        {activeTab === 'orders' && (
        <div>
          <h2 className="text-xl font-heading text-foreground mb-4">Pedidos Recebidos</h2>
          {loadingOrders ? (
            <div className="flex justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-primary" />
            </div>
          ) : (
            <div className="rounded-lg border border-border overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-muted">
                  <tr>
                    <th className="text-left p-3 font-heading text-muted-foreground text-xs">Pedido</th>
                    <th className="text-left p-3 font-heading text-muted-foreground text-xs hidden sm:table-cell">Total</th>
                    <th className="text-left p-3 font-heading text-muted-foreground text-xs">Status</th>
                    <th className="text-right p-3 font-heading text-muted-foreground text-xs">Ação</th>
                  </tr>
                </thead>
                <tbody>
                  {orders.length === 0 && (
                    <tr>
                      <td colSpan={4} className="p-6 text-center text-muted-foreground text-sm">
                        Nenhum pedido recebido ainda.
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
                      <td className="p-3">
                        <span className={`text-xs font-heading px-2 py-1 rounded ${statusColors[o.status] ?? 'bg-muted text-muted-foreground'}`}>
                          {o.status}
                        </span>
                      </td>
                      <td className="p-3 text-right">
                        {o.status === 'CONFIRMED' && (
                          <Button
                            size="sm"
                            variant="outline"
                            disabled={updateOrderStatus.isPending}
                            onClick={() =>
                              updateOrderStatus.mutate(
                                { id: o.id, status: 'SHIPPED' },
                                {
                                  onSuccess: () => toast.success('Pedido marcado como enviado!', { description: `#${o.id.slice(0, 8)}` }),
                                  onError: (err) => toast.error('Erro ao atualizar pedido', { description: err instanceof Error ? err.message : 'Tente novamente.' }),
                                },
                              )
                            }
                          >
                            {updateOrderStatus.isPending
                              ? <Loader2 className="h-3 w-3 animate-spin" />
                              : 'Marcar Enviado'}
                          </Button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
        )}

        {/* ── Tab: Financeiro ──────────────────────────────────────────────────── */}
        {activeTab === 'financeiro' && (
          <div className="space-y-6">
            {/* Balance card */}
            <div className="grid sm:grid-cols-3 gap-4">
              <div className="p-4 rounded-lg border border-primary/30 bg-primary/5">
                <div className="text-xs font-heading text-muted-foreground mb-1">Saldo Disponível</div>
                <div className="font-heading text-3xl text-primary">
                  ${(balance?.balance ?? seller.balance).toFixed(2)}
                </div>
              </div>
              <div className="p-4 rounded-lg border border-border bg-card">
                <div className="text-xs font-heading text-muted-foreground mb-1">Receita Bruta Total</div>
                <div className="font-heading text-2xl text-foreground">
                  ${transactions.reduce((sum, t) => sum + t.grossAmount, 0).toFixed(2)}
                </div>
              </div>
              <div className="p-4 rounded-lg border border-border bg-card">
                <div className="text-xs font-heading text-muted-foreground mb-1">Comissão Paga à Plataforma</div>
                <div className="font-heading text-2xl text-secondary">
                  ${transactions.reduce((sum, t) => sum + t.commissionAmount, 0).toFixed(2)}
                </div>
              </div>
            </div>

            {/* Transaction history */}
            <div>
              <h3 className="text-lg font-heading text-foreground mb-4">Histórico de Transações</h3>
              {loadingTx ? (
                <div className="flex justify-center py-8">
                  <Loader2 className="h-6 w-6 animate-spin text-primary" />
                </div>
              ) : transactions.length === 0 ? (
                <div className="text-center py-12 text-muted-foreground">
                  <DollarSign className="h-8 w-8 mx-auto mb-2 opacity-30" />
                  <p className="text-sm">Nenhuma transação ainda.</p>
                  <p className="text-xs mt-1">As transações aparecem após pedidos pagos.</p>
                </div>
              ) : (
                <div className="rounded-lg border border-border overflow-hidden">
                  <table className="w-full text-sm">
                    <thead className="bg-muted">
                      <tr>
                        <th className="text-left p-3 font-heading text-muted-foreground text-xs">Pedido</th>
                        <th className="text-left p-3 font-heading text-muted-foreground text-xs hidden sm:table-cell">Data</th>
                        <th className="text-right p-3 font-heading text-muted-foreground text-xs hidden md:table-cell">Bruto</th>
                        <th className="text-right p-3 font-heading text-muted-foreground text-xs hidden md:table-cell">Comissão</th>
                        <th className="text-right p-3 font-heading text-muted-foreground text-xs">Líquido</th>
                      </tr>
                    </thead>
                    <tbody>
                      {transactions.map(t => (
                        <tr key={t.id} className="border-t border-border hover:bg-muted/50 transition-colors">
                          <td className="p-3 font-mono text-xs text-muted-foreground">
                            #{t.orderId.slice(0, 8)}
                          </td>
                          <td className="p-3 text-muted-foreground text-xs hidden sm:table-cell">
                            {new Date(t.createdAt).toLocaleDateString('pt-BR')}
                          </td>
                          <td className="p-3 text-right text-muted-foreground hidden md:table-cell">
                            ${t.grossAmount.toFixed(2)}
                          </td>
                          <td className="p-3 text-right text-destructive/70 text-xs hidden md:table-cell">
                            -${t.commissionAmount.toFixed(2)}
                          </td>
                          <td className="p-3 text-right text-primary font-heading">
                            +${t.netAmount.toFixed(2)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </>
  );
}
