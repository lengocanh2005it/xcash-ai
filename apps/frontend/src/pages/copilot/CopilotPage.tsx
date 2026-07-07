import type { CopilotConversationSummary, CopilotMessageDto } from '@xcash/shared-types';
import { SubscriptionPlan } from '@xcash/shared-types';
import {
  BarChart2,
  BookOpen,
  Bot,
  Building2,
  ClipboardList,
  HelpCircle,
  Loader2,
  Menu,
  PanelLeftClose,
  PanelLeftOpen,
  Send,
  Square,
  StopCircle,
  TrendingUp,
} from 'lucide-react';
import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import type { StreamActivity } from '@/components/copilot/CopilotLoadingStatus';
import { CopilotLoadingStatus } from '@/components/copilot/CopilotLoadingStatus';
import { CopilotMessageActions } from '@/components/copilot/CopilotMessageActions';
import { CopilotSidebar } from '@/components/copilot/CopilotSidebar';
import type { CopilotActivity } from '@/components/copilot/CopilotSourceChips';
import { CopilotSourceChips } from '@/components/copilot/CopilotSourceChips';
import { ConfirmDialog } from '@/components/shared/ConfirmDialog';
import { HighlightedText } from '@/components/shared/HighlightedText';
import { PlanGate } from '@/components/shared/PlanGate';
import { ThemeToggle } from '@/components/shared/ThemeToggle';
import { Button } from '@/components/ui/button';
import { Sheet, SheetContent } from '@/components/ui/sheet';
import { Skeleton } from '@/components/ui/skeleton';
import { useAuthContext } from '@/contexts/auth-context';
import { useCopilotConversations } from '@/hooks/useCopilotConversations';
import { useSidebarCollapsed } from '@/hooks/useSidebarCollapsed';
import { API_BASE_URL, api, getAccessToken } from '@/lib/api';
import { cn } from '@/lib/utils';

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  activities?: CopilotActivity[];
  isPartial?: boolean;
}

