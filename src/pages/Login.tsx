import { useState } from "react";
import { useNavigate, useLocation, Link } from "react-router-dom";
import { Eye, EyeOff } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export default function Login() {
  const { login, error, clearError } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const from =
    (location.state as { from?: { pathname: string } })?.from?.pathname ?? "/";

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    clearError();
    setLoading(true);
    try {
      await login(email, password);
      navigate(from, { replace: true });
    } catch {
      // error shown via context
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <div className="flex flex-1 items-center justify-center px-4 py-12">
        <div className="w-full max-w-sm">
          <Link to="/" className="mb-8 flex items-center gap-2.5">
            <span className="h-4 w-4 rounded-sm bg-primary" aria-hidden />
            <span className="text-[15px] font-semibold tracking-tight text-foreground">
              Neon Arsenal
            </span>
          </Link>

          <h1 className="text-2xl font-semibold tracking-tight">Entrar</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Acesse sua conta para continuar
          </p>

          <form onSubmit={handleSubmit} className="mt-8 space-y-4">
            <div>
              <Label htmlFor="email">E-mail</Label>
              <Input
                id="email"
                type="email"
                placeholder="seu@email.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="mt-1.5"
                required
                autoComplete="email"
                aria-invalid={error ? true : undefined}
              />
            </div>
            <div>
              <Label htmlFor="password">Senha</Label>
              <div className="relative mt-1.5">
                <Input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="pr-10"
                  required
                  autoComplete="current-password"
                  aria-invalid={error ? true : undefined}
                />
                <button
                  type="button"
                  className="absolute right-0 top-0 flex h-10 w-10 items-center justify-center text-muted-foreground hover:text-foreground"
                  onClick={() => setShowPassword((open) => !open)}
                  aria-label={showPassword ? "Ocultar senha" : "Mostrar senha"}
                >
                  {showPassword ? (
                    <EyeOff className="h-4 w-4" />
                  ) : (
                    <Eye className="h-4 w-4" />
                  )}
                </button>
              </div>
            </div>
            {error ? (
              <p className="text-sm text-destructive" role="alert">
                {error}
              </p>
            ) : null}
            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? "Entrando..." : "Entrar"}
            </Button>
          </form>

          <p className="mt-8 text-sm text-muted-foreground">
            Não tem conta?{" "}
            <Link to="/register" className="text-foreground hover:underline">
              Criar conta
            </Link>
          </p>
          <p className="mt-4 text-xs text-muted-foreground">
            Contas seed: buyer@skinmarket.gg / buyer123 · seller@skinmarket.gg /
            seller123 · admin@skinmarket.gg / admin123
          </p>
          <p className="mt-2 text-xs text-muted-foreground">
            Mais: collector@ e casual@ / buyer123 · pro_trader@ / seller456 ·
            rustking@ / seller123 · pending_seller@ / seller123 (aguardando
            aprovação)
          </p>
        </div>
      </div>
    </div>
  );
}
