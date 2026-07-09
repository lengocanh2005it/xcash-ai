import type { CopilotConversationSummary } from '@xcash/shared-types';
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { useAuthContext } from '@/contexts/auth-context';
import { type Message, useCopilotChat } from '@/hooks/useCopilotChat';
import { useCopilotConversations } from '@/hooks/useCopilotConversations';
import { useSidebarCollapsed } from '@/hooks/useSidebarCollapsed';

function mapDto(m: {
  id: string;
  role: string;
  content: string;
  activities?: unknown[];
  isPartial?: boolean;
}) {
  return {
    id: m.id,
    role: m.role as 'user' | 'assistant',
    content: m.content,
    activities: m.activities as
      | import('@/components/copilot/CopilotSourceChips').CopilotActivity[]
      | undefined,
    isPartial: m.isPartial,
  };
}

export function useCopilotPage() {
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

  const persistConversation = (id: string | null) => {
    if (!user?.id) return;
    if (id) localStorage.setItem(`xcash_copilot_conv_${user.id}`, id);
    else localStorage.removeItem(`xcash_copilot_conv_${user.id}`);
  };

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

  useLayoutEffect(() => {
    if (justPrepended && chatContainerRef.current) {
      const newScrollHeight = chatContainerRef.current.scrollHeight;
      chatContainerRef.current.scrollTop = newScrollHeight - prevScrollHeightRef.current;
      setJustPrepended(false);
    }
  }, [justPrepended, messages]);

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

  return {
    user,
    messages,
    input,
    setInput,
    isLoadingConversation,
    isLoadingOlder,
    hasMoreMessages,
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
    invalidateList,
  };
}
