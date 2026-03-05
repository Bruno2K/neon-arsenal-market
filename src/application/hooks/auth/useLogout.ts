import { useCallback } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { tokenStorage } from '@/infrastructure/http/HttpClient';

export function useLogout() {
  const queryClient = useQueryClient();

  return useCallback(() => {
    tokenStorage.clearTokens();
    queryClient.clear();
  }, [queryClient]);
}
