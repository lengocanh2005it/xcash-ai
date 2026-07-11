export interface CopilotConfirmActionCardData {
  tool: 'propose_confirm_transaction_classification';
  transactionId: string;
  classificationId: string;
  debitAccount: string;
  creditAccount: string;
  confidence: number;
  status: string;
  content: string;
  amount: number;
  canConfirm: boolean;
  reason?: string;
}

export interface CopilotCorrectActionCardData {
  tool: 'propose_correct_transaction_classification';
  transactionId: string;
  classificationId: string;
  debitAccount: string;
  creditAccount: string;
  proposedDebitAccount: string;
  proposedCreditAccount: string;
  confidence: number;
  status: string;
  content: string;
  amount: number;
  canCorrect: boolean;
  reason?: string;
}

export type CopilotActionCardData = CopilotConfirmActionCardData | CopilotCorrectActionCardData;

export interface CopilotActivity {
  kind: 'internal_data' | 'knowledge' | 'web_search' | 'action_card';
  label: string;
  source?: string;
  urls?: string[];
  snippet?: string;
  actionCard?: CopilotActionCardData;
}

export interface CopilotConversationSummary {
  id: string;
  title: string;
  createdAt: string;
  updatedAt: string;
  messageCount: number;
  lastMessage?: string;
}

export interface CopilotMessageDto {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  activities?: CopilotActivity[];
  createdAt: string;
  isPartial: boolean;
}

export interface CopilotConversationDetail {
  id: string;
  title: string;
  createdAt: string;
  updatedAt: string;
  messages: CopilotMessageDto[];
  hasMore: boolean;
  oldestMessageId: string | null;
}

export interface CopilotConversationsListResponse {
  items: CopilotConversationSummary[];
  hasMore: boolean;
  cursorNext: string | null;
  /** Offset pagination (Settings history tab) */
  total?: number;
  page?: number;
  limit?: number;
  totalPages?: number;
}
