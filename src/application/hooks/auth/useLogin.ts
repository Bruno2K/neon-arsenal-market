import { useMutation, useQueryClient } from '@tanstack/react-query';
import { authRepository } from '@/infrastructure/repositories/AuthRepository';
import { tokenStorage } from '@/infrastructure/http/HttpClient';
import type { LoginCredentials } from '@/domain/auth/repositories/IAuthRepository';

export function useLogin() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (credentials: LoginCredentials) => authRepository.login(credentials),
    onSuccess: (data) => {
      tokenStorage.setTokens(data.accessToken, data.refreshToken);
      queryClient.setQueryData(['auth', 'me'], data.user);
    },
  });
}
