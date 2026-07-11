import { EventEmitter } from 'node:events';
import type { LlmAdapter, LlmMessage, LlmTool, LlmUsage } from './llm-adapter.interface';
import { shouldFallbackProvider } from './utils/llm-error.util';
import { ToolCallAccumulator } from './utils/tool-call-accumulator.util';

export type ToolExecutor = (name: string, args: Record<string, unknown>) => Promise<unknown>;

function mergeUsage(a: LlmUsage | undefined, b: LlmUsage | undefined): LlmUsage | undefined {
  if (!a) return b;
  if (!b) return a;
  return {
    prompt_tokens: a.prompt_tokens + b.prompt_tokens,
    completion_tokens: a.completion_tokens + b.completion_tokens,
    total_tokens: a.total_tokens + b.total_tokens,
  };
}

/**
 * Harness cố định: agent loop (gọi LLM → tool_calls → thực thi → lặp lại) +
 * fallback giữa các adapter khi lỗi thuộc nhóm nên chuyển provider.
 * Không biết gì về provider cụ thể — chỉ phụ thuộc LlmAdapter interface.
 */
export interface UsedAdapterInfo {
  /** Tên adapter thực sự trả lời (undefined nếu tất cả đều lỗi). */
  name: string | undefined;
  /** true nếu adapter trả lời KHÔNG phải adapter đầu tiên (đã fallback). */
  fallback: boolean;
}

export class CopilotAgentHarness extends EventEmitter {
  private aborted = false;
  private usage: LlmUsage | undefined;
  private usedAdapterName: string | undefined;
  private fallbackOccurred = false;
  /** Dedupe tool call trùng lặp (cùng name+args) trong cùng 1 request — chỉ cache kết quả thành công. */
  private readonly toolResultCache = new Map<string, unknown>();
  private readonly runPromise: Promise<string>;

  constructor(
    private readonly adapters: LlmAdapter[],
    systemPrompt: string,
    history: LlmMessage[],
    userMessage: string,
    private readonly tools: LlmTool[],
    private readonly executeTool: ToolExecutor,
    private readonly maxIterations = 5,
  ) {
    super();
    if (adapters.length === 0) {
      throw new Error('CopilotAgentHarness cần ít nhất 1 LlmAdapter');
    }
    const initialMessages: LlmMessage[] = [
      { role: 'system', content: systemPrompt },
      ...history,
      { role: 'user', content: userMessage },
    ];
    this.runPromise = this.run(initialMessages);
  }

  abort(): void {
    this.aborted = true;
  }

  async finalContent(): Promise<string> {
    return this.runPromise;
  }

  async totalUsage(): Promise<LlmUsage | undefined> {
    await this.runPromise.catch(() => undefined);
    return this.usage;
  }

  /** Adapter nào thực sự trả lời — dùng để cảnh báo user khi câu trả lời đến từ fallback provider. */
  async usedAdapterInfo(): Promise<UsedAdapterInfo> {
    await this.runPromise.catch(() => undefined);
    return { name: this.usedAdapterName, fallback: this.fallbackOccurred };
  }

  private async run(messages: LlmMessage[]): Promise<string> {
    let lastError: unknown;
    for (let i = 0; i < this.adapters.length; i++) {
      const adapter = this.adapters[i];
      try {
        const content = await this.runWithAdapter(adapter, messages);
        this.usedAdapterName = adapter.name;
        this.fallbackOccurred = i > 0;
        return content;
      } catch (err) {
        lastError = err;
        if (!shouldFallbackProvider(err)) throw err;
      }
    }
    throw lastError instanceof Error ? lastError : new Error('Tất cả LLM adapter đều lỗi');
  }

  private async runWithAdapter(adapter: LlmAdapter, messages: LlmMessage[]): Promise<string> {
    for (let iteration = 0; iteration < this.maxIterations; iteration++) {
      if (this.aborted) return '';

      const acc = new ToolCallAccumulator();
      for await (const chunk of adapter.streamChatCompletion(messages, this.tools)) {
        if (this.aborted) return '';
        acc.push(chunk);
        const delta = chunk.choices[0]?.delta?.content;
        if (delta) this.emit('content', delta);
      }

      const result = acc.result();
      this.usage = mergeUsage(this.usage, result.usage);

      if (result.toolCalls.length === 0) {
        return result.content;
      }

      messages.push({
        role: 'assistant',
        content: result.content || null,
        tool_calls: result.toolCalls,
      });

      for (const call of result.toolCalls) {
        this.emit('functionToolCall', { name: call.function.name });
        const argsRaw = call.function.arguments || '{}';
        const cacheKey = `${call.function.name}:${argsRaw}`;

        let output: unknown;
        if (this.toolResultCache.has(cacheKey)) {
          output = this.toolResultCache.get(cacheKey);
        } else {
          try {
            const args = JSON.parse(argsRaw) as Record<string, unknown>;
            output = await this.executeTool(call.function.name, args);
            this.toolResultCache.set(cacheKey, output);
          } catch (err) {
            output = { error: err instanceof Error ? err.message : String(err) };
          }
        }
        messages.push({
          role: 'tool',
          tool_call_id: call.id,
          content: JSON.stringify(output),
        });
      }
    }

    // Chạm giới hạn vòng lặp mà model vẫn muốn gọi tool tiếp — ép 1 lượt cuối
    // KHÔNG kèm tools để buộc model tổng hợp câu trả lời từ dữ liệu tool đã
    // thu thập được, thay vì vứt bỏ toàn bộ và trả rỗng.
    if (this.aborted) return '';

    const acc = new ToolCallAccumulator();
    for await (const chunk of adapter.streamChatCompletion(messages, [])) {
      if (this.aborted) return '';
      acc.push(chunk);
      const delta = chunk.choices[0]?.delta?.content;
      if (delta) this.emit('content', delta);
    }
    const result = acc.result();
    this.usage = mergeUsage(this.usage, result.usage);
    return result.content;
  }
}
