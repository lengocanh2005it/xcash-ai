import { useQueryClient } from '@tanstack/react-query';
import { useEffect } from 'react';
import { API_BASE_URL, getAccessToken } from '@/lib/api';
import { useAuth } from './useAuth';

interface TransactionEvent {
  type: 'transaction_classified';
  transactionId: string;
  status: 'classified' | 'review';
}

export function useTransactionEvents() {
  const { user } = useAuth();
  const qc = useQueryClient();

  useEffect(() => {
    if (!user?.tenantId) return;

    let es: EventSource | null = null;
    let reconnectTimer: ReturnType<typeof setTimeout> | null = null;
    let closed = false;

    const connect = () => {
      const token = getAccessToken();
      if (!token) {
        reconnectTimer = setTimeout(connect, 3_000);
        return;
      }

      es = new EventSource(`${API_BASE_URL}/transactions/events?token=${token}`);

      es.onmessage = (e: MessageEvent<string>) => {
        try {
          // Backend SSE format: { data: TransactionEvent }
          const parsed = JSON.parse(e.data) as { data: TransactionEvent };
          const event = parsed.data;
          if (event?.type !== 'transaction_classified') return; // keepalive
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
      };

      es.onerror = () => {
        es?.close();
        es = null;
        if (!closed) {
          reconnectTimer = setTimeout(connect, 5_000);
        }
      };
    };

    connect();

    return () => {
      closed = true;
      if (reconnectTimer) clearTimeout(reconnectTimer);
      es?.close();
    };
  }, [user?.tenantId, qc]);
}
