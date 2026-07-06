import { SubscriptionPlan } from '@xcash/shared-types';
import { Bot, Send, User } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import type { StreamActivity } from '@/components/copilot/CopilotLoadingStatus';
import { CopilotLoadingStatus } from '@/components/copilot/CopilotLoadingStatus';
import type { CopilotActivity } from '@/components/copilot/CopilotSourceChips';
import { CopilotSourceChips } from '@/components/copilot/CopilotSourceChips';
import { Header } from '@/components/layout/Header';
import { HighlightedText } from '@/components/shared/HighlightedText';
import { PlanGate } from '@/components/shared/PlanGate';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { API_BASE_URL, api, getAccessToken } from '@/lib/api';
import { cn } from '@/lib/utils';

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  activities?: CopilotActivity[];
}

const SUGGESTED_QUESTIONS = [
  'Doanh thu tháng này là bao nhiêu?',
  'Tháng này tôi chi nhiều nhất vào đâu?',
  'Có bao nhiêu giao dịch chờ xét duyệt?',
  'Đã liên kết ngân hàng chưa?',
  'Sao không thấy giao dịch từ Casso?',
];

function parseSseChunk(chunk: string): Array<{ event: string; data: string }> {
  const events: Array<{ event: string; data: string }> = [];
  const blocks = chunk.split('\n\n');
  for (const block of blocks) {
    const lines = block.split('\n');
    let event = 'message';
    let data = '';
    for (const line of lines) {
      if (line.startsWith('event: ')) event = line.slice(7).trim();
      else if (line.startsWith('data: ')) data = line.slice(6).trim();
    }
    if (data) events.push({ event, data });
  }
  return events;
}

