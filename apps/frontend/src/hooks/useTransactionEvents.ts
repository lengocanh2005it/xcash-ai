import { useQueryClient } from '@tanstack/react-query';
import { useCallback, useMemo } from 'react';
import { API_BASE_URL, getAccessToken } from '@/lib/api';
import { useAuth } from './useAuth';
import { useSseStream } from './useSseStream';

interface TransactionEvent {
  type: 'transaction_classified';
  transactionId: string;
  status: 'classified' | 'review';
}

export function useTransactionEvents() {
  const { user } = useAuth();
  const qc = useQueryClient();

  const connect = useCallback(() => {
    const token = getAccessToken();
    if (!token) return null;
    return new EventSource(`${API_BASE_URL}/transactions/events?token=${token}`);
  }, []);

  const onMessage = useCallback(
    (e: MessageEvent<string>) => {
      try {
        const parsed = JSON.parse(e.data) as { data: TransactionEvent };
        const event = parsed.data;
        if (event?.type !== 'transaction_classified') return;
        void qc.invalidateQueries({ queryKey: ['transactions'] });
        void qc.invalidateQueries({
          queryKey: ['transactions', event.transactionId, 'detail'],
        });
        if (event.status === 'review') {
          void qc.invalidateQueries({ queryKey: ['review'] });
        }
      } catch {
        // ignore malformed events
      }
    },
    [qc],
  );

  const options = useMemo(
    () => ({ enabled: !!user?.tenantId, connect, onMessage }),
    [user?.tenantId, connect, onMessage],
  );

  useSseStream(options);
}
