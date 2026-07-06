import { SubscriptionPlan } from '@xcash/shared-types';
import {
  BarChart2,
  BookOpen,
  Bot,
  Building2,
  ClipboardList,
  HelpCircle,
  Send,
  TrendingUp,
} from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import type { StreamActivity } from '@/components/copilot/CopilotLoadingStatus';
import { CopilotLoadingStatus } from '@/components/copilot/CopilotLoadingStatus';
import type { CopilotActivity } from '@/components/copilot/CopilotSourceChips';
import { CopilotSourceChips } from '@/components/copilot/CopilotSourceChips';
import { HighlightedText } from '@/components/shared/HighlightedText';
import { PlanGate } from '@/components/shared/PlanGate';
import { ThemeToggle } from '@/components/shared/ThemeToggle';
import { API_BASE_URL, api, getAccessToken } from '@/lib/api';
import { cn } from '@/lib/utils';

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  activities?: CopilotActivity[];
}

const SUGGESTIONS = [
  { icon: TrendingUp, text: 'Doanh thu tháng này bao nhiêu?' },
  { icon: BarChart2, text: 'Tháng này chi nhiều nhất vào đâu?' },
  { icon: ClipboardList, text: 'Có bao nhiêu giao dịch chờ xét duyệt?' },
  { icon: Building2, text: 'Đã liên kết ngân hàng chưa?' },
  { icon: HelpCircle, text: 'Sao không thấy giao dịch từ Casso?' },
  { icon: BookOpen, text: 'TK 642 trong TT133 là gì?' },
];

type SseEvent = { event: string; data: string };

function parseSseBlock(block: string): SseEvent | null {
  const lines = block.split('\n');
  let event = 'message';
  let data = '';
  for (const line of lines) {
    if (line.startsWith('event: ')) event = line.slice(7).trim();
    else if (line.startsWith('data: ')) data = line.slice(6).trim();
  }
  return data ? { event, data } : null;
}

function feedSseChunk(chunk: string, pending: { buffer: string }): SseEvent[] {
  const text = pending.buffer + chunk;
  const segments = text.split('\n\n');
  const endsWithDelimiter = text.endsWith('\n\n');
  pending.buffer = endsWithDelimiter ? '' : (segments.pop() ?? '');
  const events: SseEvent[] = [];
  for (const block of segments) {
    const parsed = parseSseBlock(block);
    if (parsed) events.push(parsed);
  }
  return events;
}

function flushSsePending(pending: { buffer: string }): SseEvent[] {
  const block = pending.buffer.trim();
  pending.buffer = '';
  if (!block) return [];
  const parsed = parseSseBlock(block);
  return parsed ? [parsed] : [];
}

