import type { ChatCompletionChunk } from 'openai/resources/chat/completions';
import { CopilotAgentHarness } from './copilot-agent.harness';
import type { LlmAdapter, LlmMessage, LlmTool } from './llm-adapter.interface';

function contentChunk(text: string, finish: string | null = null): ChatCompletionChunk {
  return {
    id: 'c',
    object: 'chat.completion.chunk',
    created: 0,
    model: 'test',
    choices: [{ index: 0, delta: { content: text }, finish_reason: finish as never }],
  } as ChatCompletionChunk;
}

function toolCallChunk(
  id: string,
  name: string,
  args: string,
  toolCallIndex = 0,
): ChatCompletionChunk {
  return {
    id: 'c',
    object: 'chat.completion.chunk',
    created: 0,
    model: 'test',
    choices: [
      {
        index: 0,
        delta: { tool_calls: [{ index: toolCallIndex, id, function: { name, arguments: args } }] },
        finish_reason: null,
      },
    ],
  } as ChatCompletionChunk;
}

function doneChunk(finish: string): ChatCompletionChunk {
  return {
    id: 'c',
    object: 'chat.completion.chunk',
    created: 0,
    model: 'test',
    choices: [{ index: 0, delta: {}, finish_reason: finish as never }],
    usage: { prompt_tokens: 1, completion_tokens: 1, total_tokens: 2 },
  } as ChatCompletionChunk;
}

class FakeAdapter implements LlmAdapter {
  callCount = 0;

  constructor(
    readonly name: string,
    private readonly script: (callIndex: number) => ChatCompletionChunk[] | Error,
  ) {}

  async *streamChatCompletion(
    _messages: LlmMessage[],
    _tools: LlmTool[],
  ): AsyncIterable<ChatCompletionChunk> {
    const chunks = this.script(this.callCount++);
    if (chunks instanceof Error) throw chunks;
    for (const c of chunks) yield c;
  }
}

const quotaError = Object.assign(new Error('exceeded your current quota'), { status: 429 });

