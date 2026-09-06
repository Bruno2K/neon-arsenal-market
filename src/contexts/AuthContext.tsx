import {
  createContext,
  useContext,
  useState,
  useCallback,
  useEffect,
  ReactNode,
} from "react";
import * as authApi from "@/api/auth";
import { updateMe, type UpdateMeInput } from "@/api/users";
import {
  logTechnicalError,
  userFacingApiError,
} from "@/lib/userFacingApiError";
import type { User } from "@/types/api";

interface AuthContextType {
  user: User | null;
  isLoading: boolean;
  login: (email: string, password: string) => Promise<User>;
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
  updateProfile: (input: UpdateMeInput) => Promise<User>;
  logout: () => Promise<void>;
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
      await authApi.logout();
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
      return data.user;
    } catch (e) {
      const message = userFacingApiError(e);
      logTechnicalError(e);
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
        const message = userFacingApiError(e);
        logTechnicalError(e);
        setError(message);
        throw e;
      }
    },
    [],
  );

  const confirmRegistration = useCallback(
    async (email: string, code: string) => {
      setError(null);
      try {
        const data = await authApi.verifyEmail({ email, code });
        setUser(data.user);
      } catch (e) {
        const message = userFacingApiError(e);
        logTechnicalError(e);
        setError(message);
        throw e;
      }
    },
    [],
  );

  const updateProfile = useCallback(async (input: UpdateMeInput) => {
    setError(null);
    try {
      const updated = await updateMe(input);
      setUser(updated);
      return updated;
    } catch (e) {
      const message = userFacingApiError(e);
      logTechnicalError(e);
      setError(message);
      throw e;
    }
  }, []);

  const logout = useCallback(async () => {
    await authApi.logout();
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
        updateProfile,
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
