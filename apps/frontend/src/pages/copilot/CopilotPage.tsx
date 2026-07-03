import { SubscriptionPlan } from '@xcash/shared-types';
import { Bot, Send, User } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { Header } from '@/components/layout/Header';
import { HighlightedText } from '@/components/shared/HighlightedText';
import { PlanGate } from '@/components/shared/PlanGate';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { api } from '@/lib/api';
import { cn } from '@/lib/utils';

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
}

const SUGGESTED_QUESTIONS = [
  'Tháng này tôi chi nhiều nhất vào đâu?',
  'Doanh thu tháng này là bao nhiêu?',
  'Có bao nhiêu giao dịch chờ xét duyệt?',
  'Lãi/lỗ tháng này như thế nào?',
];

export default function CopilotPage() {
  const [messages, setMessages] = useState<Message[]>([
    {
      id: 'init',
      role: 'assistant',
      content:
        'Xin chào! Tôi là **AI Copilot** của **X-Cash AI**. Bạn có thể hỏi tôi về **doanh thu**, **chi phí**, **giao dịch** hoặc **định khoản** theo chuẩn **TT133** của doanh nghiệp.',
    },
  ]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, []);

  const sendMessage = async (text: string) => {
    if (!text.trim() || isLoading) return;

    const userMsg: Message = { id: `u-${Date.now()}`, role: 'user', content: text };
    const history = messages.filter((m) => m.role !== 'assistant' || m.id !== 'init');
    setMessages((prev) => [...prev, userMsg]);
    setInput('');
    setIsLoading(true);

    try {
      const res = await api.post<{ data: { reply: string } }>('/ai/copilot', {
        message: text,
        history: history.slice(-10).map(({ role, content }) => ({ role, content })),
      });
      setMessages((prev) => [
        ...prev,
        { id: `a-${Date.now()}`, role: 'assistant', content: res.data.data.reply },
      ]);
    } catch {
      setMessages((prev) => [
        ...prev,
        {
          id: `err-${Date.now()}`,
          role: 'assistant',
          content: 'Xin lỗi, có lỗi xảy ra. Vui lòng thử lại.',
        },
      ]);
    } finally {
      setIsLoading(false);
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
        <div className="flex-1 overflow-y-auto px-6 py-4 space-y-4">
          {messages.map((msg) => (
            <div
              key={msg.id}
              className={cn(
                'flex gap-3 max-w-[80%]',
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
                {msg.role === 'assistant' ? <HighlightedText text={msg.content} /> : msg.content}
              </div>
            </div>
          ))}

          {isLoading && (
            <div className="flex gap-3 max-w-[80%]">
              <div className="flex size-8 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground">
                <Bot className="size-4" />
              </div>
              <div className="rounded-2xl rounded-tl-none border border-border bg-background px-4 py-3">
                <div className="flex gap-1 items-center h-4">
                  <span className="size-2 bg-muted-foreground/50 rounded-full animate-bounce [animation-delay:0ms]" />
                  <span className="size-2 bg-muted-foreground/50 rounded-full animate-bounce [animation-delay:150ms]" />
                  <span className="size-2 bg-muted-foreground/50 rounded-full animate-bounce [animation-delay:300ms]" />
                </div>
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
