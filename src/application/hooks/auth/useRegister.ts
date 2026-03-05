import { useMutation, useQueryClient } from '@tanstack/react-query';
import { authRepository } from '@/infrastructure/repositories/AuthRepository';
import { tokenStorage } from '@/infrastructure/http/HttpClient';
import type { RegisterCredentials } from '@/domain/auth/repositories/IAuthRepository';

export function useRegister() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (credentials: RegisterCredentials) => authRepository.register(credentials),
    onSuccess: (data) => {
      tokenStorage.setTokens(data.accessToken, data.refreshToken);
      queryClient.setQueryData(['auth', 'me'], data.user);
    },
  });
}
