// ─── Page: Login / Register ───────────────────────────────────────────────────
// Real JWT authentication replacing the mock role-picker.
// - Tab-based UI: "Entrar" / "Criar Conta"
// - On success, navigates to the page the user was trying to access (or /products)

import { useState, type FormEvent } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { Crosshair, Loader2, AlertCircle } from 'lucide-react';
import { motion } from 'framer-motion';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

type Tab = 'login' | 'register';

export default function Login() {
  const { login, register } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  // Where to send the user after logging in (PrivateRoute preserves this)
  const from = (location.state as { from?: Location })?.from?.pathname ?? '/products';

  const [tab, setTab] = useState<Tab>('login');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Form fields
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    setIsLoading(true);

    try {
      if (tab === 'login') {
        await login({ email, password });
      } else {
        if (!name.trim()) {
          setError('Por favor, insira seu nome.');
          return;
        }
        await register({ name, email, password });
      }
      navigate(from, { replace: true });
    } catch (err: unknown) {
      const msg =
        err instanceof Error
          ? err.message
          : 'Ocorreu um erro. Tente novamente.';
      setError(msg);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background flex items-center justify-center relative overflow-hidden">
      <div className="absolute inset-0 grid-pattern" />
      <div className="absolute inset-0 bg-gradient-to-b from-primary/5 via-transparent to-transparent" />

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="relative z-10 w-full max-w-md p-8"
      >
        {/* Brand */}
        <div className="text-center mb-10">
          <Crosshair className="h-10 w-10 text-primary mx-auto mb-4" />
          <h1 className="text-3xl font-heading text-primary neon-text">SKINMARKET</h1>
          <p className="text-muted-foreground text-sm mt-2">
            O marketplace definitivo para CS
          </p>
        </div>

        {/* Tabs */}
        <div className="flex rounded-lg border border-border bg-muted p-1 mb-6">
          {(['login', 'register'] as Tab[]).map(t => (
            <button
              key={t}
              type="button"
              onClick={() => { setTab(t); setError(null); }}
              className={`flex-1 py-2 text-sm font-heading rounded-md transition-all ${
                tab === t
                  ? 'bg-card text-foreground shadow-sm'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              {t === 'login' ? 'Entrar' : 'Criar Conta'}
            </button>
          ))}
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-4">
          {tab === 'register' && (
            <div className="space-y-1.5">
              <Label htmlFor="name">Nome</Label>
              <Input
                id="name"
                type="text"
                placeholder="Seu nome"
                value={name}
                onChange={e => setName(e.target.value)}
                autoComplete="name"
                required
              />
            </div>
          )}

          <div className="space-y-1.5">
            <Label htmlFor="email">E-mail</Label>
            <Input
              id="email"
              type="email"
              placeholder="seu@email.com"
              value={email}
              onChange={e => setEmail(e.target.value)}
              autoComplete="email"
              required
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="password">Senha</Label>
            <Input
              id="password"
              type="password"
              placeholder="••••••••"
              value={password}
              onChange={e => setPassword(e.target.value)}
              autoComplete={tab === 'login' ? 'current-password' : 'new-password'}
              required
              minLength={6}
            />
          </div>

          {/* Error */}
          {error && (
            <div className="flex items-center gap-2 text-sm text-destructive bg-destructive/10 border border-destructive/20 rounded-lg px-3 py-2.5">
              <AlertCircle className="h-4 w-4 flex-shrink-0" />
              <span>{error}</span>
            </div>
          )}

          <Button type="submit" className="w-full" size="lg" disabled={isLoading}>
            {isLoading ? (
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            ) : null}
            {tab === 'login' ? 'Entrar' : 'Criar Conta'}
          </Button>
        </form>

        <p className="text-center text-xs text-muted-foreground mt-8">
          {tab === 'login' ? (
            <>
              Ainda não tem conta?{' '}
              <button
                type="button"
                className="text-primary hover:underline"
                onClick={() => setTab('register')}
              >
                Criar agora
              </button>
            </>
          ) : (
            <>
              Já tem conta?{' '}
              <button
                type="button"
                className="text-primary hover:underline"
                onClick={() => setTab('login')}
              >
                Entrar
              </button>
            </>
          )}
        </p>
      </motion.div>
    </div>
  );
}
