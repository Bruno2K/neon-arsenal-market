import { createContext, useContext, useState, ReactNode } from 'react';
import type { UserRole } from '@/services/mock-data';

interface User {
  id: string;
  name: string;
  email: string;
  role: UserRole;
}

interface AuthContextType {
  user: User | null;
  login: (role: UserRole) => void;
  logout: () => void;
  isAuthenticated: boolean;
}

const AuthContext = createContext<AuthContextType | null>(null);

const mockUsers: Record<UserRole, User> = {
  customer: { id: 'u1', name: 'Player One', email: 'player@skinmarket.gg', role: 'customer' },
  seller: { id: 'u2', name: 'NeonTrader', email: 'seller@skinmarket.gg', role: 'seller' },
  admin: { id: 'u3', name: 'Admin', email: 'admin@skinmarket.gg', role: 'admin' },
};

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const login = (role: UserRole) => setUser(mockUsers[role]);
  const logout = () => setUser(null);

  return (
    <AuthContext.Provider value={{ user, login, logout, isAuthenticated: !!user }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
};
