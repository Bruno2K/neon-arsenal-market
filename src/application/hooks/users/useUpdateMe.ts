// ─── Application Hook: useUpdateMe ───────────────────────────────────────────
// Mutation to update the current user's profile (name, email, password).
// On success, invalidates the auth/me query so the AuthContext re-fetches.

import { useMutation, useQueryClient } from '@tanstack/react-query';
import type { UpdateMeData } from '@/domain/users/repositories/IUserRepository';
import { userRepository } from '@/infrastructure/repositories/UserRepository';

export function useUpdateMe() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: UpdateMeData) => userRepository.updateMe(data),
    onSuccess: () => {
      // Refresh the logged-in user data
      queryClient.invalidateQueries({ queryKey: ['auth', 'me'] });
    },
  });
}
