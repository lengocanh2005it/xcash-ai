/**
 * Reasoning models (e.g. MiniMax-M3) may wrap chain-of-thought in XML-like tags.
 * Strip those blocks before showing Copilot replies to end users.
 */
const THINK_CLOSE = `</${'think'}>`;
const REDACTED_CLOSE = `</${'redacted_thinking'}>`;
const THINK_OPEN = `<${'think'}>`;
const REDACTED_OPEN = `<${'redacted_thinking'}>`;

export function stripLlmReasoningTags(content: string): string {
  const closedThink = new RegExp(`[\\s\\S]*?${THINK_CLOSE}\\s*`, 'gi');
  const closedRedacted = new RegExp(`[\\s\\S]*?${REDACTED_CLOSE}\\s*`, 'gi');
  const unclosedThink = new RegExp(`^${THINK_OPEN}[\\s\\S]*?(?:\\n\\n|$)`, 'i');
  const unclosedRedacted = new RegExp(`^${REDACTED_OPEN}[\\s\\S]*?(?:\\n\\n|$)`, 'i');

  return content
    .replace(closedThink, '')
    .replace(closedRedacted, '')
    .replace(unclosedThink, '')
    .replace(unclosedRedacted, '')
    .trim();
}

export function sanitizeCopilotOutput(content: string, fallback: string): string {
  const stripped = stripLlmReasoningTags(content);
  return stripped || fallback;
}

/**
 * Câu trả lời đến từ adapter fallback (không phải OpenAI chính) — cảnh báo user
 * để tránh tin nhầm số liệu chưa được xác thực bởi hệ thống chính.
 */
export function appendFallbackNotice(reply: string): string {
  return `${reply}\n\n**Lưu ý:** hệ thống chính đang gián đoạn, câu trả lời trên dùng hệ thống dự phòng — số liệu có thể cần xác minh lại.`;
}