describe('CopilotAgentHarness', () => {
  it('returns final content when the first adapter answers without tool calls', async () => {
    const adapter = new FakeAdapter('primary', () => [
      contentChunk('Xin '),
      contentChunk('chào'),
      doneChunk('stop'),
    ]);
    const executeTool = jest.fn();

    const harness = new CopilotAgentHarness(
      [adapter],
      'system prompt',
      [],
      'hello',
      [],
      executeTool,
    );

    await expect(harness.finalContent()).resolves.toBe('Xin chào');
    expect(executeTool).not.toHaveBeenCalled();
  });

  it('falls back to the next adapter on a quota error', async () => {
    const primary = new FakeAdapter('primary', () => quotaError);
    const secondary = new FakeAdapter('secondary', () => [
      contentChunk('trả lời từ MiniMax'),
      doneChunk('stop'),
    ]);

    const harness = new CopilotAgentHarness(
      [primary, secondary],
      'system prompt',
      [],
      'hello',
      [],
      jest.fn(),
    );

    await expect(harness.finalContent()).resolves.toBe('trả lời từ MiniMax');
    expect(primary.callCount).toBe(1);
    expect(secondary.callCount).toBe(1);
  });

  it('does not fall back on a non-provider error', async () => {
    const boom = new Error('unexpected parsing failure');
    const primary = new FakeAdapter('primary', () => boom);
    const secondary = new FakeAdapter('secondary', () => [doneChunk('stop')]);

    const harness = new CopilotAgentHarness(
      [primary, secondary],
      'system prompt',
      [],
      'hello',
      [],
      jest.fn(),
    );

    await expect(harness.finalContent()).rejects.toThrow('unexpected parsing failure');
    expect(secondary.callCount).toBe(0);
  });

  it('executes a tool call and loops back with the result', async () => {
    const adapter = new FakeAdapter('primary', (callIndex) => {
      if (callIndex === 0) {
        return [
          toolCallChunk('call_1', 'get_month_summary', '{"year":2026,"month":7}'),
          doneChunk('tool_calls'),
        ];
      }
      return [contentChunk('Doanh thu tháng 7 là 100tr'), doneChunk('stop')];
    });
    const executeTool = jest.fn().mockResolvedValue({ revenue: 100_000_000 });
    const toolCalls: string[] = [];

    const harness = new CopilotAgentHarness(
      [adapter],
      'system prompt',
      [],
      'doanh thu tháng này',
      [],
      executeTool,
    );
    harness.on('functionToolCall', (call: { name: string }) => toolCalls.push(call.name));

    await expect(harness.finalContent()).resolves.toBe('Doanh thu tháng 7 là 100tr');
    expect(toolCalls).toEqual(['get_month_summary']);
    expect(executeTool).toHaveBeenCalledWith('get_month_summary', { year: 2026, month: 7 });
    expect(adapter.callCount).toBe(2);
  });

  it('dedupes a repeated tool call (same name+args) within the same request', async () => {
    const adapter = new FakeAdapter('primary', (callIndex) => {
      if (callIndex < 2) {
        return [
          toolCallChunk('call_dup', 'get_month_summary', '{"year":2026,"month":7}'),
          doneChunk('tool_calls'),
        ];
      }
      return [contentChunk('Doanh thu tháng 7 là 100tr'), doneChunk('stop')];
    });
    const executeTool = jest.fn().mockResolvedValue({ revenue: 100_000_000 });

    const harness = new CopilotAgentHarness(
      [adapter],
      'system prompt',
      [],
      'doanh thu tháng này, chắc chắn lại lần nữa',
      [],
      executeTool,
    );

    await expect(harness.finalContent()).resolves.toBe('Doanh thu tháng 7 là 100tr');
    expect(executeTool).toHaveBeenCalledTimes(1);
  });

  it('does not dedupe tool calls with different args', async () => {
    const adapter = new FakeAdapter('primary', (callIndex) => {
      if (callIndex === 0) {
        return [
          toolCallChunk('call_a', 'get_month_summary', '{"year":2026,"month":6}', 0),
          toolCallChunk('call_b', 'get_month_summary', '{"year":2026,"month":7}', 1),
          doneChunk('tool_calls'),
        ];
      }
      return [contentChunk('So sánh 2 tháng'), doneChunk('stop')];
    });
    const executeTool = jest.fn().mockResolvedValue({ revenue: 1 });

    const harness = new CopilotAgentHarness(
      [adapter],
      'system prompt',
      [],
      'so sánh tháng 6 và tháng 7',
      [],
      executeTool,
    );

    await harness.finalContent();
    expect(executeTool).toHaveBeenCalledTimes(2);
  });

  it('forces one final no-tool call after maxIterations to summarize instead of returning empty', async () => {
    const adapter = new FakeAdapter('primary', (callIndex) => {
      if (callIndex < 2) {
        return [toolCallChunk('call_x', 'get_banking_status', '{}'), doneChunk('tool_calls')];
      }
      return [contentChunk('Tổng hợp: ngân hàng đã liên kết.'), doneChunk('stop')];
    });
    const executeTool = jest.fn().mockResolvedValue({ ok: true });
    const toolsSeenPerCall: number[] = [];
    const originalStream = adapter.streamChatCompletion.bind(adapter);
    adapter.streamChatCompletion = (messages, tools) => {
      toolsSeenPerCall.push(tools.length);
      return originalStream(messages, tools);
    };

    const harness = new CopilotAgentHarness(
      [adapter],
      'system prompt',
      [],
      'hello',
      [{ type: 'function', function: { name: 'get_banking_status', parameters: {} } }],
      executeTool,
      2,
    );

    await expect(harness.finalContent()).resolves.toBe('Tổng hợp: ngân hàng đã liên kết.');
    expect(adapter.callCount).toBe(3);
    // 2 vòng tool-calling truyền đủ tools, lượt cuối ép tổng hợp truyền tools rỗng
    expect(toolsSeenPerCall).toEqual([1, 1, 0]);
  });

  it('reports the primary adapter with fallback=false when it answers directly', async () => {
    const adapter = new FakeAdapter('openai', () => [contentChunk('ok'), doneChunk('stop')]);

    const harness = new CopilotAgentHarness([adapter], 'system prompt', [], 'hello', [], jest.fn());

    await expect(harness.usedAdapterInfo()).resolves.toEqual({ name: 'openai', fallback: false });
  });

  it('reports the secondary adapter with fallback=true after a quota fallback', async () => {
    const primary = new FakeAdapter('openai', () => quotaError);
    const secondary = new FakeAdapter('minimax', () => [contentChunk('ok'), doneChunk('stop')]);

    const harness = new CopilotAgentHarness(
      [primary, secondary],
      'system prompt',
      [],
      'hello',
      [],
      jest.fn(),
    );

    await expect(harness.usedAdapterInfo()).resolves.toEqual({ name: 'minimax', fallback: true });
  });

  it('reports name=undefined when every adapter fails', async () => {
    const primary = new FakeAdapter('openai', () => quotaError);
    const secondary = new FakeAdapter('minimax', () => quotaError);

    const harness = new CopilotAgentHarness(
      [primary, secondary],
      'system prompt',
      [],
      'hello',
      [],
      jest.fn(),
    );

    await expect(harness.usedAdapterInfo()).resolves.toEqual({
      name: undefined,
      fallback: false,
    });
  });

  it('emits content deltas as they stream', async () => {
    const adapter = new FakeAdapter('primary', () => [
      contentChunk('A'),
      contentChunk('B'),
      doneChunk('stop'),
    ]);
    const deltas: string[] = [];

    const harness = new CopilotAgentHarness([adapter], 'system prompt', [], 'hello', [], jest.fn());
    harness.on('content', (delta: string) => deltas.push(delta));

    await harness.finalContent();
    expect(deltas).toEqual(['A', 'B']);
  });

  it('emits functionToolCall in original order and executes independent tool calls concurrently', async () => {
    const executionOrder: string[] = [];
    const adapter = new FakeAdapter('primary', (callIndex) => {
      if (callIndex === 0) {
        return [
          toolCallChunk('call_a', 'get_banking_status', '{}', 0),
          toolCallChunk('call_b', 'get_month_summary', '{"year":2026,"month":7}', 1),
          doneChunk('tool_calls'),
        ];
      }
      return [contentChunk('Tổng hợp xong'), doneChunk('stop')];
    });

    const executeTool = jest.fn(async (name: string) => {
      if (name === 'get_banking_status') {
        // tool chậm hơn nhưng được gọi TRƯỚC trong tool_calls — nếu chạy tuần tự,
        // get_month_summary phải đợi tool này xong mới bắt đầu.
        await new Promise((resolve) => setTimeout(resolve, 20));
      }
      executionOrder.push(name);
      return { ok: true };
    });

    const toolCallEvents: string[] = [];
    const harness = new CopilotAgentHarness(
      [adapter],
      'system prompt',
      [],
      'trạng thái ngân hàng và doanh thu tháng này',
      [],
      executeTool,
    );
    harness.on('functionToolCall', (call: { name: string }) => toolCallEvents.push(call.name));

    await expect(harness.finalContent()).resolves.toBe('Tổng hợp xong');

    // Event functionToolCall theo đúng thứ tự gốc trong tool_calls, không theo thứ tự hoàn thành.
    expect(toolCallEvents).toEqual(['get_banking_status', 'get_month_summary']);
    // get_month_summary (nhanh hơn) hoàn thành trước get_banking_status (chậm hơn, chạy song song)
    // — chứng minh 2 tool chạy đồng thời thay vì tuần tự.
    expect(executionOrder).toEqual(['get_month_summary', 'get_banking_status']);
  });

  it('isolates a failing tool call from succeeding ones in the same batch', async () => {
    const adapter = new FakeAdapter('primary', (callIndex) => {
      if (callIndex === 0) {
        return [
          toolCallChunk('call_a', 'get_banking_status', '{}', 0),
          toolCallChunk('call_b', 'get_month_summary', '{"year":2026,"month":7}', 1),
          doneChunk('tool_calls'),
        ];
      }
      return [contentChunk('Đã xử lý'), doneChunk('stop')];
    });

    const executeTool = jest.fn(async (name: string) => {
      if (name === 'get_banking_status') throw new Error('banking API timeout');
      return { revenue: 100 };
    });

    const harness = new CopilotAgentHarness(
      [adapter],
      'system prompt',
      [],
      'trạng thái ngân hàng và doanh thu tháng này',
      [],
      executeTool,
    );

    await expect(harness.finalContent()).resolves.toBe('Đã xử lý');
    expect(executeTool).toHaveBeenCalledTimes(2);
  });

  it('dedupes identical name+args tool calls within the same batch (not just across iterations)', async () => {
    const adapter = new FakeAdapter('primary', (callIndex) => {
      if (callIndex === 0) {
        return [
          toolCallChunk('call_a', 'get_month_summary', '{"year":2026,"month":7}', 0),
          toolCallChunk('call_b', 'get_month_summary', '{"year":2026,"month":7}', 1),
          doneChunk('tool_calls'),
        ];
      }
      return [contentChunk('OK'), doneChunk('stop')];
    });
    const executeTool = jest.fn().mockResolvedValue({ revenue: 1 });

    const harness = new CopilotAgentHarness(
      [adapter],
      'system prompt',
      [],
      'doanh thu tháng này (hỏi trùng trong 1 lượt)',
      [],
      executeTool,
    );

    await harness.finalContent();
    expect(executeTool).toHaveBeenCalledTimes(1);
  });

  describe('seededToolCall', () => {
    it('seeds a tool call before the first LLM turn and answers in one adapter call', async () => {
      const adapter = new FakeAdapter('primary', () => [
        contentChunk('Có 3 giao dịch chờ duyệt'),
        doneChunk('stop'),
      ]);
      const executeTool = jest.fn().mockResolvedValue({ count: 3 });
      const toolCalls: string[] = [];

      const harness = new CopilotAgentHarness(
        [adapter],
        'system prompt',
        [],
        'có bao nhiêu giao dịch chờ duyệt',
        [],
        executeTool,
        5,
        { name: 'get_review_queue_count', args: {} },
      );
      harness.on('functionToolCall', (call: { name: string }) => toolCalls.push(call.name));

      await expect(harness.finalContent()).resolves.toBe('Có 3 giao dịch chờ duyệt');
      expect(toolCalls).toEqual(['get_review_queue_count']);
      expect(executeTool).toHaveBeenCalledTimes(1);
      expect(executeTool).toHaveBeenCalledWith('get_review_queue_count', {});
      expect(adapter.callCount).toBe(1);
    });

    it('continues the loop when the LLM still requests another tool after seeding', async () => {
      const adapter = new FakeAdapter('primary', (callIndex) => {
        if (callIndex === 0) {
          return [toolCallChunk('call_extra', 'get_banking_status', '{}'), doneChunk('tool_calls')];
        }
        return [contentChunk('Đã bổ sung trạng thái NH'), doneChunk('stop')];
      });
      const executeTool = jest.fn(async (name: string) => {
        if (name === 'get_review_queue_count') return { count: 2 };
        return { linked: true };
      });
      const toolCalls: string[] = [];

      const harness = new CopilotAgentHarness(
        [adapter],
        'system prompt',
        [],
        'có bao nhiêu giao dịch chờ duyệt',
        [],
        executeTool,
        5,
        { name: 'get_review_queue_count', args: {} },
      );
      harness.on('functionToolCall', (call: { name: string }) => toolCalls.push(call.name));

      await expect(harness.finalContent()).resolves.toBe('Đã bổ sung trạng thái NH');
      expect(toolCalls).toEqual(['get_review_queue_count', 'get_banking_status']);
      expect(executeTool).toHaveBeenCalledWith('get_review_queue_count', {});
      expect(executeTool).toHaveBeenCalledWith('get_banking_status', {});
      expect(adapter.callCount).toBe(2);
    });

    it('surfaces seeded tool errors as tool messages without throwing', async () => {
      const adapter = new FakeAdapter('primary', () => [
        contentChunk('Không lấy được số liệu review'),
        doneChunk('stop'),
      ]);
      const executeTool = jest.fn().mockRejectedValue(new Error('db down'));

      const harness = new CopilotAgentHarness(
        [adapter],
        'system prompt',
        [],
        'có bao nhiêu giao dịch chờ duyệt',
        [],
        executeTool,
        5,
        { name: 'get_review_queue_count', args: {} },
      );

      await expect(harness.finalContent()).resolves.toBe('Không lấy được số liệu review');
      expect(executeTool).toHaveBeenCalledTimes(1);
      expect(adapter.callCount).toBe(1);
    });
  });
});
