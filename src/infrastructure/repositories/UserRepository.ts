// ─── Infrastructure: UserRepository ─────────────────────────────────────────
// Implements IUserRepository using the real API.

import type { IUserRepository, UpdateMeData } from '@/domain/users/repositories/IUserRepository';
import { httpRequest } from '@/infrastructure/http/HttpClient';

class UserRepository implements IUserRepository {
  async updateMe(data: UpdateMeData): Promise<void> {
    await httpRequest<void>('/users/me', {
      method: 'PATCH',
      body: data,
    });
  }
}

export const userRepository = new UserRepository();
