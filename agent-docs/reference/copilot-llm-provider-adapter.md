# ADR: Copilot LLM Provider Adapter — decouple function calling khỏi OpenAI

## Summary

ADR cho quyết định tách **Copilot agent loop** và **LLM provider** — decouple function calling khỏi OpenAI `runTools`.

**PRD:** #31
**Status:** Accepted

## Context

- Copilot đã migrate sang function calling qua OpenAI SDK `runTools` (xem `agent-docs/reference/copilot-function-calling-migration.md`)
- Tool domain layer (`copilot-tool.registry`, `CopilotToolService`) đã portable
- Orchestration + streaming vẫn gắn OpenAI runner → MiniMax fallback (#30) chỉ chat thuần, mất tools

## Decision

**Chúng ta đã** implement `CopilotAgentService` + `LlmProviderAdapter` interface, thay `client.chat.completions.runTools()`.

**Vì:**
- Provider portability (OpenAI, MiniMax, …)
- Fallback có tools khi primary LLM quota exhausted
- Testability (mock adapter, không mock OpenAI runner)

**Chúng ta sẽ không** maintain song song `runTools` và custom loop lâu dài.

## Architecture

```
┌─────────────────────────────────────────────────────┐
│                  CopilotStreamService                │
│  (SSE streaming, conversation persistence, quota)   │
└────────────────────────┬────────────────────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────┐
│                 CopilotAgentService                  │
│  - Agent loop generic (max N rounds)                │
│  - Tool dispatch qua CopilotToolService             │
│  - Fallback provider khi primary fail               │
│  - Abort signal support                             │
└────────────────────────┬────────────────────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────┐
│              LlmProviderAdapter (interface)          │
│  chat(), isQuotaOrBillingError(), isRetryableError()│
└──────┬──────────────────────────────┬───────────────┘
       │                              │
       ▼                              ▼
┌──────────────┐            ┌──────────────────┐
│ OpenAiLlm    │            │ MinimaxLlm       │
│ Provider     │            │ Provider         │
│ (gpt-4o-mini)│            │ (MiniMax-M3)     │
└──────────────┘            └──────────────────┘
```

## Files changed

| File | Action |
|------|--------|
| `llm/llm-provider.interface.ts` | **New** — `LlmProviderAdapter`, `LlmMessage`, `LlmToolCall`, `LlmChatResult`, `LlmToolDefinition` |
| `llm/openai-llm.provider.ts` | **New** — OpenAI adapter (chat.completions.create, tool_calls) |
| `llm/minimax-llm.provider.ts` | **New** — MiniMax adapter (OpenAI-compatible, reasoning tag strip) |
| `copilot-agent.service.ts` | **New** — Agent loop generic: LLM → parse toolCalls → execute → append tool message → lặp |
| `copilot-tools.factory.ts` | **Modified** — Thêm `buildCopilotToolDefinitions()` (schema-only), giữ `buildCopilotTools()` deprecated |
| `copilot-stream.service.ts` | **Modified** — Wire `CopilotAgentService.runWithFallback()` thay `createCopilotRunner()` |
| `openai.service.ts` | **Modified** — Bỏ `createCopilotRunner()`, giữ `chatCopilot()`, `buildCopilotSystemPrompt()`, `classifyTransaction()` |
| `ai.module.ts` | **Modified** — Register `OpenAiLlmProvider`, `MinimaxLlmProvider`, `CopilotAgentService` |
| `configuration.ts` | **Modified** — Thêm `COPILOT_LLM_PROVIDER`, `COPILOT_AGENT_MAX_ROUNDS` |

## Configuration

```env
# Primary LLM provider: "openai" | "minimax"
COPILOT_LLM_PROVIDER=openai

# Max tool-calling rounds per request (default: 5)
COPILOT_AGENT_MAX_ROUNDS=5
```

## Consequences

### Positive
- Đổi `COPILOT_LLM_PROVIDER` không rewrite Copilot stream/JSON endpoints
- MiniMax (hoặc provider khác) có thể chạy full tool loop
- SSE contract (`activity`, `delta`, `done`) ổn định ở agent layer
- Provider adapters unit-testable với canned responses

### Negative / trade-offs
- Tự handle edge cases mà `runTools` đang làm (multi-round tools, abort, partial stream)
- MiniMax tool-calling cần verify riêng (JSON schema strict mode, reasoning tag sanitize)

## Alternatives considered

| Option | Verdict |
|--------|--------|
| Giữ `runTools` + MiniMax chat-only fallback (#30) | ❌ Đang gây hallucination khi OpenAI down |
| Dual path: `runTools` (OpenAI) + custom loop (others) | ❌ Duplicate logic, drift behavior |
| Prompt stuffing (`COPILOT_USE_FUNCTION_CALLING=0`) | ❌ Regression — bỏ dynamic tools |
| **Single `CopilotAgentService` + adapters** | ✅ Chọn |
