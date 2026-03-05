// ─── Page: Profile (/profile) ─────────────────────────────────────────────────
// Allows the logged-in user to update their name, email and password.
// PATCH /users/me accepts any subset of { name, email, password }.

import { useState, type FormEvent } from 'react';
import { User, Lock, Mail, Loader2, CheckCircle, AlertCircle } from 'lucide-react';
import { motion } from 'framer-motion';
import { toast } from 'sonner';
import { useAuth } from '@/contexts/AuthContext';
import { useUpdateMe } from '@/application/hooks/users/useUpdateMe';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

// ─── Section wrapper ──────────────────────────────────────────────────────────

function Section({
  title,
  icon: Icon,
  children,
}: {
  title: string;
  icon: React.ElementType;
  children: React.ReactNode;
}) {
  return (
    <div className="p-6 rounded-lg border border-border bg-card space-y-4">
      <h2 className="font-heading text-foreground flex items-center gap-2 text-base">
        <Icon className="h-5 w-5 text-primary" />
        {title}
      </h2>
      {children}
    </div>
  );
}

// ─── Page ────────────────────────────────────────────────────────────────────

export default function Profile() {
  const { user } = useAuth();
  const updateMe = useUpdateMe();

  // Profile fields
  const [name, setName] = useState(user?.name ?? '');
  const [email, setEmail] = useState(user?.email ?? '');
  const [profileMsg, setProfileMsg] = useState<{ type: 'ok' | 'err'; text: string } | null>(null);

  // Password fields
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [passMsg, setPassMsg] = useState<{ type: 'ok' | 'err'; text: string } | null>(null);

  const handleProfileSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setProfileMsg(null);
    try {
      await updateMe.mutateAsync({ name, email });
      setProfileMsg({ type: 'ok', text: 'Perfil atualizado com sucesso!' });
      toast.success('Perfil atualizado!');
    } catch (err: unknown) {
      const text = err instanceof Error ? err.message : 'Erro ao atualizar perfil.';
      setProfileMsg({ type: 'err', text });
      toast.error('Erro ao atualizar perfil', { description: text });
    }
  };

  const handlePasswordSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setPassMsg(null);
    if (password.length < 6) {
      setPassMsg({ type: 'err', text: 'A senha deve ter no mínimo 6 caracteres.' });
      return;
    }
    if (password !== confirm) {
      setPassMsg({ type: 'err', text: 'As senhas não coincidem.' });
      return;
    }
    try {
      await updateMe.mutateAsync({ password });
      setPassword('');
      setConfirm('');
      setPassMsg({ type: 'ok', text: 'Senha alterada com sucesso!' });
      toast.success('Senha alterada com sucesso!');
    } catch (err: unknown) {
      const text = err instanceof Error ? err.message : 'Erro ao alterar senha.';
      setPassMsg({ type: 'err', text });
      toast.error('Erro ao alterar senha', { description: text });
    }
  };

  return (
    <div className="container py-8 max-w-xl">
      <div className="flex items-center gap-3 mb-8">
        <div className="h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center">
          <User className="h-6 w-6 text-primary" />
        </div>
        <div>
          <h1 className="text-2xl font-heading text-foreground">{user?.name}</h1>
          <p className="text-sm text-muted-foreground">{user?.email}</p>
        </div>
      </div>

      <div className="space-y-6">
        {/* Profile info */}
        <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }}>
          <Section title="Dados do Perfil" icon={Mail}>
            <form onSubmit={handleProfileSubmit} className="space-y-4">
              <div className="space-y-1.5">
                <Label htmlFor="name">Nome</Label>
                <Input
                  id="name"
                  value={name}
                  onChange={e => setName(e.target.value)}
                  required
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="email">E-mail</Label>
                <Input
                  id="email"
                  type="email"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  required
                />
              </div>

              {profileMsg && (
                <div
                  className={`flex items-center gap-2 text-sm rounded-lg px-3 py-2.5 ${
                    profileMsg.type === 'ok'
                      ? 'bg-primary/10 text-primary border border-primary/20'
                      : 'bg-destructive/10 text-destructive border border-destructive/20'
                  }`}
                >
                  {profileMsg.type === 'ok' ? (
                    <CheckCircle className="h-4 w-4 flex-shrink-0" />
                  ) : (
                    <AlertCircle className="h-4 w-4 flex-shrink-0" />
                  )}
                  {profileMsg.text}
                </div>
              )}

              <Button type="submit" disabled={updateMe.isPending}>
                {updateMe.isPending && (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                )}
                Salvar Alterações
              </Button>
            </form>
          </Section>
        </motion.div>

        {/* Password */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.08 }}
        >
          <Section title="Alterar Senha" icon={Lock}>
            <form onSubmit={handlePasswordSubmit} className="space-y-4">
              <div className="space-y-1.5">
                <Label htmlFor="new-password">Nova Senha</Label>
                <Input
                  id="new-password"
                  type="password"
                  placeholder="••••••••"
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  minLength={6}
                  required
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="confirm-password">Confirmar Nova Senha</Label>
                <Input
                  id="confirm-password"
                  type="password"
                  placeholder="••••••••"
                  value={confirm}
                  onChange={e => setConfirm(e.target.value)}
                  minLength={6}
                  required
                />
              </div>

              {passMsg && (
                <div
                  className={`flex items-center gap-2 text-sm rounded-lg px-3 py-2.5 ${
                    passMsg.type === 'ok'
                      ? 'bg-primary/10 text-primary border border-primary/20'
                      : 'bg-destructive/10 text-destructive border border-destructive/20'
                  }`}
                >
                  {passMsg.type === 'ok' ? (
                    <CheckCircle className="h-4 w-4 flex-shrink-0" />
                  ) : (
                    <AlertCircle className="h-4 w-4 flex-shrink-0" />
                  )}
                  {passMsg.text}
                </div>
              )}

              <Button type="submit" variant="outline" disabled={updateMe.isPending}>
                {updateMe.isPending && (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                )}
                Alterar Senha
              </Button>
            </form>
          </Section>
        </motion.div>
      </div>
    </div>
  );
}
