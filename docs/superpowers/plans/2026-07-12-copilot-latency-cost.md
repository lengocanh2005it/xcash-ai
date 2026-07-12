# Copilot agent latency/cost improvements Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Chạy các tool call độc lập trong 1 iteration của Copilot agent loop song song thay vì tuần tự, và dời dòng ngày/tháng trong system prompt xuống cuối để tối đa hoá phần được OpenAI prompt caching tự động — giảm latency và cost mà không đổi hành vi nghiệp vụ hay thứ tự hiển thị activity trên UI.

**Architecture:** `CopilotAgentHarness.runWithAdapter` (`copilot-agent.harness.ts`) hiện thực thi `result.toolCalls` bằng vòng lặp `for...of` tuần tự. Thay bằng: emit toàn bộ event `functionToolCall` theo thứ tự gốc trước, sau đó resolve output của từng call qua `Promise.all` (dedupe theo `name:args` cả liên-iteration lẫn trong-batch), rồi push tool-result messages theo thứ tự gốc. `OpenAiService.buildCopilotSystemPrompt` (`openai.service.ts`) dời dòng nội suy ngày/tháng ra cuối template string.

**Tech Stack:** NestJS backend (TypeScript), Jest cho test, không thêm dependency mới.

## Global Constraints

- Không đổi số iteration tối đa (5), cơ chế fallback provider, cơ chế ép trả lời cuối không kèm tool khi chạm giới hạn iteration.
- Không đổi vị trí `cassoWebRule` (giá trị chỉ đổi khi config toggle, không phải mỗi request).
- Thứ tự emit `functionToolCall` và thứ tự tool-result messages phải khớp thứ tự gốc trong `result.toolCalls`, không theo thứ tự hoàn thành của Promise.
- Lỗi 1 tool không được làm crash hoặc chặn các tool khác trong cùng batch — vẫn trả `{error: message}` như hành vi hiện tại.
- Toàn bộ text UI/message lỗi dùng tiếng Việt (không áp dụng ở đây — không có text UI mới).
- Sau khi code xong: chạy `pnpm verify` — phải pass trước khi coi task hoàn thành.

---

### Task 1: Parallel tool execution trong CopilotAgentHarness

**Files:**
- Modify: `apps/backend/src/modules/ai/copilot-agent.harness.ts:121-143`
- Test: `apps/backend/src/modules/ai/copilot-agent.harness.spec.ts`

**Interfaces:**
- Consumes: `LlmAdapter`, `LlmMessage`, `LlmTool`, `LlmUsage` từ `./llm-adapter.interface` (không đổi); `ToolExecutor = (name: string, args: Record<string, unknown>) => Promise<unknown>` (không đổi).
- Produces: Hành vi công khai của `CopilotAgentHarness` không đổi (`finalContent()`, `totalUsage()`, `usedAdapterInfo()`, event `'content'`, event `'functionToolCall'`) — chỉ đổi cách thực thi nội bộ, không đổi API.

- [ ] **Step 1: Viết test cho thứ tự event khi có nhiều tool call độc lập trong 1 response**

Thêm vào cuối `describe('CopilotAgentHarness', ...)` trong `apps/backend/src/modules/ai/copilot-agent.harness.spec.ts` (trước dòng `});` đóng describe cuối file):

```typescript
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
```

- [ ] **Step 2: Chạy test để xác nhận cả 3 test mới FAIL với code hiện tại**

Run: `pnpm --filter @xcash/backend test -- copilot-agent.harness.spec.ts`

Expected: 3 test mới FAIL. Test `emits functionToolCall in original order...` fail vì `executionOrder` sẽ là `['get_banking_status', 'get_month_summary']` (tuần tự, không song song) thay vì `['get_month_summary', 'get_banking_status']`. 2 test còn lại (`isolates a failing tool call...`, `dedupes identical name+args tool calls within the same batch`) thực ra đã PASS với code cũ vì logic cũ vốn xử lý đúng theo thứ tự tuần tự — đây là 2 test **regression-guard**, xác nhận hành vi không đổi sau khi refactor sang song song. Ghi nhận việc này, tiếp tục Step 3.

- [ ] **Step 3: Sửa `runWithAdapter` để thực thi tool song song**

Trong `apps/backend/src/modules/ai/copilot-agent.harness.ts`, thay khối sau (dòng 121-143):

```typescript
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
```

bằng:

