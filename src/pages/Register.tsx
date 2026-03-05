import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Crosshair } from 'lucide-react';
import { motion } from 'framer-motion';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

type Role = 'CUSTOMER' | 'SELLER';

export default function Register() {
  const { startRegistration, confirmRegistration, error, clearError } = useAuth();
  const navigate = useNavigate();
  const [step, setStep] = useState<1 | 2>(1);
  const [loading, setLoading] = useState(false);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState<Role>('CUSTOMER');
  const [storeName, setStoreName] = useState('');
  const [code, setCode] = useState('');
  const [devCode, setDevCode] = useState<string | null>(null);

  const handleStep1 = async (e: React.FormEvent) => {
    e.preventDefault();
    clearError();
    setLoading(true);
    try {
      const result = await startRegistration({
        name,
        email,
        password,
        role,
        ...(role === 'SELLER' ? { storeName: storeName || undefined } : {}),
      });
      setDevCode(result.code ?? null);
      setStep(2);
    } finally {
      setLoading(false);
    }
  };

  const handleStep2 = async (e: React.FormEvent) => {
    e.preventDefault();
    clearError();
    setLoading(true);
    try {
      await confirmRegistration(email, code);
      navigate('/', { replace: true });
    } finally {
      setLoading(false);
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
        <div className="text-center mb-10">
          <Crosshair className="h-10 w-10 text-primary mx-auto mb-4" />
          <h1 className="text-3xl font-heading text-primary neon-text">SKINMARKET</h1>
          <p className="text-muted-foreground text-sm mt-2">
            {step === 1 ? 'Criar conta' : 'Confirmar e-mail'}
          </p>
        </div>

        {step === 1 ? (
          <form onSubmit={handleStep1} className="space-y-4">
            <div>
              <Label htmlFor="name">Nome</Label>
              <Input
                id="name"
                type="text"
                placeholder="Seu nome"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="mt-1"
                required
                autoComplete="name"
              />
            </div>
            <div>
              <Label htmlFor="email">E-mail</Label>
              <Input
                id="email"
                type="email"
                placeholder="seu@email.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="mt-1"
                required
                autoComplete="email"
              />
            </div>
            <div>
              <Label htmlFor="password">Senha</Label>
              <Input
                id="password"
                type="password"
                placeholder="Mín. 6 caracteres"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="mt-1"
                required
                minLength={6}
                autoComplete="new-password"
              />
            </div>
            <div>
              <Label>Tipo de conta</Label>
              <div className="flex gap-4 mt-2">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="radio"
                    name="role"
                    checked={role === 'CUSTOMER'}
                    onChange={() => setRole('CUSTOMER')}
                    className="rounded-full"
                  />
                  <span className="text-sm">Comprador</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="radio"
                    name="role"
                    checked={role === 'SELLER'}
                    onChange={() => setRole('SELLER')}
                    className="rounded-full"
                  />
                  <span className="text-sm">Vendedor</span>
                </label>
              </div>
            </div>
            {role === 'SELLER' && (
              <div>
                <Label htmlFor="storeName">Nome da loja</Label>
                <Input
                  id="storeName"
                  type="text"
                  placeholder="Minha Loja"
                  value={storeName}
                  onChange={(e) => setStoreName(e.target.value)}
                  className="mt-1"
                  required={role === 'SELLER'}
                />
                <p className="text-xs text-muted-foreground mt-1">
                  Sua conta ficará pendente até aprovação do administrador.
                </p>
              </div>
            )}
            {error && <p className="text-sm text-destructive">{error}</p>}
            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? 'Enviando...' : 'Enviar código por e-mail'}
            </Button>
          </form>
        ) : (
          <form onSubmit={handleStep2} className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Digite o código de 6 dígitos enviado para <strong>{email}</strong>
            </p>
            {devCode && (
              <p className="text-xs text-muted-foreground bg-muted p-2 rounded">
                Dev: código = <strong>{devCode}</strong>
              </p>
            )}
            <div>
              <Label htmlFor="code">Código</Label>
              <Input
                id="code"
                type="text"
                placeholder="000000"
                value={code}
                onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                className="mt-1 font-mono text-lg tracking-widest"
                maxLength={6}
                required
                autoComplete="one-time-code"
              />
            </div>
            {error && <p className="text-sm text-destructive">{error}</p>}
            <div className="flex gap-2">
              <Button
                type="button"
                variant="outline"
                className="flex-1"
                onClick={() => { setStep(1); setCode(''); clearError(); }}
                disabled={loading}
              >
                Voltar
              </Button>
              <Button type="submit" className="flex-1" disabled={loading || code.length !== 6}>
                {loading ? 'Confirmando...' : 'Confirmar'}
              </Button>
            </div>
          </form>
        )}

        <p className="text-center text-xs text-muted-foreground mt-8">
          Já tem conta? <Link to="/login" className="text-primary hover:underline">Entrar</Link>
        </p>
      </motion.div>
    </div>
  );
}
