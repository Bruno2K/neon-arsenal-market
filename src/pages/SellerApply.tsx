// ─── Page: SellerApply (/seller/apply) ───────────────────────────────────────
// Lets an authenticated CUSTOMER apply to become a SELLER.
// POST /sellers/apply → { storeName }

import { useState, type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Store, Loader2, CheckCircle, AlertCircle } from 'lucide-react';
import { motion } from 'framer-motion';
import { useAuth } from '@/contexts/AuthContext';
import { sellerRepository } from '@/infrastructure/repositories/SellerRepository';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

export default function SellerApply() {
  const { user } = useAuth();
  const navigate = useNavigate();

  const [storeName, setStoreName] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Already a seller
  if (user?.role === 'SELLER') {
    return (
      <div className="container py-20 text-center">
        <CheckCircle className="h-12 w-12 text-primary mx-auto mb-4" />
        <h2 className="text-xl font-heading text-foreground mb-2">
          Você já é vendedor!
        </h2>
        <Button asChild className="mt-4">
          <Link to="/seller">Ir ao Dashboard</Link>
        </Button>
      </div>
    );
  }

  // Success state
  if (done) {
    return (
      <div className="container py-20 max-w-md text-center">
        <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ type: 'spring' }}>
          <CheckCircle className="h-16 w-16 text-primary mx-auto mb-6" />
        </motion.div>
        <h2 className="text-2xl font-heading text-foreground mb-3">
          Solicitação Enviada!
        </h2>
        <p className="text-muted-foreground mb-8">
          Sua solicitação para se tornar vendedor foi recebida. Você será
          notificado assim que um administrador aprovar sua conta.
        </p>
        <Button asChild variant="outline">
          <Link to="/products">Voltar ao Market</Link>
        </Button>
      </div>
    );
  }

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    setIsLoading(true);
    try {
      await sellerRepository.apply({ storeName });
      setDone(true);
    } catch (err: unknown) {
      const msg =
        err instanceof Error ? err.message : 'Erro ao enviar solicitação.';
      // If already applied (409 Conflict) treat as success
      if (msg.toLowerCase().includes('already') || msg.includes('409')) {
        setDone(true);
      } else {
        setError(msg);
      }
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="container py-12 max-w-md">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="space-y-8"
      >
        {/* Header */}
        <div className="text-center">
          <div className="h-14 w-14 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-4">
            <Store className="h-7 w-7 text-primary" />
          </div>
          <h1 className="text-2xl font-heading text-foreground">
            Tornar-se Vendedor
          </h1>
          <p className="text-muted-foreground text-sm mt-2 max-w-xs mx-auto">
            Crie sua loja e comece a vender skins, contas e serviços para
            milhares de jogadores.
          </p>
        </div>

        {/* Benefits */}
        <div className="p-4 rounded-lg border border-border bg-card space-y-2">
          {[
            'Liste produtos e gerencie seu estoque',
            'Receba pagamentos via PayPal de forma segura',
            'Acompanhe seus pedidos em tempo real',
            'Construa reputação com avaliações dos compradores',
          ].map(b => (
            <div key={b} className="flex items-center gap-2 text-sm text-muted-foreground">
              <CheckCircle className="h-4 w-4 text-primary flex-shrink-0" />
              {b}
            </div>
          ))}
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="store-name">Nome da Loja</Label>
            <Input
              id="store-name"
              placeholder="Ex: NeonTrader, PixelArms..."
              value={storeName}
              onChange={e => setStoreName(e.target.value)}
              required
              minLength={3}
              maxLength={50}
            />
            <p className="text-xs text-muted-foreground">
              Esse nome será exibido publicamente em seus produtos.
            </p>
          </div>

          {error && (
            <div className="flex items-center gap-2 text-sm text-destructive bg-destructive/10 border border-destructive/20 rounded-lg px-3 py-2.5">
              <AlertCircle className="h-4 w-4 flex-shrink-0" />
              {error}
            </div>
          )}

          <Button type="submit" className="w-full" size="lg" disabled={isLoading}>
            {isLoading && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            Enviar Solicitação
          </Button>
        </form>

        <p className="text-center text-xs text-muted-foreground">
          Sua loja ficará disponível após aprovação de um administrador.
        </p>
      </motion.div>
    </div>
  );
}