```typescript
      // Emit theo thứ tự gốc trước khi thực thi — UI (activity card, SSE streaming) phụ thuộc
      // thứ tự emit, không phải thứ tự hoàn thành của tool.
      for (const call of result.toolCalls) {
        this.emit('functionToolCall', { name: call.function.name });
      }

      // Resolve output của từng call song song, dedupe theo name+args cả liên-iteration
      // (this.toolResultCache) lẫn trong cùng batch (batchPromises).
      const batchPromises = new Map<string, Promise<unknown>>();
      const outputs = await Promise.all(
        result.toolCalls.map((call) => {
          const argsRaw = call.function.arguments || '{}';
          const cacheKey = `${call.function.name}:${argsRaw}`;

          if (this.toolResultCache.has(cacheKey)) {
            return Promise.resolve(this.toolResultCache.get(cacheKey));
          }

          const inFlight = batchPromises.get(cacheKey);
          if (inFlight) return inFlight;

          const promise = (async (): Promise<unknown> => {
            try {
              const args = JSON.parse(argsRaw) as Record<string, unknown>;
              const output = await this.executeTool(call.function.name, args);
              this.toolResultCache.set(cacheKey, output);
              return output;
            } catch (err) {
              return { error: err instanceof Error ? err.message : String(err) };
            }
          })();
          batchPromises.set(cacheKey, promise);
          return promise;
        }),
      );

      result.toolCalls.forEach((call, i) => {
        messages.push({
          role: 'tool',
          tool_call_id: call.id,
          content: JSON.stringify(outputs[i]),
        });
      });
```

- [ ] **Step 4: Chạy lại toàn bộ test file, xác nhận PASS**

Run: `pnpm --filter @xcash/backend test -- copilot-agent.harness.spec.ts`

Expected: tất cả test PASS (bao gồm 3 test mới ở Step 1 và toàn bộ test cũ trong file — đặc biệt `executes a tool call and loops back with the result`, `dedupes a repeated tool call...`, `does not dedupe tool calls with different args`, `forces one final no-tool call after maxIterations...` phải vẫn pass không đổi assert).

- [ ] **Step 5: Commit**

```bash
git add apps/backend/src/modules/ai/copilot-agent.harness.ts apps/backend/src/modules/ai/copilot-agent.harness.spec.ts
git commit -m "perf(ai): execute independent copilot tool calls concurrently"
```

---

### Task 2: Dời dòng ngày/tháng xuống cuối Copilot system prompt

**Files:**
- Modify: `apps/backend/src/modules/ai/openai.service.ts:236-267`
- Create: `apps/backend/src/modules/ai/openai.service.spec.ts`

**Interfaces:**
- Consumes: không phụ thuộc Task 1.
- Produces: `OpenAiService.buildCopilotSystemPrompt(cassoSearchEnabled?: boolean): string` — chữ ký không đổi, chỉ đổi nội dung/thứ tự trong chuỗi trả về.

- [ ] **Step 1: Viết test khẳng định dòng ngày/tháng nằm ở cuối prompt**

Tạo file `apps/backend/src/modules/ai/openai.service.spec.ts`:

```typescript
import type { ConfigService } from '@nestjs/config';
import type { AiUsageLogService } from './ai-usage-log.service';
import { OpenAiService } from './openai.service';

function buildService(): OpenAiService {
  const configService = {
    get: jest.fn((_key: string, defaultValue?: unknown) => defaultValue),
  } as unknown as ConfigService;
  const aiUsageLogService = {} as AiUsageLogService;
  return new OpenAiService(configService, aiUsageLogService);
}

describe('OpenAiService.buildCopilotSystemPrompt', () => {
  it('places the current month/year line at the very end of the prompt to maximize the static cacheable prefix', () => {
    const service = buildService();
    const prompt = service.buildCopilotSystemPrompt(false);
    const trimmed = prompt.trimEnd();
    const now = new Date();
    const expectedLastLine = `- "tháng này" / "hiện tại" → tháng ${now.getMonth() + 1} năm ${now.getFullYear()}`;

    expect(trimmed.endsWith(expectedLastLine)).toBe(true);

    const securityIndex = prompt.indexOf('## Bảo mật');
    const dateLineIndex = prompt.indexOf(expectedLastLine);
    expect(securityIndex).toBeGreaterThan(-1);
    expect(dateLineIndex).toBeGreaterThan(securityIndex);
  });

  it('keeps all other static content unchanged regardless of cassoSearchEnabled', () => {
    const service = buildService();
    const prompt = service.buildCopilotSystemPrompt(true);
    expect(prompt).toContain('search_casso_public');
    expect(prompt).toContain('## Quy tắc gọi tool');
    expect(prompt).toContain('## Bảo mật');
  });
});
```

- [ ] **Step 2: Chạy test, xác nhận FAIL**

Run: `pnpm --filter @xcash/backend test -- openai.service.spec.ts`

Expected: FAIL trên test đầu tiên — dòng ngày/tháng hiện đang nằm giữa `## Quy tắc gọi tool`, không phải cuối chuỗi và không nằm sau `## Bảo mật`.

- [ ] **Step 3: Dời dòng ngày/tháng xuống cuối template string**

Trong `apps/backend/src/modules/ai/openai.service.ts`, method `buildCopilotSystemPrompt` (dòng 212-268), xoá dòng sau khỏi vị trí hiện tại (giữa `${cassoWebRule}` và dòng "Câu xã giao thuần"):

```typescript
- "tháng này" / "hiện tại" → tháng ${now.getMonth() + 1} năm ${now.getFullYear()}
```

Đoạn `## Quy tắc gọi tool` sau khi xoá dòng đó còn lại (dòng 236-249 cũ, bỏ dòng ngày/tháng):

