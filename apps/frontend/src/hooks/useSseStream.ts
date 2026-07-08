import { useEffect, useRef } from 'react';

export interface UseSseStreamOptions {
  enabled: boolean;
  /** Return an EventSource (sync or async). Return null to skip/retry later. */
  connect: () => EventSource | null | Promise<EventSource | null>;
  /** Called for each SSE message. */
  onMessage: (event: MessageEvent<string>) => void;
  /** Reconnect delay in ms after error. Default 5000. */
  reconnectDelay?: number;
}

/**
 * Shared SSE EventSource lifecycle with auto-reconnect.
 * Handles open / onmessage / onerror / cleanup — callers only provide
 * a connect function (token acquisition) and a message handler.
 */
export function useSseStream({
  enabled,
  connect: connectFn,
  onMessage,
  reconnectDelay = 5_000,
}: UseSseStreamOptions) {
  const connectRef = useRef(connectFn);
  connectRef.current = connectFn;
  const onMessageRef = useRef(onMessage);
  onMessageRef.current = onMessage;

  useEffect(() => {
    if (!enabled) return;

    let es: EventSource | null = null;
    let reconnectTimer: ReturnType<typeof setTimeout> | null = null;
    let closed = false;

    const connect = () => {
      const result = connectRef.current();
      // Handle both sync and async return
      if (result instanceof Promise) {
        void result.then((source) => {
          if (closed || !source) return;
          attach(source);
        });
        return;
      }
      if (!result) return;
      attach(result);
    };

    const attach = (source: EventSource) => {
      es = source;
      es.onmessage = (e) => onMessageRef.current(e);
      es.onerror = () => {
        es?.close();
        es = null;
        if (!closed) {
          reconnectTimer = setTimeout(connect, reconnectDelay);
        }
      };
    };

    connect();

    return () => {
      closed = true;
      if (reconnectTimer) clearTimeout(reconnectTimer);
      es?.close();
    };
  }, [enabled, reconnectDelay]);
}
