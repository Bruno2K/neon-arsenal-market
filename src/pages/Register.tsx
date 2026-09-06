import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Eye, EyeOff } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { homePathForRole } from "@/lib/postLoginPath";
import { userFacingApiError } from "@/lib/userFacingApiError";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

type Role = "CUSTOMER" | "SELLER";

/** Cooldown after each startRegistration call (30–60s, issue #121). */
export const REGISTER_RESEND_COOLDOWN_SECONDS = 45;

export const REGISTER_RESEND_SUCCESS =
  "Enviamos um novo código. O código anterior pode expirar.";

export default function Register() {
  const { startRegistration, confirmRegistration, error, clearError } =
    useAuth();
  const navigate = useNavigate();
  const [step, setStep] = useState<1 | 2>(1);
  const [loading, setLoading] = useState(false);
  const [resending, setResending] = useState(false);
  const [resendSeconds, setResendSeconds] = useState(0);
  const [resendNotice, setResendNotice] = useState<string | null>(null);
  const [resendError, setResendError] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [role, setRole] = useState<Role>("CUSTOMER");
  const [storeName, setStoreName] = useState("");
  const [code, setCode] = useState("");
  const [devCode, setDevCode] = useState<string | null>(null);

  const cooldownActive = resendSeconds > 0;
  useEffect(() => {
    if (!cooldownActive) return;
    const timer = window.setInterval(() => {
      setResendSeconds((seconds) => (seconds <= 1 ? 0 : seconds - 1));
    }, 1000);
    return () => window.clearInterval(timer);
  }, [cooldownActive]);

  const registrationPayload = {
    name,
    email,
    password,
    role,
    ...(role === "SELLER" ? { storeName: storeName || undefined } : {}),
  };

  const handleStep1 = async (e: React.FormEvent) => {
    e.preventDefault();
    clearError();
    setLoading(true);
    try {
      const result = await startRegistration(registrationPayload);
      setDevCode(result.code ?? null);
      setResendNotice(null);
      setResendError(null);
      setResendSeconds(REGISTER_RESEND_COOLDOWN_SECONDS);
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
    setResendError(null);
    setLoading(true);
    try {
      await confirmRegistration(email, code);
      navigate(homePathForRole(role), { replace: true });
    } catch {
      setLoading(false);
    }
  };

  const handleResend = async () => {
    if (resending || resendSeconds > 0 || loading) return;
    clearError();
    setResendError(null);
    setResendNotice(null);
    setResending(true);
    try {
      const result = await startRegistration(registrationPayload);
      if (result.code) {
        setDevCode(result.code);
      }
      setResendNotice(REGISTER_RESEND_SUCCESS);
      setResendSeconds(REGISTER_RESEND_COOLDOWN_SECONDS);
    } catch (e) {
      setResendError(userFacingApiError(e));
    } finally {
      setResending(false);
    }
  };

  const step2Busy = loading || resending;
  const step2Alert = error ?? resendError;

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <div className="flex flex-1 items-center justify-center px-4 py-12">
        <div className="w-full max-w-sm">
          <Link
            to="/"
            className="mb-8 flex min-h-11 items-center gap-2.5 rounded-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            aria-label="Neon Arsenal, página inicial"
          >
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
                  aria-describedby={error ? "register-error" : undefined}
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
                  aria-describedby={error ? "register-error" : undefined}
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
                    aria-describedby={error ? "register-error" : undefined}
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
                <p
                  id="register-error"
                  className="text-sm text-destructive"
                  role="alert"
                >
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
                  aria-invalid={step2Alert ? true : undefined}
                  aria-describedby={
                    step2Alert
                      ? "register-code-error"
                      : resendNotice
                        ? "register-resend-notice"
                        : undefined
                  }
                />
              </div>
              {resendNotice ? (
                <p
                  id="register-resend-notice"
                  className="text-sm text-muted-foreground"
                  role="status"
                >
                  {resendNotice}
                </p>
              ) : null}
              {step2Alert ? (
                <p
                  id="register-code-error"
                  className="text-sm text-destructive"
                  role="alert"
                >
                  {step2Alert}
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
                    setResendNotice(null);
                    setResendError(null);
                    clearError();
                  }}
                  disabled={step2Busy}
                >
                  Voltar
                </Button>
                <Button
                  type="submit"
                  className="flex-1"
                  disabled={step2Busy || code.length !== 6}
                >
                  {loading ? "Confirmando..." : "Confirmar"}
                </Button>
              </div>
              <Button
                type="button"
                variant="ghost"
                className="w-full"
                onClick={() => {
                  void handleResend();
                }}
                disabled={step2Busy || resendSeconds > 0}
              >
                {resending
                  ? "Reenviando..."
                  : resendSeconds > 0
                    ? `Reenviar em ${resendSeconds}s`
                    : "Reenviar código"}
              </Button>
              <p className="text-xs text-muted-foreground">
                Não chegou? Reenvie depois do intervalo. O código anterior pode
                expirar.
              </p>
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
