import {
  createContext,
  useContext,
  useState,
  useCallback,
  useEffect,
  ReactNode,
} from "react";
import * as authApi from "@/api/auth";
import type { User } from "@/types/api";

interface AuthContextType {
  user: User | null;
  isLoading: boolean;
  login: (email: string, password: string) => Promise<void>;
  /** Step 1: send verification code to email. Returns message and optional code (dev). */
  startRegistration: (params: {
    name: string;
    email: string;
    password: string;
    role?: "CUSTOMER" | "SELLER";
    storeName?: string;
  }) => Promise<{ message: string; code?: string }>;
  /** Step 2: confirm email with code and complete registration. */
  confirmRegistration: (email: string, code: string) => Promise<void>;
  logout: () => void;
  isAuthenticated: boolean;
  error: string | null;
  clearError: () => void;
}

const AuthContext = createContext<AuthContextType | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadUser = useCallback(async () => {
    if (!authApi.getStoredAccessToken()) {
      setUser(null);
      setIsLoading(false);
      return;
    }
    try {
      const me = await authApi.me();
      setUser(me);
    } catch {
      authApi.logout();
      setUser(null);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadUser();
  }, [loadUser]);

  const login = useCallback(async (email: string, password: string) => {
    setError(null);
    try {
      const data = await authApi.login({ email, password });
      setUser(data.user);
    } catch (e) {
      const message = e instanceof Error ? e.message : "Login failed";
      setError(message);
      throw e;
    }
  }, []);

  const startRegistration = useCallback(
    async (params: {
      name: string;
      email: string;
      password: string;
      role?: "CUSTOMER" | "SELLER";
      storeName?: string;
    }) => {
      setError(null);
      try {
        return await authApi.register(params);
      } catch (e) {
        const message = e instanceof Error ? e.message : "Registration failed";
        setError(message);
        throw e;
      }
    },
    []
  );

  const confirmRegistration = useCallback(async (email: string, code: string) => {
    setError(null);
    try {
      const data = await authApi.verifyEmail({ email, code });
      setUser(data.user);
    } catch (e) {
      const message = e instanceof Error ? e.message : "Invalid or expired code";
      setError(message);
      throw e;
    }
  }, []);

  const logout = useCallback(() => {
    authApi.logout();
    setUser(null);
    setError(null);
  }, []);

  const clearError = useCallback(() => setError(null), []);

  return (
    <AuthContext.Provider
      value={{
        user,
        isLoading,
        login,
        startRegistration,
        confirmRegistration,
        logout,
        isAuthenticated: !!user,
        error,
        clearError,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
};
