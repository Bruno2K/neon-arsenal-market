import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Crosshair, Target, Package, Shield, User, Zap, TrendingUp, Users, ShoppingBag } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ProductCard } from '@/components/ProductCard';
import { products, categories } from '@/services/mock-data';

const categoryIcons: Record<string, React.ElementType> = {
  rifles: Crosshair, pistols: Target, knives: Package, gloves: Shield, accounts: User, services: Zap,
};

const stats = [
  { icon: ShoppingBag, label: 'Itens Listados', value: '12.4K' },
  { icon: Users, label: 'Vendedores Ativos', value: '2.3K' },
  { icon: TrendingUp, label: 'Transações', value: '89K+' },
];

export default function Index() {
  const featured = products.filter(p => p.rarity === 'legendary' || p.rarity === 'epic').slice(0, 4);

  return (
    <div>
      {/* Hero */}
      <section className="relative overflow-hidden border-b border-border">
        <div className="absolute inset-0 grid-pattern" />
        <div className="absolute inset-0 bg-gradient-to-b from-primary/5 via-transparent to-background" />
        <div className="scan-lines absolute inset-0" />

        <div className="container relative py-24 md:py-36">
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
            className="max-w-3xl"
          >
            <h1 className="text-5xl md:text-7xl font-heading leading-tight">
              <span className="text-primary neon-text">Trade.</span>{' '}
              <span className="text-secondary orange-text">Compete.</span>{' '}
              <span className="text-foreground">Dominate.</span>
            </h1>
            <p className="mt-6 text-lg text-muted-foreground max-w-xl">
              O marketplace definitivo para skins, contas e serviços de CS. Compre e venda com segurança em um ambiente confiável.
            </p>
            <div className="mt-8 flex flex-wrap gap-4">
              <Button asChild size="lg">
                <Link to="/products">Explorar Market</Link>
              </Button>
              <Button asChild variant="outline" size="lg">
                <Link to="/login">Começar a Vender</Link>
              </Button>
            </div>
          </motion.div>

          {/* Stats */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3, duration: 0.5 }}
            className="mt-16 grid grid-cols-3 gap-6 max-w-lg"
          >
            {stats.map(s => (
              <div key={s.label} className="text-center">
                <s.icon className="h-5 w-5 text-primary mx-auto mb-2" />
                <div className="font-heading text-2xl text-foreground">{s.value}</div>
                <div className="text-[11px] text-muted-foreground mt-1">{s.label}</div>
              </div>
            ))}
          </motion.div>
        </div>
      </section>

      {/* Categories */}
      <section className="container py-16">
        <h2 className="text-2xl font-heading text-foreground mb-8">Categorias</h2>
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-4">
          {categories.map((cat, i) => {
            const Icon = categoryIcons[cat.id] || Package;
            return (
              <motion.div
                key={cat.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.05 }}
              >
                <Link
                  to={`/products?category=${cat.id}`}
                  className="flex flex-col items-center gap-3 p-6 rounded-lg border border-border bg-card hover:border-primary/50 hover:bg-primary/5 transition-all group"
                >
                  <Icon className="h-6 w-6 text-muted-foreground group-hover:text-primary transition-colors" />
                  <span className="font-heading text-sm text-foreground">{cat.name}</span>
                  <span className="text-[11px] text-muted-foreground">{cat.count} itens</span>
                </Link>
              </motion.div>
            );
          })}
        </div>
      </section>

      {/* Featured */}
      <section className="container py-16 border-t border-border">
        <div className="flex items-center justify-between mb-8">
          <h2 className="text-2xl font-heading text-foreground">Destaques</h2>
          <Button asChild variant="ghost" size="sm">
            <Link to="/products">Ver Todos →</Link>
          </Button>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
          {featured.map(p => (
            <ProductCard key={p.id} product={p} />
          ))}
        </div>
      </section>

      {/* CTA */}
      <section className="border-t border-border">
        <div className="container py-20 text-center">
          <h2 className="text-3xl font-heading text-foreground mb-4">Pronto para entrar no jogo?</h2>
          <p className="text-muted-foreground mb-8 max-w-md mx-auto">
            Crie sua conta e comece a negociar agora. Milhares de itens disponíveis.
          </p>
          <Button asChild size="lg">
            <Link to="/login">Criar Conta</Link>
          </Button>
        </div>
      </section>
    </div>
  );
}
