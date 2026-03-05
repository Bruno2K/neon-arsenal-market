// ─── Presentation: AuthContext ────────────────────────────────────────────────
// Provides real JWT-based authentication.
// - Rehydrates the logged-in user on mount by calling GET /users/me
//   if a valid access token already exists in localStorage.
// - Listens for the `auth:session-expired` custom event dispatched by
//   HttpClient when a token-refresh attempt fails, and clears the session.
// - Exposes isLoading so PrivateRoute can show a spinner during rehydration.

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from 'react';
import type { User } from '@/domain/auth/entities/User';
import type {
  LoginCredentials,
  RegisterCredentials,
} from '@/domain/auth/repositories/IAuthRepository';
import { authRepository } from '@/infrastructure/repositories/AuthRepository';
import { tokenStorage } from '@/infrastructure/http/HttpClient';

// ─── Context shape ────────────────────────────────────────────────────────────

interface AuthContextType {
  user: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  login: (credentials: LoginCredentials) => Promise<void>;
  register: (credentials: RegisterCredentials) => Promise<void>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextType | null>(null);

// ─── Provider ─────────────────────────────────────────────────────────────────

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // Rehydrate user from stored token on first mount
  useEffect(() => {
    const rehydrate = async () => {
      const token = tokenStorage.getAccessToken();
      if (!token) {
        setIsLoading(false);
        return;
      }
      try {
        const me = await authRepository.getMe();
        setUser(me);
      } catch {
        // Token invalid or expired beyond refresh – clear silently
        tokenStorage.clearTokens();
      } finally {
        setIsLoading(false);
      }
    };

    rehydrate();
  }, []);

  // Listen for session-expired events emitted by HttpClient when refresh fails
  useEffect(() => {
    const handleExpired = () => {
      tokenStorage.clearTokens();
      setUser(null);
    };

    window.addEventListener('auth:session-expired', handleExpired);
    return () => window.removeEventListener('auth:session-expired', handleExpired);
  }, []);

  // ─── Actions ────────────────────────────────────────────────────────────────

  const login = useCallback(async (credentials: LoginCredentials) => {
    const response = await authRepository.login(credentials);
    tokenStorage.setTokens(response.accessToken, response.refreshToken);
    setUser(response.user);
  }, []);

  const register = useCallback(async (credentials: RegisterCredentials) => {
    const response = await authRepository.register(credentials);
    tokenStorage.setTokens(response.accessToken, response.refreshToken);
    setUser(response.user);
  }, []);

  const logout = useCallback(() => {
    tokenStorage.clearTokens();
    setUser(null);
  }, []);

  return (
    <AuthContext.Provider
      value={{
        user,
        isAuthenticated: !!user,
        isLoading,
        login,
        register,
        logout,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

// ─── Hook ─────────────────────────────────────────────────────────────────────

export const useAuth = () => {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
};