export default function CopilotPage() {
  const [messages, setMessages] = useState<Message[]>([
    {
      id: 'init',
      role: 'assistant',
      content:
        'Xin chào! Tôi là **AI Copilot** của **X-Cash AI**. Bạn có thể hỏi tôi về **doanh thu**, **chi phí**, **giao dịch**, **định khoản** theo chuẩn **TT133** hoặc **liên kết ngân hàng** của doanh nghiệp.',
    },
  ]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [streamActivity, setStreamActivity] = useState<StreamActivity | undefined>();
  const [streamingContent, setStreamingContent] = useState('');
  const bottomRef = useRef<HTMLDivElement>(null);
  const abortRef = useRef<AbortController | null>(null);

  // biome-ignore lint/correctness/useExhaustiveDependencies: re-scroll when messages, loading, or streaming content changes
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isLoading, streamingContent]);

  const getHistory = (msgs: Message[]) =>
    msgs
      .filter((m) => m.id !== 'init')
      .slice(-10)
      .map(({ role, content }) => ({ role, content }));

  const sendViaStream = async (text: string, msgs: Message[]) => {
    const token = getAccessToken();
    abortRef.current = new AbortController();

    try {
      const response = await fetch(`${API_BASE_URL}/ai/copilot/stream`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({ message: text, history: getHistory(msgs) }),
        signal: abortRef.current.signal,
      });

      if (!response.ok || !response.body) throw new Error('stream failed');

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let accumulated = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const chunk = decoder.decode(value, { stream: true });
        const parsed = parseSseChunk(chunk);

        for (const { event, data } of parsed) {
          if (event === 'activity') {
            const act = JSON.parse(data) as StreamActivity;
            setStreamActivity(act);
          } else if (event === 'delta') {
            const { content } = JSON.parse(data) as { content: string };
            accumulated += content;
            setStreamingContent(accumulated);
          } else if (event === 'done') {
            const { reply, meta } = JSON.parse(data) as {
              reply: string;
              meta?: { activities: CopilotActivity[] };
            };
            setStreamingContent('');
            setStreamActivity(undefined);
            setMessages((prev) => [
              ...prev,
              {
                id: `a-${Date.now()}`,
                role: 'assistant',
                content: reply,
                activities: meta?.activities ?? [],
              },
            ]);
          }
        }
      }
    } catch (err) {
      if ((err as Error).name === 'AbortError') return;
      throw err;
    }
  };

  const sendViaJson = async (text: string, msgs: Message[]) => {
    const res = await api.post<{
      data: { reply: string; meta?: { activities: CopilotActivity[] } };
    }>('/ai/copilot', {
      message: text,
      history: getHistory(msgs),
    });
    const { reply, meta } = res.data.data;
    setMessages((prev) => [
      ...prev,
      {
        id: `a-${Date.now()}`,
        role: 'assistant',
        content: reply,
        activities: meta?.activities ?? [],
      },
    ]);
  };

  const sendMessage = async (text: string) => {
    if (!text.trim() || isLoading) return;

    const userMsg: Message = { id: `u-${Date.now()}`, role: 'user', content: text };
    const prevMessages = messages;
    setMessages((prev) => [...prev, userMsg]);
    setInput('');
    setIsLoading(true);
    setStreamActivity(undefined);
    setStreamingContent('');

    try {
      await sendViaStream(text, [...prevMessages, userMsg]);
    } catch {
      try {
        await sendViaJson(text, [...prevMessages, userMsg]);
      } catch {
        setMessages((prev) => [
          ...prev,
          {
            id: `err-${Date.now()}`,
            role: 'assistant',
            content: 'Xin lỗi, có lỗi xảy ra. Vui lòng thử lại.',
          },
        ]);
      }
    } finally {
      setIsLoading(false);
      setStreamActivity(undefined);
      setStreamingContent('');
    }
  };

  return (
    <div className="flex h-full flex-col">
      <Header
        title="AI Copilot"
        description="Hỏi đáp tài chính bằng ngôn ngữ tự nhiên"
        className="relative"
      />

      <PlanGate minPlan={SubscriptionPlan.STARTER} featureName="AI Copilot">
        <div
          className="flex-1 overflow-y-auto px-6 py-4 space-y-4"
          role="log"
          aria-live="polite"
          aria-relevant="additions"
          aria-label="Lịch sử hội thoại AI Copilot"
        >
          {messages.map((msg) => (
            <div
              key={msg.id}
              className={cn(
                'flex gap-3 max-w-[calc(100%-3rem)]',
                msg.role === 'user' && 'ml-auto flex-row-reverse',
              )}
            >
              <div
                className={cn(
                  'flex size-8 shrink-0 items-center justify-center rounded-full',
                  msg.role === 'assistant'
                    ? 'bg-primary text-primary-foreground'
                    : 'bg-muted text-muted-foreground',
                )}
              >
                {msg.role === 'assistant' ? (
                  <Bot className="size-4" />
                ) : (
                  <User className="size-4" />
                )}
              </div>
              <div
                className={cn(
                  'rounded-2xl px-4 py-3 text-sm whitespace-pre-wrap',
                  msg.role === 'assistant'
                    ? 'rounded-tl-none border border-border bg-background'
                    : 'bg-primary text-primary-foreground rounded-tr-none',
                )}
              >
                {msg.role === 'assistant' ? (
                  <>
                    <HighlightedText text={msg.content} />
                    {msg.activities && msg.activities.length > 0 && (
                      <CopilotSourceChips activities={msg.activities} />
                    )}
                  </>
                ) : (
                  msg.content
                )}
              </div>
            </div>
          ))}

          {/* Streaming bubble — hiện khi đang nhận delta từ SSE */}
          {isLoading && streamingContent && (
            <div className="flex gap-3 max-w-[calc(100%-3rem)]">
              <div className="flex size-8 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground">
                <Bot className="size-4" />
              </div>
              <div className="rounded-2xl rounded-tl-none border border-border bg-background px-4 py-3 text-sm whitespace-pre-wrap">
                <HighlightedText text={streamingContent} />
              </div>
            </div>
          )}

          {/* Loading indicator — dots hoặc activity status */}
          {isLoading && !streamingContent && (
            <div className="flex gap-3 max-w-[calc(100%-3rem)]">
              <div className="flex size-8 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground">
                <Bot className="size-4" />
              </div>
              <div className="rounded-2xl rounded-tl-none border border-border bg-background px-4 py-3">
                <CopilotLoadingStatus activity={streamActivity} />
              </div>
            </div>
          )}

          <div ref={bottomRef} />
        </div>

        <div className="border-t px-6 py-3 space-y-3">
          <div className="flex gap-2 overflow-x-auto pb-1">
            {SUGGESTED_QUESTIONS.map((q) => (
              <button
                key={q}
                type="button"
                onClick={() => sendMessage(q)}
                disabled={isLoading}
                className="whitespace-nowrap text-xs px-3 py-1.5 rounded-full border border-primary/20 bg-primary/10 text-primary font-medium hover:bg-primary/20 transition-colors shrink-0 disabled:opacity-50"
              >
                {q}
              </button>
            ))}
          </div>
          <div className="flex gap-2">
            <Input
              placeholder="Nhập câu hỏi..."
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && sendMessage(input)}
              disabled={isLoading}
            />
            <Button onClick={() => sendMessage(input)} disabled={isLoading || !input.trim()}>
              <Send className="size-4" />
            </Button>
          </div>
        </div>
      </PlanGate>
    </div>
  );
}