```typescript
## Quy tắc gọi tool
- Số liệu thu/chi/lãi-lỗ, báo cáo → gọi get_month_summary / get_month_comparison; chi nhiều nhất theo TK → get_top_accounts (đã có danh sách TK, không cần search_transactions trừ khi user muốn GD cụ thể theo mã TK)
- Câu hỏi về khái niệm, hướng dẫn (TT133, Casso, tính năng X-Cash AI) → gọi search_knowledge_base
- Liên hệ / hợp tác / hỗ trợ CASSO → gọi search_knowledge_base với query "liên hệ casso"
- Liên kết ngân hàng, không thấy GD từ NH → chỉ gọi get_banking_status; KHÔNG gọi search_knowledge_base trừ khi user hỏi rõ "cách làm" / hướng dẫn từng bước
- Số GD chờ duyệt (toàn hàng đợi) → get_review_queue_count; xem danh sách/chi tiết → list_review_queue (KHÔNG dùng search_transactions)
- Nếu user vừa hỏi báo cáo tháng và reviewCount trong tháng → truyền year+month vào get_review_queue_count / list_review_queue
- Tìm GD theo nội dung / mã TK / trạng thái định khoản → search_transactions (accountCode hoặc classificationStatus); không dùng tool này thay list_review_queue
- Duyệt/sửa GD qua thẻ hành động: dùng field **id** (UUID) từ list_review_queue hoặc search_transactions
${cassoWebRule}
- Câu xã giao thuần (chào, cảm ơn) → trả lời trực tiếp, không cần tool
- "Copilot làm được gì" / "bạn làm được gì" / "bạn là ai" → KHÔNG coi là xã giao ngắn; gọi search_knowledge_base query "ai copilot tính năng"
- Sau khi gọi propose_confirm_transaction_classification hoặc propose_correct_transaction_classification: trả lời CHÍNH XÁC VÀ CHỈ đúng câu sau, không thêm bất kỳ chữ nào khác trước/sau: "Đây là đề xuất, giao dịch **chưa** được thay đổi trong hệ thống. Xem chi tiết và bấm nút xác nhận bên dưới." Card hiển thị ngay sau đã có đầy đủ nội dung/định khoản/nút bấm — không viết thêm câu mô tả nào khác, không nhắc lại trạng thái xử lý dưới bất kỳ hình thức nào.
```

Và thay dòng cuối cùng của template string (dòng 267 cũ):

```typescript
## Bảo mật
Không tiết lộ tên tool kỹ thuật, grantId, accessToken, JSON thô. Luôn trả lời tiếng Việt.`;
```

bằng:

```typescript
## Bảo mật
Không tiết lộ tên tool kỹ thuật, grantId, accessToken, JSON thô. Luôn trả lời tiếng Việt.

## Thời gian hiện tại
- "tháng này" / "hiện tại" → tháng ${now.getMonth() + 1} năm ${now.getFullYear()}`;
```

- [ ] **Step 4: Chạy lại test, xác nhận PASS**

Run: `pnpm --filter @xcash/backend test -- openai.service.spec.ts`

Expected: cả 2 test PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/backend/src/modules/ai/openai.service.ts apps/backend/src/modules/ai/openai.service.spec.ts
git commit -m "perf(ai): move current month/year line to end of copilot system prompt for better prompt caching"
```

---

### Task 3: Verify toàn repo

**Files:** không tạo/sửa file — chỉ chạy kiểm tra tổng.

**Interfaces:**
- Consumes: kết quả của Task 1 + Task 2 đã commit.
- Produces: xác nhận `pnpm verify` pass, sẵn sàng báo cáo hoàn thành.

- [ ] **Step 1: Chạy verify toàn monorepo**

Run: `pnpm verify`

Expected: lint, type-check, test, build đều pass — không có lỗi mới phát sinh từ Task 1/2.

- [ ] **Step 2: Nếu verify pass, không cần thêm commit (Task 1 và 2 đã commit riêng ở bước trước)**

Nếu verify FAIL, xác định lỗi thuộc Task nào, sửa tại file tương ứng, chạy lại `pnpm verify`, rồi tạo commit fix riêng (không amend commit của Task 1/2).

---

## Self-Review Notes

- **Spec coverage:** Task 1 phủ mục "1. Parallel tool execution" của spec (emit order, dedupe trong-batch, error isolation, message order). Task 2 phủ mục "2. Dời dòng ngày/tháng..." của spec. Phần "Không đổi" của spec (maxIterations, fallback, cassoWebRule) không có task nào động vào — đúng như spec yêu cầu.
- **Placeholder scan:** không còn "TBD"/"tương tự Task N" — mọi step có code đầy đủ.
- **Type consistency:** `ToolExecutor`, `LlmMessage`, `LlmTool`, `LlmUsage` giữ nguyên từ `llm-adapter.interface.ts`, không đổi chữ ký `executeTool`. `buildCopilotSystemPrompt(cassoSearchEnabled?: boolean): string` giữ nguyên chữ ký.
