import { useMutation, useQueryClient } from '@tanstack/react-query';
import { postApiData } from '@/lib/api';
import type { BankingCallbackResponse, GrantTokenResponse } from '@/types/onboarding';

export function useOnboardingMutations() {
  const queryClient = useQueryClient();

  const createGrantToken = useMutation({
    mutationFn: () =>
      postApiData<GrantTokenResponse>(
        '/onboarding/banking/grant-token?scopes=identity,transaction',
      ),
  });

  const completeCallback = useMutation({
    mutationFn: (publicToken: string) =>
      postApiData<BankingCallbackResponse>('/onboarding/banking/callback', { publicToken }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['onboarding'] });
    },
  });

  return { createGrantToken, completeCallback };
}
