import { useCallback, useRef, useState } from 'react';
import type { StreamActivity } from '@/components/copilot/CopilotLoadingStatus';
import type { CopilotActivity } from '@/components/copilot/CopilotSourceChips';
import { API_BASE_URL, api, getAccessToken } from '@/lib/api';
import type { SseEvent } from '@/lib/copilot-sse';
import { feedSseChunk, flushSsePending } from '@/lib/copilot-sse';

export interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  activities?: CopilotActivity[];
  isPartial?: boolean;
}

interface UseCopilotChatOptions {
  activeConversationId: string | null;
  getMessages: () => Message[];
  addMessage: (msg: Message) => void;
  onConversationCreated: (conversationId: string) => void;
  refreshListAfterChat: (opts: {
    conversationId: string;
    firstMessage: string;
    isNewConversation: boolean;
  }) => void;
  invalidateList: () => void;
}

interface UseCopilotChatReturn {
  sendMessage: (text: string) => Promise<void>;
  handleStop: () => void;
  isLoading: boolean;
  canAbort: boolean;
  streamActivity: StreamActivity | undefined;
  streamingContent: string;
}

function getHistory(msgs: Message[], convId: string | null) {
  const slice = msgs.slice(-10);
  const withoutPendingUser =
    !convId && slice.length > 0 && slice[slice.length - 1]?.role === 'user'
      ? slice.slice(0, -1)
      : slice;
  return withoutPendingUser.map(({ role, content }) => ({ role, content }));
}

export function useCopilotChat({
  activeConversationId,
  getMessages,
  addMessage,
  onConversationCreated,
  refreshListAfterChat,
  invalidateList,
}: UseCopilotChatOptions): UseCopilotChatReturn {
  const [isLoading, setIsLoading] = useState(false);
  const [canAbort, setCanAbort] = useState(false);
  const [streamActivity, setStreamActivity] = useState<StreamActivity | undefined>();
  const [streamingContent, setStreamingContent] = useState('');
  const abortRef = useRef<AbortController | null>(null);
  const activeConversationIdRef = useRef(activeConversationId);
  activeConversationIdRef.current = activeConversationId;

  const sendViaStream = useCallback(
    async (text: string, msgs: Message[], convId: string | null): Promise<string | null> => {
      const token = getAccessToken();
      abortRef.current = new AbortController();
      let receivedConversationId: string | null = null;
      let accumulated = '';

      try {
        const response = await fetch(`${API_BASE_URL}/ai/copilot/stream`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
          },
          body: JSON.stringify({
            message: text,
            history: getHistory(msgs, convId),
            ...(convId ? { conversationId: convId } : {}),
          }),
          signal: abortRef.current.signal,
        });
        if (!response.ok || !response.body) throw new Error('stream failed');

        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        const pending = { buffer: '' };
        let receivedDone = false;

        const handleSseEvent = ({ event, data }: SseEvent) => {
          if (event === 'activity') {
            setStreamActivity(JSON.parse(data) as StreamActivity);
          } else if (event === 'delta') {
            accumulated += (JSON.parse(data) as { content: string }).content;
            setStreamingContent(accumulated);
          } else if (event === 'done') {
            receivedDone = true;
            const {
              reply,
              meta,
              conversationId: newConvId,
            } = JSON.parse(data) as {
              reply: string;
              meta?: { activities: CopilotActivity[] };
              conversationId?: string;
            };
            receivedConversationId = newConvId ?? convId;
            setStreamingContent('');
            setStreamActivity(undefined);
            addMessage({
              id: `a-${Date.now()}`,
              role: 'assistant',
              content: reply,
              activities: meta?.activities ?? [],
            });
          }
        };

        while (true) {
          const { done, value } = await reader.read();
          if (value) {
            for (const evt of feedSseChunk(decoder.decode(value, { stream: true }), pending)) {
              handleSseEvent(evt);
            }
          }
          if (done) break;
        }

        const tail = decoder.decode();
        if (tail) {
          for (const evt of feedSseChunk(tail, pending)) handleSseEvent(evt);
        }
        for (const evt of flushSsePending(pending)) handleSseEvent(evt);

        if (!receivedDone) throw new Error('stream ended without done');
        return receivedConversationId;
      } catch (err) {
        if ((err as Error).name === 'AbortError') {
          if (accumulated.trim()) {
            addMessage({
              id: `a-${Date.now()}`,
              role: 'assistant',
              content: accumulated,
              activities: [],
              isPartial: true,
            });
          }
          setStreamingContent('');
          setStreamActivity(undefined);
          return null;
        }
        throw err;
      }
    },
    [addMessage],
  );

  const sendViaJson = useCallback(
    async (text: string, msgs: Message[], convId: string | null): Promise<string | null> => {
      const res = await api.post<{
        data: { reply: string; meta?: { activities: CopilotActivity[] }; conversationId?: string };
      }>('/ai/copilot', {
        message: text,
        history: getHistory(msgs, convId),
        ...(convId ? { conversationId: convId } : {}),
      });
      const { reply, meta, conversationId: newConvId } = res.data.data;
      addMessage({
        id: `a-${Date.now()}`,
        role: 'assistant',
        content: reply,
        activities: meta?.activities ?? [],
      });
      return newConvId ?? convId;
    },
    [addMessage],
  );

  const sendMessage = useCallback(
    async (text: string) => {
      if (!text.trim() || isLoading) return;
      const msgs = getMessages();
      const userMsg: Message = { id: `u-${Date.now()}`, role: 'user', content: text };
      addMessage(userMsg);
      setIsLoading(true);
      setStreamActivity(undefined);
      setStreamingContent('');

      const isNewConversation = !activeConversationIdRef.current;
      const currentConvId = activeConversationIdRef.current;

      let wasAborted = false;
      setCanAbort(true);
      try {
        const newConvId = await sendViaStream(text, [...msgs, userMsg], currentConvId);
        if (newConvId === null) {
          wasAborted = true;
          return;
        }
        const convId = newConvId ?? currentConvId;
        if (newConvId && newConvId !== currentConvId) {
          onConversationCreated(newConvId);
        }
        if (convId) {
          refreshListAfterChat({
            conversationId: convId,
            firstMessage: text,
            isNewConversation,
          });
        } else {
          invalidateList();
        }
      } catch {
        setCanAbort(false);
        try {
          const newConvId = await sendViaJson(text, [...msgs, userMsg], currentConvId);
          const convId = newConvId ?? currentConvId;
          if (newConvId && newConvId !== currentConvId) {
            onConversationCreated(newConvId);
          }
          if (convId) {
            refreshListAfterChat({
              conversationId: convId,
              firstMessage: text,
              isNewConversation,
            });
          } else {
            invalidateList();
          }
        } catch {
          addMessage({
            id: `err-${Date.now()}`,
            role: 'assistant',
            content: 'Xin lỗi, có lỗi xảy ra. Vui lòng thử lại.',
          });
        }
      } finally {
        setCanAbort(false);
        if (!wasAborted) {
          setIsLoading(false);
          setStreamActivity(undefined);
          setStreamingContent('');
        } else {
          setIsLoading(false);
        }
      }
    },
    [
      isLoading,
      sendViaStream,
      sendViaJson,
      getMessages,
      addMessage,
      onConversationCreated,
      refreshListAfterChat,
      invalidateList,
    ],
  );

  const handleStop = useCallback(() => {
    abortRef.current?.abort();
  }, []);

  return {
    sendMessage,
    handleStop,
    isLoading,
    canAbort,
    streamActivity,
    streamingContent,
  };
}
