import { useNavigate } from 'react-router-dom';
import { Crosshair, User, ShoppingBag, Shield } from 'lucide-react';
import { motion } from 'framer-motion';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import type { UserRole } from '@/services/mock-data';

const roles: { role: UserRole; label: string; desc: string; icon: React.ElementType; redirect: string }[] = [
  { role: 'customer', label: 'Comprador', desc: 'Explore e compre skins', icon: User, redirect: '/products' },
  { role: 'seller', label: 'Vendedor', desc: 'Gerencie sua loja', icon: ShoppingBag, redirect: '/seller' },
  { role: 'admin', label: 'Administrador', desc: 'Painel administrativo', icon: Shield, redirect: '/admin' },
];

export default function Login() {
  const { login } = useAuth();
  const navigate = useNavigate();

  const handleLogin = (role: UserRole, redirect: string) => {
    login(role);
    navigate(redirect);
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
          <p className="text-muted-foreground text-sm mt-2">Selecione seu perfil para entrar</p>
        </div>

        <div className="space-y-4">
          {roles.map((r, i) => (
            <motion.div
              key={r.role}
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: i * 0.1 }}
            >
              <Button
                variant="outline"
                className="w-full h-auto py-4 px-6 justify-start gap-4"
                onClick={() => handleLogin(r.role, r.redirect)}
              >
                <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
                  <r.icon className="h-5 w-5 text-primary" />
                </div>
                <div className="text-left">
                  <div className="font-heading text-foreground">{r.label}</div>
                  <div className="text-xs text-muted-foreground font-normal normal-case">{r.desc}</div>
                </div>
              </Button>
            </motion.div>
          ))}
        </div>

        <p className="text-center text-xs text-muted-foreground mt-8">
          Este é um ambiente de demonstração. Nenhuma autenticação real é necessária.
        </p>
      </motion.div>
    </div>
  );
}