export default function CopilotPage() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [streamActivity, setStreamActivity] = useState<StreamActivity | undefined>();
  const [streamingContent, setStreamingContent] = useState('');
  const bottomRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const abortRef = useRef<AbortController | null>(null);

  const isWelcome = messages.length === 0 && !isLoading;

  // biome-ignore lint/correctness/useExhaustiveDependencies: scroll on new content
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isLoading, streamingContent]);

  function autoResize() {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = `${Math.min(el.scrollHeight, 200)}px`;
  }

  const getHistory = (msgs: Message[]) =>
    msgs.slice(-10).map(({ role, content }) => ({ role, content }));

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
      const pending = { buffer: '' };
      let accumulated = '';
      let receivedDone = false;

      const handleSseEvent = ({ event, data }: SseEvent) => {
        if (event === 'activity') {
          setStreamActivity(JSON.parse(data) as StreamActivity);
        } else if (event === 'delta') {
          accumulated += (JSON.parse(data) as { content: string }).content;
          setStreamingContent(accumulated);
        } else if (event === 'done') {
          receivedDone = true;
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
        for (const evt of feedSseChunk(tail, pending)) {
          handleSseEvent(evt);
        }
      }
      for (const evt of flushSsePending(pending)) {
        handleSseEvent(evt);
      }

      if (!receivedDone) throw new Error('stream ended without done');
    } catch (err) {
      if ((err as Error).name === 'AbortError') return;
      throw err;
    }
  };

  const sendViaJson = async (text: string, msgs: Message[]) => {
    const res = await api.post<{
      data: { reply: string; meta?: { activities: CopilotActivity[] } };
    }>('/ai/copilot', { message: text, history: getHistory(msgs) });
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
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
    }
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

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage(input);
    }
  };

  return (
    <div className="relative flex h-full flex-col">
      <div className="absolute top-3 right-4 z-20 sm:right-8">
        <ThemeToggle />
      </div>
      <PlanGate minPlan={SubscriptionPlan.STARTER} featureName="AI Copilot">
        <div className="relative flex min-h-0 flex-1 flex-col bg-background">
          {/* ── Chat area ── */}
          <div
            className="flex-1 overflow-y-auto"
            role="log"
            aria-live="polite"
            aria-label="Lịch sử hội thoại AI Copilot"
          >
            {/* Welcome state */}
            {isWelcome && (
              <div className="flex flex-col items-center justify-center min-h-full px-4 py-12 gap-8">
                <div className="flex flex-col items-center gap-3 text-center">
                  <div className="flex size-14 items-center justify-center rounded-2xl bg-primary text-primary-foreground shadow-md">
                    <Bot className="size-7" />
                  </div>
                  <div>
                    <h1 className="text-2xl font-semibold tracking-tight">AI Copilot</h1>
                    <p className="mt-1 text-sm text-muted-foreground max-w-sm">
                      Hỏi đáp tài chính bằng ngôn ngữ tự nhiên — doanh thu, chi phí, định khoản
                      TT133, liên kết ngân hàng.
                    </p>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-2 w-full max-w-xl">
                  {SUGGESTIONS.map(({ icon: Icon, text }) => (
                    <button
                      key={text}
                      type="button"
                      onClick={() => sendMessage(text)}
                      className="flex items-start gap-3 rounded-xl border border-border bg-muted/40 hover:bg-muted/70 px-4 py-3 text-left text-sm transition-colors group"
                    >
                      <Icon className="size-4 shrink-0 mt-0.5 text-muted-foreground group-hover:text-foreground transition-colors" />
                      <span className="text-muted-foreground group-hover:text-foreground transition-colors leading-snug">
                        {text}
                      </span>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Message list */}
            {!isWelcome && (
              <div className="mx-auto w-full max-w-3xl px-4 py-6 flex flex-col gap-6">
                {messages.map((msg) =>
                  msg.role === 'user' ? (
                    <div key={msg.id} className="flex justify-end">
                      <div className="max-w-[75%] rounded-2xl rounded-tr-none bg-muted px-4 py-3 text-sm">
                        {msg.content}
                      </div>
                    </div>
                  ) : (
                    <div key={msg.id} className="flex gap-3">
                      <div className="flex size-7 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground mt-0.5">
                        <Bot className="size-4" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="text-sm leading-relaxed whitespace-pre-wrap">
                          <HighlightedText text={msg.content} />
                        </div>
                        {msg.activities && msg.activities.length > 0 && (
                          <CopilotSourceChips activities={msg.activities} />
                        )}
                      </div>
                    </div>
                  ),
                )}

                {/* Streaming bubble */}
                {isLoading && streamingContent && (
                  <div className="flex gap-3">
                    <div className="flex size-7 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground mt-0.5">
                      <Bot className="size-4" />
                    </div>
                    <div className="flex-1 text-sm leading-relaxed whitespace-pre-wrap">
                      <HighlightedText text={streamingContent} />
                      <span className="inline-block w-0.5 h-4 bg-foreground/70 ml-0.5 animate-pulse align-middle" />
                    </div>
                  </div>
                )}

                {/* Loading indicator */}
                {isLoading && !streamingContent && (
                  <div className="flex gap-3">
                    <div className="flex size-7 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground mt-0.5">
                      <Bot className="size-4" />
                    </div>
                    <div className="pt-1">
                      <CopilotLoadingStatus activity={streamActivity} />
                    </div>
                  </div>
                )}

                <div ref={bottomRef} />
              </div>
            )}

            {isWelcome && <div ref={bottomRef} />}
          </div>

          {/* ── Input area ── */}
          <div className={cn('px-4 pb-4 pt-2', isWelcome && 'pb-8')}>
            <div className="mx-auto w-full max-w-3xl">
              <div className="relative flex items-center gap-2 rounded-2xl border border-border bg-background shadow-sm px-4 py-3 focus-within:ring-2 focus-within:ring-ring focus-within:ring-offset-0 transition-shadow">
                <textarea
                  ref={textareaRef}
                  rows={1}
                  placeholder="Nhắn tin với AI Copilot... (Enter gửi, Shift+Enter xuống dòng)"
                  value={input}
                  onChange={(e) => {
                    setInput(e.target.value);
                    autoResize();
                  }}
                  onKeyDown={handleKeyDown}
                  disabled={isLoading}
                  className="flex-1 resize-none bg-transparent text-sm outline-none placeholder:text-muted-foreground disabled:opacity-50 max-h-[200px] leading-relaxed"
                />
                <button
                  type="button"
                  onClick={() => sendMessage(input)}
                  disabled={isLoading || !input.trim()}
                  className={cn(
                    'flex size-8 shrink-0 items-center justify-center rounded-lg transition-colors',
                    input.trim() && !isLoading
                      ? 'bg-primary text-primary-foreground hover:bg-primary/90'
                      : 'bg-muted text-muted-foreground cursor-not-allowed',
                  )}
                  aria-label="Gửi"
                >
                  <Send className="size-4" />
                </button>
              </div>
              <p className="mt-1.5 text-center text-[11px] text-muted-foreground/60">
                AI Copilot có thể mắc lỗi. Kiểm tra thông tin quan trọng trước khi sử dụng.
              </p>
            </div>
          </div>
        </div>
      </PlanGate>
    </div>
  );
}
