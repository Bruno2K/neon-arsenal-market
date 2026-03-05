// ─── Repository Interface: Auth ─────────────────────────────────────────────
// Dependency Inversion Principle (SOLID-D): higher layers depend on this
// abstraction, never on the concrete HTTP implementation.

import type { AuthResponse, User } from '../entities/User';

export interface LoginCredentials {
  email: string;
  password: string;
}

export interface RegisterCredentials {
  name: string;
  email: string;
  password: string;
  role?: 'CUSTOMER' | 'SELLER';
}

export interface IAuthRepository {
  login(credentials: LoginCredentials): Promise<AuthResponse>;
  register(credentials: RegisterCredentials): Promise<AuthResponse>;
  refresh(refreshToken: string): Promise<AuthResponse>;
  getMe(): Promise<User>;
}
