import { useQuery } from '@tanstack/react-query';
import { getApiData } from '@/lib/api';
import { useAuth } from './useAuth';

export function useReviewCount() {
  const { user } = useAuth();

  return useQuery({
    queryKey: ['review', 'count'],
    queryFn: () => getApiData<number>('/review/count'),
    enabled: !!user && !!user.tenantId,
    refetchInterval: 20_000,
    refetchIntervalInBackground: true,
  });
}
