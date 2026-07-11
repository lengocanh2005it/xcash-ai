import {
  appendFallbackNotice,
  sanitizeCopilotOutput,
  stripLlmReasoningTags,
} from './llm-output.util';

describe('stripLlmReasoningTags', () => {
  it('removes closed think blocks', () => {
    const input = [
      '<think>The user asks about Casso.',
      '</think>',
      '',
      'Chào bạn! Kiểm tra liên kết ngân hàng nhé.',
    ].join('\n');
    expect(stripLlmReasoningTags(input)).toBe('Chào bạn! Kiểm tra liên kết ngân hàng nhé.');
  });

  it('removes redacted_thinking blocks', () => {
    const input = [
      '<think>internal reasoning',
      '</think>',
      '',
      '**AI Copilot** sẵn sàng hỗ trợ.',
    ].join('\n');
    expect(stripLlmReasoningTags(input)).toBe('**AI Copilot** sẵn sàng hỗ trợ.');
  });

  it('removes unclosed think prefix', () => {
    const input = ['<think>Still reasoning without closing tag', '', 'Câu trả lời cuối.'].join(
      '\n',
    );
    expect(stripLlmReasoningTags(input)).toBe('Câu trả lời cuối.');
  });

  it('keeps normal replies unchanged', () => {
    const input = 'Doanh thu tháng này là **12.000.000đ**.';
    expect(stripLlmReasoningTags(input)).toBe(input);
  });
});

describe('sanitizeCopilotOutput', () => {
  it('uses fallback when only reasoning remains', () => {
    const input = ['<think>internal only', '</think>'].join('\n');
    expect(sanitizeCopilotOutput(input, 'fallback')).toBe('fallback');
  });
});

describe('appendFallbackNotice', () => {
  it('appends a disclaimer after the reply', () => {
    const result = appendFallbackNotice('Doanh thu tháng này là **12.000.000đ**.');
    expect(result.startsWith('Doanh thu tháng này là **12.000.000đ**.')).toBe(true);
    expect(result).toContain('hệ thống dự phòng');
  });
});
