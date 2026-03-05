import { useQuery } from '@tanstack/react-query';
import { authRepository } from '@/infrastructure/repositories/AuthRepository';
import { tokenStorage } from '@/infrastructure/http/HttpClient';

export const AUTH_ME_KEY = ['auth', 'me'] as const;

export function useCurrentUser() {
  return useQuery({
    queryKey: AUTH_ME_KEY,
    queryFn: () => authRepository.getMe(),
    enabled: !!tokenStorage.getAccessToken(),
    staleTime: 1000 * 60 * 5, // 5 minutes
    retry: false,
  });
}
