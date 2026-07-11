import type { ChatCompletionChunk } from 'openai/resources/chat/completions';
import { ToolCallAccumulator } from './tool-call-accumulator.util';

function chunk(partial: Partial<ChatCompletionChunk>): ChatCompletionChunk {
  return {
    id: 'chunk',
    object: 'chat.completion.chunk',
    created: 0,
    model: 'test-model',
    choices: [],
    ...partial,
  } as ChatCompletionChunk;
}

describe('ToolCallAccumulator', () => {
  it('accumulates plain content deltas', () => {
    const acc = new ToolCallAccumulator();
    acc.push(chunk({ choices: [{ index: 0, delta: { content: 'Xin ' }, finish_reason: null }] }));
    acc.push(chunk({ choices: [{ index: 0, delta: { content: 'chào' }, finish_reason: null }] }));
    acc.push(chunk({ choices: [{ index: 0, delta: {}, finish_reason: 'stop' }] }));

    const result = acc.result();
    expect(result.content).toBe('Xin chào');
    expect(result.toolCalls).toEqual([]);
    expect(result.finishReason).toBe('stop');
  });

  it('assembles a single tool call split across fragments', () => {
    const acc = new ToolCallAccumulator();
    acc.push(
      chunk({
        choices: [
          {
            index: 0,
            delta: {
              tool_calls: [
                { index: 0, id: 'call_1', function: { name: 'get_month_summary', arguments: '' } },
              ],
            },
            finish_reason: null,
          },
        ],
      }),
    );
    acc.push(
      chunk({
        choices: [
          {
            index: 0,
            delta: { tool_calls: [{ index: 0, function: { arguments: '{"year":20' } }] },
            finish_reason: null,
          },
        ],
      }),
    );
    acc.push(
      chunk({
        choices: [
          {
            index: 0,
            delta: { tool_calls: [{ index: 0, function: { arguments: '26,"month":7}' } }] },
            finish_reason: null,
          },
        ],
      }),
    );
    acc.push(chunk({ choices: [{ index: 0, delta: {}, finish_reason: 'tool_calls' }] }));

    const result = acc.result();
    expect(result.finishReason).toBe('tool_calls');
    expect(result.toolCalls).toEqual([
      {
        id: 'call_1',
        type: 'function',
        function: { name: 'get_month_summary', arguments: '{"year":2026,"month":7}' },
      },
    ]);
  });

  it('keeps multiple parallel tool calls separated by index and ordered', () => {
    const acc = new ToolCallAccumulator();
    acc.push(
      chunk({
        choices: [
          {
            index: 0,
            delta: {
              tool_calls: [
                {
                  index: 1,
                  id: 'call_b',
                  function: { name: 'get_banking_status', arguments: '{}' },
                },
                {
                  index: 0,
                  id: 'call_a',
                  function: { name: 'get_review_queue_count', arguments: '{}' },
                },
              ],
            },
            finish_reason: null,
          },
        ],
      }),
    );

    const result = acc.result();
    expect(result.toolCalls.map((tc) => tc.id)).toEqual(['call_a', 'call_b']);
  });

  it('captures usage from the final chunk', () => {
    const acc = new ToolCallAccumulator();
    acc.push(chunk({ choices: [{ index: 0, delta: { content: 'hi' }, finish_reason: null }] }));
    acc.push(
      chunk({
        choices: [{ index: 0, delta: {}, finish_reason: 'stop' }],
        usage: { prompt_tokens: 10, completion_tokens: 5, total_tokens: 15 },
      }),
    );

    expect(acc.result().usage).toEqual({
      prompt_tokens: 10,
      completion_tokens: 5,
      total_tokens: 15,
    });
  });
});
