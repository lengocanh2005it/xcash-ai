export interface LlmToolDefinition {
  name: string;
  description: string;
  parameters: Record<string, unknown>;
}

export interface LlmMessage {
  role: 'system' | 'user' | 'assistant' | 'tool';
  content: string;
  toolCallId?: string;
  toolCalls?: LlmToolCall[];
}

export interface LlmToolCall {
  id: string;
  name: string;
  arguments: string;
}

export interface LlmChatResult {
  text?: string;
  toolCalls?: LlmToolCall[];
  usage?: { promptTokens: number; completionTokens: number };
  model: string;
}

export interface LlmProviderAdapter {
  readonly providerName: string;

  isAvailable(): boolean;
  getDefaultModel(): string;

  chat(params: {
    model: string;
    messages: LlmMessage[];
    tools?: LlmToolDefinition[];
    toolChoice?: 'auto' | 'none';
    temperature?: number;
    maxTokens?: number;
  }): Promise<LlmChatResult>;

  isQuotaOrBillingError(error: unknown): boolean;
  isRetryableError(error: unknown): boolean;
}
