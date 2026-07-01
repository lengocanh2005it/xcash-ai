import { useQuery } from '@tanstack/react-query';
import { getApiData } from '@/lib/api';

interface HealthData {
  status: string;
}

export function useHealthCheck() {
  return useQuery({
    queryKey: ['health'],
    queryFn: () => getApiData<HealthData>('/health'),
    retry: 1,
  });
}
