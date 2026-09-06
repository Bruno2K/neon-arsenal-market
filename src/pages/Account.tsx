import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { Eye, EyeOff } from "lucide-react";
import { getMe } from "@/api/users";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { ErrorState } from "@/components/page-state";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import {
  ApiClientError,
  USER_FACING_EMAIL_TAKEN,
  USER_FACING_VALIDATION,
  userFacingApiError,
} from "@/lib/userFacingApiError";
import type { User } from "@/types/api";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

interface FieldErrors {
  name?: string;
  email?: string;
  password?: string;
}

function AccountFormSkeleton() {
  return (
    <div
      className="container max-w-2xl space-y-4 py-8"
      role="status"
      aria-label="Carregando conta"
    >
      <Skeleton className="h-8 w-40" />
      <Skeleton className="h-4 w-64 max-w-full" />
      <Skeleton className="h-11 w-full" />
      <Skeleton className="h-11 w-full" />
      <Skeleton className="h-11 w-full" />
      <Skeleton className="h-11 w-32" />
    </div>
  );
}

function validateFields(values: {
  name: string;
  email: string;
  password: string;
}): FieldErrors {
  const errors: FieldErrors = {};
  if (values.name.trim().length < 1) {
    errors.name = "Informe um nome";
  }
  if (!EMAIL_RE.test(values.email.trim())) {
    errors.email = "Informe um e-mail válido";
  }
  if (values.password.length > 0 && values.password.length < 6) {
    errors.password = "A senha deve ter pelo menos 6 caracteres";
  }
  return errors;
}

function dashboardPath(role: User["role"]): string | null {
  if (role === "SELLER") return "/seller";
  if (role === "ADMIN") return "/admin";
  return null;
}

export default function AccountPage() {
  const { user, updateProfile, logout } = useAuth();
  const { toast } = useToast();

  const [loaded, setLoaded] = useState<User | null>(null);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [loadError, setLoadError] = useState<unknown>(null);
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [formError, setFormError] = useState<string | null>(null);

  const loadProfile = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    try {
      const me = await getMe();
      setLoaded(me);
      setName(me.name);
      setEmail(me.email);
      setPassword("");
    } catch (error) {
      setLoadError(error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadProfile();
  }, [loadProfile]);

  const dirty = useMemo(() => {
    if (!loaded) return false;
    return (
      name.trim() !== loaded.name ||
      email.trim() !== loaded.email ||
      password.length > 0
    );
  }, [loaded, name, email, password]);

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    if (!dirty || saving) return;

    const nextErrors = validateFields({ name, email, password });
    setFieldErrors(nextErrors);
    setFormError(null);
    if (Object.keys(nextErrors).length > 0) return;

    const body: { name?: string; email?: string; password?: string } = {};
    const nextName = name.trim();
    const nextEmail = email.trim();
    if (loaded && nextName !== loaded.name) body.name = nextName;
    if (loaded && nextEmail !== loaded.email) body.email = nextEmail;
    if (password.length > 0) body.password = password;

    setSaving(true);
    try {
      const updated = await updateProfile(body);
      setLoaded(updated);
      setName(updated.name);
      setEmail(updated.email);
      setPassword("");
      toast({ description: "Dados salvos" });
    } catch (error) {
      if (error instanceof ApiClientError && error.status === 409) {
        setFormError(USER_FACING_EMAIL_TAKEN);
      } else if (error instanceof ApiClientError && error.status === 400) {
        setFormError(USER_FACING_VALIDATION);
      } else {
        setFormError(userFacingApiError(error));
      }
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return <AccountFormSkeleton />;
  }

  if (loadError || !loaded) {
    return (
      <div className="container py-8">
        <ErrorState
          title="Erro ao carregar conta"
          error={loadError}
          action={
            <Button
              type="button"
              variant="outline"
              onClick={() => void loadProfile()}
            >
              Tentar novamente
            </Button>
          }
        />
      </div>
    );
  }

  const sellerAdminPath = dashboardPath(user?.role ?? loaded.role);
  const isCustomer = (user?.role ?? loaded.role) === "CUSTOMER";

  return (
    <div className="container max-w-2xl py-8">
      <div className="mb-8">
        <h1 className="text-2xl font-semibold tracking-tight">Minha conta</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Atualize seu nome, e-mail e senha.
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4" noValidate>
        <div>
          <Label htmlFor="account-name">Nome</Label>
          <Input
            id="account-name"
            value={name}
            onChange={(event) => setName(event.target.value)}
            className="mt-1.5"
            autoComplete="name"
            aria-invalid={fieldErrors.name ? true : undefined}
            aria-describedby={
              fieldErrors.name ? "account-name-error" : undefined
            }
          />
          {fieldErrors.name ? (
            <p
              id="account-name-error"
              className="mt-1.5 text-sm text-destructive"
              role="alert"
            >
              {fieldErrors.name}
            </p>
          ) : null}
        </div>

        <div>
          <Label htmlFor="account-email">E-mail</Label>
          <Input
            id="account-email"
            type="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            className="mt-1.5"
            autoComplete="email"
            aria-invalid={fieldErrors.email ? true : undefined}
            aria-describedby={
              fieldErrors.email ? "account-email-error" : undefined
            }
          />
          {fieldErrors.email ? (
            <p
              id="account-email-error"
              className="mt-1.5 text-sm text-destructive"
              role="alert"
            >
              {fieldErrors.email}
            </p>
          ) : null}
        </div>

        <div>
          <Label htmlFor="account-password">Nova senha</Label>
          <div className="relative mt-1.5">
            <Input
              id="account-password"
              type={showPassword ? "text" : "password"}
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              className="pr-10"
              autoComplete="new-password"
              placeholder="Opcional"
              aria-invalid={fieldErrors.password ? true : undefined}
              aria-describedby={
                fieldErrors.password
                  ? "account-password-error"
                  : "account-password-hint"
              }
            />
            <button
              type="button"
              className="absolute right-0 top-0 flex h-11 w-11 items-center justify-center text-muted-foreground hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
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
          {fieldErrors.password ? (
            <p
              id="account-password-error"
              className="mt-1.5 text-sm text-destructive"
              role="alert"
            >
              {fieldErrors.password}
            </p>
          ) : (
            <p
              id="account-password-hint"
              className="mt-1.5 text-sm text-muted-foreground"
            >
              Deixe em branco para manter a senha atual. Mínimo de 6 caracteres.
            </p>
          )}
        </div>

        {formError ? (
          <p className="text-sm text-destructive" role="alert">
            {formError}
          </p>
        ) : null}

        <Button type="submit" disabled={!dirty || saving}>
          {saving ? "Salvando..." : "Salvar"}
        </Button>
      </form>

      <div className="mt-10 space-y-3">
        <h2 className="text-lg font-semibold tracking-tight">Atalhos</h2>
        <div className="flex flex-wrap gap-2">
          {isCustomer ? (
            <Button asChild variant="outline">
              <Link to="/account/orders">Meus pedidos</Link>
            </Button>
          ) : null}
          {sellerAdminPath ? (
            <Button asChild variant="outline">
              <Link to={sellerAdminPath}>Dashboard</Link>
            </Button>
          ) : null}
          <Button type="button" variant="ghost" onClick={() => void logout()}>
            Sair
          </Button>
        </div>
      </div>
    </div>
  );
}
