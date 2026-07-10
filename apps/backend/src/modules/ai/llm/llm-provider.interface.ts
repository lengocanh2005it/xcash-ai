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

/** Streaming chunk yielded during chatStream(). */
export interface LlmStreamChunk {
  /** Incremental text delta (may be empty on tool-call-only chunks). */
  delta?: string;
  /** Tool calls detected in this chunk (only on final chunk for streaming responses). */
  toolCalls?: LlmToolCall[];
  /** Token usage — present only on the final chunk. */
  usage?: { promptTokens: number; completionTokens: number };
  /** Model identifier. */
  model: string;
  /** True when the stream is complete. */
  done: boolean;
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

  /**
   * Streaming variant of chat(). Yields incremental chunks.
   * Default implementation falls back to non-streaming chat().
   */
  chatStream?(params: {
    model: string;
    messages: LlmMessage[];
    tools?: LlmToolDefinition[];
    toolChoice?: 'auto' | 'none';
    temperature?: number;
    maxTokens?: number;
    signal?: AbortSignal;
  }): AsyncGenerator<LlmStreamChunk>;

  isQuotaOrBillingError(error: unknown): boolean;
  isRetryableError(error: unknown): boolean;
}
