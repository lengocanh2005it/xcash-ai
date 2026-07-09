import { SubscriptionPlan } from '@xcash/shared-types';
import { Bot, Menu, PanelLeftClose, PanelLeftOpen } from 'lucide-react';
import { CopilotChatInput } from '@/components/copilot/CopilotChatInput';
import { CopilotLoadingStatus } from '@/components/copilot/CopilotLoadingStatus';
import { CopilotMessageBubble } from '@/components/copilot/CopilotMessageBubble';
import { CopilotSidebar } from '@/components/copilot/CopilotSidebar';
import { CopilotWelcomeState } from '@/components/copilot/CopilotWelcomeState';
import { ConfirmDialog } from '@/components/shared/ConfirmDialog';
import { HighlightedText } from '@/components/shared/HighlightedText';
import { PlanGate } from '@/components/shared/PlanGate';
import { ThemeToggle } from '@/components/shared/ThemeToggle';
import { Button } from '@/components/ui/button';
import { Sheet, SheetContent } from '@/components/ui/sheet';
import { Skeleton } from '@/components/ui/skeleton';
import { useCopilotPage } from '@/hooks/useCopilotPage';
import { cn } from '@/lib/utils';

export default function CopilotPage() {
  const {
    user,
    messages,
    input,
    setInput,
    isLoadingConversation,
    isLoadingOlder,
    sidebarOpen,
    setSidebarOpen,
    pendingDelete,
    setPendingDelete,
    isDeletingConversation,
    historyCollapsed,
    toggleHistoryCollapsed,
    activeConversationId,
    isWelcome,
    isLoading,
    canAbort,
    streamActivity,
    streamingContent,
    bottomRef,
    chatContainerRef,
    sentinelRef,
    sendMessage,
    handleStop,
    handleNewChat,
    handleSelectConversation,
    confirmDeleteConversation,
  } = useCopilotPage();

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
                  {isWelcome && <CopilotWelcomeState onSendMessage={sendMessage} />}

                  {!isWelcome && (
                    <div className="mx-auto w-full max-w-3xl px-4 py-6 flex flex-col gap-6">
                      <div ref={sentinelRef} className="h-1" />

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
