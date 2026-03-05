// ─── Infrastructure: AuthRepository ─────────────────────────────────────────
// Implements IAuthRepository using the REST API.
// Single Responsibility: only HTTP calls related to authentication.

import type { IAuthRepository, LoginCredentials, RegisterCredentials } from '@/domain/auth/repositories/IAuthRepository';
import type { AuthResponse, User } from '@/domain/auth/entities/User';
import { httpRequest } from '../http/HttpClient';

export class AuthRepository implements IAuthRepository {
  async login(credentials: LoginCredentials): Promise<AuthResponse> {
    return httpRequest<AuthResponse>('/auth/login', {
      method: 'POST',
      body: credentials,
    });
  }

  async register(credentials: RegisterCredentials): Promise<AuthResponse> {
    return httpRequest<AuthResponse>('/auth/register', {
      method: 'POST',
      body: { role: 'CUSTOMER', ...credentials },
    });
  }

  async refresh(refreshToken: string): Promise<AuthResponse> {
    return httpRequest<AuthResponse>('/auth/refresh', {
      method: 'POST',
      body: { refreshToken },
    });
  }

  async getMe(): Promise<User> {
    return httpRequest<User>('/users/me');
  }
}

// Singleton — avoids creating multiple instances throughout the app
export const authRepository = new AuthRepository();