function mapDto(m: CopilotMessageDto): Message {
  return {
    id: m.id,
    role: m.role,
    content: m.content,
    activities: m.activities as CopilotActivity[] | undefined,
    isPartial: m.isPartial,
  };
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
  const { user } = useAuthContext();
  const {
    invalidateList,
    loadConversation,
    loadOlderMessages,
    refreshListAfterChat,
    deleteConversation,
  } = useCopilotConversations(user?.id);

  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isLoadingConversation, setIsLoadingConversation] = useState(false);
  const [isLoadingOlder, setIsLoadingOlder] = useState(false);
  const [hasMoreMessages, setHasMoreMessages] = useState(false);
  const [oldestMessageId, setOldestMessageId] = useState<string | null>(null);
  const [streamActivity, setStreamActivity] = useState<StreamActivity | undefined>();
  const [streamingContent, setStreamingContent] = useState('');
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [pendingDelete, setPendingDelete] = useState<CopilotConversationSummary | null>(null);
  const [isDeletingConversation, setIsDeletingConversation] = useState(false);
  const [historyCollapsed, toggleHistoryCollapsed] = useSidebarCollapsed(
    'xcash_copilot_history_collapsed',
    true,
  );
  const [canAbort, setCanAbort] = useState(false);
  const [activeConversationId, setActiveConversationId] = useState<string | null>(() => {
    if (!user?.id) return null;
    return localStorage.getItem(`xcash_copilot_conv_${user.id}`) ?? null;
  });

  const bottomRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const abortRef = useRef<AbortController | null>(null);
  const chatContainerRef = useRef<HTMLDivElement>(null);
  const sentinelRef = useRef<HTMLDivElement>(null);
  const prevScrollHeightRef = useRef(0);
  const [justPrepended, setJustPrepended] = useState(false);

  const isWelcome = messages.length === 0 && !isLoading && !isLoadingConversation;

  // Persist active conversation ID to localStorage
  const persistConversation = (id: string | null) => {
    if (!user?.id) return;
    if (id) localStorage.setItem(`xcash_copilot_conv_${user.id}`, id);
    else localStorage.removeItem(`xcash_copilot_conv_${user.id}`);
  };

  // Load initial conversation from localStorage on mount
  // biome-ignore lint/correctness/useExhaustiveDependencies: run only on mount
  useEffect(() => {
    if (activeConversationId) {
      handleLoadConversation(activeConversationId);
    }
  }, []);

  async function handleLoadConversation(id: string, opts?: { showLoading?: boolean }) {
    const showLoading = opts?.showLoading ?? true;
    if (showLoading) setIsLoadingConversation(true);
    try {
      const conv = await loadConversation(id);
      setMessages(conv.messages.map(mapDto));
      setHasMoreMessages(conv.hasMore);
      setOldestMessageId(conv.oldestMessageId);
      setActiveConversationId(id);
      persistConversation(id);
      requestAnimationFrame(() => {
        if (chatContainerRef.current) {
          chatContainerRef.current.scrollTop = chatContainerRef.current.scrollHeight;
        }
      });
    } catch {
      setMessages([]);
      setActiveConversationId(null);
      persistConversation(null);
    } finally {
      if (showLoading) setIsLoadingConversation(false);
    }
  }

  async function handleLoadOlderMessages() {
    if (!hasMoreMessages || isLoadingOlder || !activeConversationId || !oldestMessageId) return;
    setIsLoadingOlder(true);
    try {
      if (chatContainerRef.current) {
        prevScrollHeightRef.current = chatContainerRef.current.scrollHeight;
      }
      const conv = await loadOlderMessages(activeConversationId, oldestMessageId);
      setMessages((prev) => [...conv.messages.map(mapDto), ...prev]);
      setHasMoreMessages(conv.hasMore);
      setOldestMessageId(conv.oldestMessageId);
      setJustPrepended(true);
    } finally {
      setIsLoadingOlder(false);
    }
  }

  // Restore scroll position after prepending older messages
  useLayoutEffect(() => {
    if (justPrepended && chatContainerRef.current) {
      const newScrollHeight = chatContainerRef.current.scrollHeight;
      chatContainerRef.current.scrollTop = newScrollHeight - prevScrollHeightRef.current;
      setJustPrepended(false);
    }
  }, [justPrepended, messages]);

  // IntersectionObserver for infinite scroll upward
  // biome-ignore lint/correctness/useExhaustiveDependencies: intentional deps
  useEffect(() => {
    if (!hasMoreMessages || !sentinelRef.current) return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting) {
          handleLoadOlderMessages();
        }
      },
      { threshold: 0.1 },
    );
    observer.observe(sentinelRef.current);
    return () => observer.disconnect();
  }, [hasMoreMessages, isLoadingOlder, activeConversationId, oldestMessageId]);

  // Scroll to bottom on new messages (not on prepend)
  // biome-ignore lint/correctness/useExhaustiveDependencies: scroll on new content
  useEffect(() => {
    if (!justPrepended && !isLoadingConversation) {
      bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages, isLoading, streamingContent, isLoadingConversation]);

  function autoResize() {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = `${Math.min(el.scrollHeight, 200)}px`;
  }

  const getHistory = (msgs: Message[], convId: string | null) => {
    const slice = msgs.slice(-10);
    const withoutPendingUser =
      !convId && slice.length > 0 && slice[slice.length - 1]?.role === 'user'
        ? slice.slice(0, -1)
        : slice;
    return withoutPendingUser.map(({ role, content }) => ({ role, content }));
  };

  // Returns conversationId on success, null on abort, throws on error
  const sendViaStream = async (
    text: string,
    msgs: Message[],
    convId: string | null,
  ): Promise<string | null> => {
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
        for (const evt of feedSseChunk(tail, pending)) handleSseEvent(evt);
      }
      for (const evt of flushSsePending(pending)) handleSseEvent(evt);

      if (!receivedDone) throw new Error('stream ended without done');
      return receivedConversationId;
    } catch (err) {
      if ((err as Error).name === 'AbortError') {
        // Save partial content as a "stopped" bubble
        if (accumulated.trim()) {
          setMessages((prev) => [
            ...prev,
            {
              id: `a-${Date.now()}`,
              role: 'assistant',
              content: accumulated,
              activities: [],
              isPartial: true,
            },
          ]);
        }
        setStreamingContent('');
        setStreamActivity(undefined);
        return null; // don't update conversationId, don't fallback to JSON
      }
      throw err;
    }
  };

  const sendViaJson = async (
    text: string,
    msgs: Message[],
    convId: string | null,
  ): Promise<string | null> => {
    const res = await api.post<{
      data: { reply: string; meta?: { activities: CopilotActivity[] }; conversationId?: string };
    }>('/ai/copilot', {
      message: text,
      history: getHistory(msgs, convId),
      ...(convId ? { conversationId: convId } : {}),
    });
    const { reply, meta, conversationId: newConvId } = res.data.data;
    setMessages((prev) => [
      ...prev,
      {
        id: `a-${Date.now()}`,
        role: 'assistant',
        content: reply,
        activities: meta?.activities ?? [],
      },
    ]);
    return newConvId ?? convId;
  };

  const sendMessage = async (text: string) => {
    if (!text.trim() || isLoading) return;
    const userMsg: Message = { id: `u-${Date.now()}`, role: 'user', content: text };
    const prevMessages = messages;
    setMessages((prev) => [...prev, userMsg]);
    setInput('');
    if (textareaRef.current) textareaRef.current.style.height = 'auto';
    setIsLoading(true);
    setStreamActivity(undefined);
    setStreamingContent('');

    const isNewConversation = !activeConversationId;

    let wasAborted = false;
    setCanAbort(true);
    try {
      const newConvId = await sendViaStream(text, [...prevMessages, userMsg], activeConversationId);
      if (newConvId === null) {
        wasAborted = true;
        return; // aborted — don't update conversation or invalidate
      }
      const convId = newConvId ?? activeConversationId;
      if (newConvId && newConvId !== activeConversationId) {
        setActiveConversationId(newConvId);
        persistConversation(newConvId);
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
        const newConvId = await sendViaJson(text, [...prevMessages, userMsg], activeConversationId);
        const convId = newConvId ?? activeConversationId;
        if (newConvId && newConvId !== activeConversationId) {
          setActiveConversationId(newConvId);
          persistConversation(newConvId);
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
      setCanAbort(false);
      if (!wasAborted) {
        setIsLoading(false);
        setStreamActivity(undefined);
        setStreamingContent('');
      } else {
        setIsLoading(false);
      }
    }
  };

  const handleStop = () => {
    abortRef.current?.abort();
  };

  const handleNewChat = () => {
    if (isLoading) abortRef.current?.abort();
    setMessages([]);
    setActiveConversationId(null);
    persistConversation(null);
    setHasMoreMessages(false);
    setOldestMessageId(null);
    setSidebarOpen(false);
  };

  const handleSelectConversation = (id: string) => {
    if (id === activeConversationId && !isLoadingConversation) return;
    if (isLoading) abortRef.current?.abort();
    setSidebarOpen(false);
    setIsLoadingConversation(true);
    setMessages([]);
    setHasMoreMessages(false);
    setOldestMessageId(null);
    void handleLoadConversation(id, { showLoading: false }).finally(() => {
      setIsLoadingConversation(false);
    });
  };

  const handleDeleteConversation = (id: string) => {
    if (id === activeConversationId) {
      setMessages([]);
      setActiveConversationId(null);
      persistConversation(null);
    }
  };

  const confirmDeleteConversation = async () => {
    if (!pendingDelete) return;
    setIsDeletingConversation(true);
    try {
      await deleteConversation(pendingDelete.id);
      handleDeleteConversation(pendingDelete.id);
      setPendingDelete(null);
    } finally {
      setIsDeletingConversation(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage(input);
    }
  };

  const sidebarContent = (
    <CopilotSidebar
      userId={user?.id}
      activeConversationId={activeConversationId}
      onSelectConversation={handleSelectConversation}
      onNewChat={handleNewChat}
      onRequestDelete={setPendingDelete}
    />
  );

  return (
    <div className="relative flex h-full min-h-0 flex-col overflow-hidden">
      <PlanGate minPlan={SubscriptionPlan.STARTER} featureName="AI Copilot">
        <div className="flex min-h-0 flex-1 overflow-hidden">
          {/* ── Desktop sidebar (md+) ── */}
          <aside
            className={cn(
              'hidden md:flex shrink-0 flex-col overflow-hidden border-border bg-background',
              'transition-[width,border-color] duration-300 ease-in-out',
              historyCollapsed ? 'w-0 border-r-0' : 'w-64 border-r border-sidebar-border/80',
            )}
            aria-hidden={historyCollapsed}
          >
            <div
              className={cn(
                'flex h-full min-h-0 w-64 min-w-64 flex-col overflow-hidden',
                'transition-opacity duration-300 ease-in-out',
                historyCollapsed ? 'pointer-events-none opacity-0' : 'opacity-100',
              )}
            >
              <div className="flex shrink-0 items-center justify-between border-b border-sidebar-border/80 px-3 py-2.5">
                <span className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                  Lịch sử chat
                </span>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon-sm"
                  className="text-muted-foreground"
                  onClick={toggleHistoryCollapsed}
                  aria-label="Thu gọn lịch sử chat"
                  title="Thu gọn lịch sử chat"
                >
                  <PanelLeftClose className="size-4" />
                </Button>
              </div>
              <div className="min-h-0 flex-1 overflow-hidden">{sidebarContent}</div>
            </div>
          </aside>

          {/* ── Mobile sidebar (Sheet) ── */}
          <Sheet open={sidebarOpen} onOpenChange={setSidebarOpen}>
            <SheetContent
              side="left"
              className="flex h-full w-64 min-h-0 flex-col gap-0 overflow-hidden border-sidebar-border/80 bg-background p-0"
            >
              <div className="min-h-0 flex-1 overflow-hidden">{sidebarContent}</div>
            </SheetContent>
          </Sheet>

          {/* ── Chat area ── */}
          <div className="relative flex min-h-0 flex-1 flex-col bg-background">
            {/* Desktop: nút mở lịch sử khi sidebar đã thu gọn */}
            {historyCollapsed && (
              <Button
                type="button"
                variant="outline"
                size="icon-sm"
                className="absolute top-3 left-3 z-10 hidden md:inline-flex text-muted-foreground shadow-sm"
                onClick={toggleHistoryCollapsed}
                aria-label="Mở lịch sử chat"
                title="Mở lịch sử chat"
              >
                <PanelLeftOpen className="size-4" />
              </Button>
            )}
            <ThemeToggle className="absolute top-3 right-4 z-10 hidden lg:inline-flex shadow-sm sm:right-5" />

            {/* Mobile header */}
            <div className="flex md:hidden items-center gap-2 border-b border-border px-4 py-2">
              <button
                type="button"
                onClick={() => setSidebarOpen(true)}
                className="flex size-8 items-center justify-center rounded-lg hover:bg-muted transition-colors"
                aria-label="Mở menu"
              >
                <Menu className="size-4" />
              </button>
              <span className="text-sm font-medium">AI Copilot</span>
            </div>

            {/* Messages area */}
            <div
              ref={chatContainerRef}
              className="relative flex-1 overflow-y-auto"
              role="log"
              aria-live="polite"
              aria-label="Lịch sử hội thoại AI Copilot"
              aria-busy={isLoadingConversation}
            >
              {isLoadingConversation ? (
                <div className="mx-auto flex min-h-full w-full max-w-3xl flex-col justify-center gap-6 px-4 py-8">
                  <div className="flex justify-end gap-3">
                    <Skeleton className="h-12 w-[55%] rounded-2xl rounded-tr-sm" />
                  </div>
                  <div className="flex gap-3">
                    <Skeleton className="size-8 shrink-0 rounded-full" />
                    <div className="flex-1 space-y-2">
                      <Skeleton className="h-20 w-full rounded-2xl rounded-tl-sm" />
                      <Skeleton className="h-3 w-2/5" />
                    </div>
                  </div>
                  <div className="flex justify-end gap-3">
                    <Skeleton className="h-10 w-[40%] rounded-2xl rounded-tr-sm" />
                  </div>
                </div>
              ) : (
                <>
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
                            Hỏi đáp tài chính bằng ngôn ngữ tự nhiên — doanh thu, chi phí, định
                            khoản TT133, liên kết ngân hàng.
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
                      {/* Sentinel for loading older messages */}
                      <div ref={sentinelRef} className="h-1" />

                      {/* Loading older indicator */}
                      {isLoadingOlder && (
                        <div className="flex flex-col gap-3">
                          {[1, 2].map((i) => (
                            <div key={i} className="flex gap-3">
                              <Skeleton className="size-7 rounded-full shrink-0" />
                              <div className="flex-1 space-y-2">
                                <Skeleton className="h-4 w-2/3" />
                                <Skeleton className="h-4 w-1/3" />
                              </div>
                            </div>
                          ))}
                        </div>
                      )}

                      {messages.map((msg) =>
                        msg.role === 'user' ? (
                          <div key={msg.id} className="flex justify-end">
                            <div className="max-w-[75%] rounded-2xl rounded-tr-none bg-muted px-4 py-3 text-sm">
                              {msg.content}
                            </div>
                          </div>
                        ) : (
                          <div key={msg.id} className="flex gap-3 group/msg">
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
                              {msg.isPartial && (
                                <span className="mt-1 inline-flex items-center gap-1 text-[11px] text-muted-foreground">
                                  <StopCircle className="size-3" />
                                  Đã dừng
                                </span>
                              )}
                              <div className="mt-1.5 flex opacity-100 md:opacity-0 md:group-hover/msg:opacity-100 transition-opacity">
                                <CopilotMessageActions content={msg.content} />
                              </div>
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

                      {/* Loading indicator (tool calls, no content yet) */}
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
                </>
              )}
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
                  {isLoading && canAbort ? (
                    <button
                      type="button"
                      onClick={handleStop}
                      className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-muted text-muted-foreground hover:bg-destructive/10 hover:text-destructive transition-colors"
                      aria-label="Dừng"
                    >
                      <Square className="size-3.5 fill-current" />
                    </button>
                  ) : isLoading ? (
                    <span
                      className="flex size-8 shrink-0 items-center justify-center"
                      role="status"
                      aria-label="Đang xử lý"
                    >
                      <Loader2 className="size-4 animate-spin text-muted-foreground" aria-hidden />
                    </span>
                  ) : (
                    <button
                      type="button"
                      onClick={() => sendMessage(input)}
                      disabled={!input.trim()}
                      className={cn(
                        'flex size-8 shrink-0 items-center justify-center rounded-lg transition-colors',
                        input.trim()
                          ? 'bg-primary text-primary-foreground hover:bg-primary/90'
                          : 'bg-muted text-muted-foreground cursor-not-allowed',
                      )}
                      aria-label="Gửi"
                    >
                      <Send className="size-4" />
                    </button>
                  )}
                </div>
                <p className="mt-1.5 text-center text-[11px] text-muted-foreground/60">
                  AI Copilot có thể mắc lỗi. Kiểm tra thông tin quan trọng trước khi sử dụng.
                </p>
              </div>
            </div>
          </div>
        </div>
      </PlanGate>

      <ConfirmDialog
        open={pendingDelete !== null}
        onOpenChange={(open) => !open && !isDeletingConversation && setPendingDelete(null)}
        title="Xóa cuộc trò chuyện?"
        description={
          pendingDelete
            ? `Cuộc chat "${pendingDelete.title}" và toàn bộ tin nhắn sẽ bị xóa vĩnh viễn. Hành động này không thể hoàn tác.`
            : ''
        }
        confirmLabel="Xóa"
        variant="destructive"
        loading={isDeletingConversation}
        onConfirm={() => void confirmDeleteConversation()}
      />
    </div>
  );
}
