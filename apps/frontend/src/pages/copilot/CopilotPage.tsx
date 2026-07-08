import type { CopilotConversationSummary, CopilotMessageDto } from '@xcash/shared-types';
import { SubscriptionPlan } from '@xcash/shared-types';
import { Bot, Menu, PanelLeftClose, PanelLeftOpen } from 'lucide-react';
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { CopilotChatInput } from '@/components/copilot/CopilotChatInput';
import { CopilotLoadingStatus } from '@/components/copilot/CopilotLoadingStatus';
import { CopilotMessageBubble } from '@/components/copilot/CopilotMessageBubble';
import { CopilotSidebar } from '@/components/copilot/CopilotSidebar';
import type { CopilotActivity } from '@/components/copilot/CopilotSourceChips';
import { CopilotWelcomeState } from '@/components/copilot/CopilotWelcomeState';
import { ConfirmDialog } from '@/components/shared/ConfirmDialog';
import { HighlightedText } from '@/components/shared/HighlightedText';
import { PlanGate } from '@/components/shared/PlanGate';
import { ThemeToggle } from '@/components/shared/ThemeToggle';
import { Button } from '@/components/ui/button';
import { Sheet, SheetContent } from '@/components/ui/sheet';
import { Skeleton } from '@/components/ui/skeleton';
import { useAuthContext } from '@/contexts/auth-context';
import { type Message, useCopilotChat } from '@/hooks/useCopilotChat';
import { useCopilotConversations } from '@/hooks/useCopilotConversations';
import { useSidebarCollapsed } from '@/hooks/useSidebarCollapsed';
import { cn } from '@/lib/utils';

function mapDto(m: CopilotMessageDto): Message {
  return {
    id: m.id,
    role: m.role,
    content: m.content,
    activities: m.activities as CopilotActivity[] | undefined,
    isPartial: m.isPartial,
  };
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
  const [isLoadingConversation, setIsLoadingConversation] = useState(false);
  const [isLoadingOlder, setIsLoadingOlder] = useState(false);
  const [hasMoreMessages, setHasMoreMessages] = useState(false);
  const [oldestMessageId, setOldestMessageId] = useState<string | null>(null);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [pendingDelete, setPendingDelete] = useState<CopilotConversationSummary | null>(null);
  const [isDeletingConversation, setIsDeletingConversation] = useState(false);
  const [historyCollapsed, toggleHistoryCollapsed] = useSidebarCollapsed(
    'xcash_copilot_history_collapsed',
    true,
  );
  const [activeConversationId, setActiveConversationId] = useState<string | null>(() => {
    if (!user?.id) return null;
    return localStorage.getItem(`xcash_copilot_conv_${user.id}`) ?? null;
  });

  const addMessage = useCallback((msg: Message) => {
    setMessages((prev) => [...prev, msg]);
  }, []);

  const {
    sendMessage: sendChatMessage,
    handleStop,
    isLoading,
    canAbort,
    streamActivity,
    streamingContent,
  } = useCopilotChat({
    activeConversationId,
    getMessages: () => messages,
    addMessage,
    onConversationCreated: (id) => {
      setActiveConversationId(id);
      persistConversation(id);
    },
    refreshListAfterChat,
    invalidateList,
  });

  const bottomRef = useRef<HTMLDivElement>(null);
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

  const sendMessage = async (text: string) => {
    setInput('');
    await sendChatMessage(text);
  };

  const handleNewChat = () => {
    if (isLoading) handleStop();
    setMessages([]);
    setActiveConversationId(null);
    persistConversation(null);
    setHasMoreMessages(false);
    setOldestMessageId(null);
    setSidebarOpen(false);
  };

  const handleSelectConversation = (id: string) => {
    if (id === activeConversationId && !isLoadingConversation) return;
    if (isLoading) handleStop();
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
                  {isWelcome && <CopilotWelcomeState onSendMessage={sendMessage} />}

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

                      {messages.map((msg) => (
                        <CopilotMessageBubble key={msg.id} msg={msg} />
                      ))}

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
            <CopilotChatInput
              input={input}
              onInputChange={setInput}
              onSend={sendMessage}
              onStop={handleStop}
              isLoading={isLoading}
              canAbort={canAbort}
              isWelcome={isWelcome}
            />
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
