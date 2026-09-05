import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Eye, EyeOff } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

type Role = "CUSTOMER" | "SELLER";

export default function Register() {
  const { startRegistration, confirmRegistration, error, clearError } =
    useAuth();
  const navigate = useNavigate();
  const [step, setStep] = useState<1 | 2>(1);
  const [loading, setLoading] = useState(false);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [role, setRole] = useState<Role>("CUSTOMER");
  const [storeName, setStoreName] = useState("");
  const [code, setCode] = useState("");
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
        ...(role === "SELLER" ? { storeName: storeName || undefined } : {}),
      });
      setDevCode(result.code ?? null);
      setStep(2);
    } catch {
      // error shown via context
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
      navigate("/", { replace: true });
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

          <p className="text-xs text-muted-foreground">Passo {step} de 2</p>
          <h1 className="mt-1 text-2xl font-semibold tracking-tight">
            {step === 1 ? "Criar conta" : "Confirmar e-mail"}
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {step === 1
              ? "Comprador ou vendedor. Sem senha compartilhada."
              : `Código de 6 dígitos enviado para ${email}`}
          </p>

          {step === 1 ? (
            <form onSubmit={handleStep1} className="mt-8 space-y-4">
              <div>
                <Label htmlFor="name">Nome</Label>
                <Input
                  id="name"
                  type="text"
                  placeholder="Seu nome"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="mt-1.5"
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
                  className="mt-1.5"
                  required
                  autoComplete="email"
                />
              </div>
              <div>
                <Label htmlFor="password">Senha</Label>
                <div className="relative mt-1.5">
                  <Input
                    id="password"
                    type={showPassword ? "text" : "password"}
                    placeholder="Mín. 6 caracteres"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="pr-10"
                    required
                    minLength={6}
                    autoComplete="new-password"
                  />
                  <button
                    type="button"
                    className="absolute right-0 top-0 flex h-11 w-11 items-center justify-center text-muted-foreground hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    onClick={() => setShowPassword((open) => !open)}
                    aria-label={
                      showPassword ? "Ocultar senha" : "Mostrar senha"
                    }
                  >
                    {showPassword ? (
                      <EyeOff className="h-4 w-4" />
                    ) : (
                      <Eye className="h-4 w-4" />
                    )}
                  </button>
                </div>
              </div>
              <fieldset>
                <legend className="text-sm font-medium">Tipo de conta</legend>
                <div className="mt-2 flex gap-2">
                  <label
                    className={`flex min-h-11 flex-1 cursor-pointer items-center justify-center rounded-md border text-sm ${
                      role === "CUSTOMER"
                        ? "border-primary bg-accent text-accent-foreground"
                        : "border-border text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    <input
                      type="radio"
                      name="role"
                      className="sr-only"
                      checked={role === "CUSTOMER"}
                      onChange={() => setRole("CUSTOMER")}
                    />
                    Comprador
                  </label>
                  <label
                    className={`flex min-h-11 flex-1 cursor-pointer items-center justify-center rounded-md border text-sm ${
                      role === "SELLER"
                        ? "border-primary bg-accent text-accent-foreground"
                        : "border-border text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    <input
                      type="radio"
                      name="role"
                      className="sr-only"
                      checked={role === "SELLER"}
                      onChange={() => setRole("SELLER")}
                    />
                    Vendedor
                  </label>
                </div>
              </fieldset>
              {role === "SELLER" ? (
                <div>
                  <Label htmlFor="storeName">Nome da loja</Label>
                  <Input
                    id="storeName"
                    type="text"
                    placeholder="Minha Loja"
                    value={storeName}
                    onChange={(e) => setStoreName(e.target.value)}
                    className="mt-1.5"
                    required={role === "SELLER"}
                  />
                  <p className="mt-1 text-xs text-muted-foreground">
                    Sua conta ficará pendente até aprovação do administrador.
                  </p>
                </div>
              ) : null}
              {error ? (
                <p className="text-sm text-destructive" role="alert">
                  {error}
                </p>
              ) : null}
              <Button type="submit" className="w-full" disabled={loading}>
                {loading ? "Enviando..." : "Enviar código por e-mail"}
              </Button>
            </form>
          ) : (
            <form onSubmit={handleStep2} className="mt-8 space-y-4">
              {devCode ? (
                <p className="rounded-md bg-muted px-3 py-2 text-xs text-muted-foreground">
                  Ambiente de desenvolvimento: código ={" "}
                  <strong className="text-foreground">{devCode}</strong>
                </p>
              ) : null}
              <div>
                <Label htmlFor="code">Código</Label>
                <Input
                  id="code"
                  type="text"
                  inputMode="numeric"
                  placeholder="000000"
                  value={code}
                  onChange={(e) =>
                    setCode(e.target.value.replace(/\D/g, "").slice(0, 6))
                  }
                  className="mt-1.5 font-mono text-lg tracking-[0.3em]"
                  maxLength={6}
                  required
                  autoComplete="one-time-code"
                  aria-invalid={error ? true : undefined}
                />
              </div>
              {error ? (
                <p className="text-sm text-destructive" role="alert">
                  {error}
                </p>
              ) : null}
              <div className="flex gap-2">
                <Button
                  type="button"
                  variant="outline"
                  className="flex-1"
                  onClick={() => {
                    setStep(1);
                    setCode("");
                    clearError();
                  }}
                  disabled={loading}
                >
                  Voltar
                </Button>
                <Button
                  type="submit"
                  className="flex-1"
                  disabled={loading || code.length !== 6}
                >
                  {loading ? "Confirmando..." : "Confirmar"}
                </Button>
              </div>
            </form>
          )}

          <p className="mt-8 text-sm text-muted-foreground">
            Já tem conta?{" "}
            <Link to="/login" className="text-foreground hover:underline">
              Entrar
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
