# Copilot review-queue-count intent heuristic Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Với câu hỏi khớp exact-match các mẫu đã duyệt về số GD chờ duyệt, seed sẵn tool call `get_review_queue_count` vào harness để bỏ qua 1 lượt LLM quyết định tool — giảm latency/cost; câu hỏi khác giữ hành vi cũ 100%.

**Architecture:** Module thuần `copilot-intent-heuristic.ts` (`matchReviewQueueCountIntent`). Factory gọi heuristic → truyền `seededToolCall` vào `CopilotAgentHarness`. Harness `applySeededToolCall` trước vòng adapter: emit event + execute tool + push assistant/tool messages. `runWithAdapter` không đổi.

**Tech Stack:** NestJS backend (TypeScript), Jest, không dependency mới.

## Global Constraints

- Exact-match toàn câu sau normalize (trim, lowercase, bỏ `?!.,` cuối) — **không** `includes`/fuzzy.
- Pilot chỉ tool `get_review_queue_count` với `args: {}`.
- Không đổi `copilot-stream.service.ts`, `runWithAdapter`, UI.
- **Timing fix vs spec code:** `emit('functionToolCall')` phải sau `await Promise.resolve()` (hoặc await khác) để caller kịp `.on(...)` trước khi event fire — constructor khởi động `run()` sync tới emit; spec mô tả đúng intent nhưng snippet emit-trước-await sẽ mất event. Implement theo claim an toàn của spec, không theo thứ tự emit-first trong snippet.
- Sau code: `pnpm verify` (hoặc ít nhất backend filter) phải pass.

---

### Task 1: `matchReviewQueueCountIntent`

**Files:**
- Create: `apps/backend/src/modules/ai/copilot-intent-heuristic.ts`
- Test: `apps/backend/src/modules/ai/copilot-intent-heuristic.spec.ts`

**Interfaces:**
- Produces: `matchReviewQueueCountIntent(message: string): boolean`
- Phrases Set đúng 6 câu trong spec.

- [ ] **Step 1: Viết failing tests** (mọi phrase ± case ± `?`; negative: doanh thu / danh sách chờ duyệt / empty)
- [ ] **Step 2: Chạy test → FAIL**
- [ ] **Step 3: Implement module theo spec**
- [ ] **Step 4: Chạy test → PASS**

---

### Task 2: `seededToolCall` trên harness

**Files:**
- Modify: `apps/backend/src/modules/ai/copilot-agent.harness.ts`
- Modify: `apps/backend/src/modules/ai/copilot-agent.harness.spec.ts`

**Interfaces:**
- Consumes: constructor thêm optional `seededToolCall?: { name: string; args: Record<string, unknown> }`
- Produces: `applySeededToolCall` — yield microtask → emit → execute → cache → push messages; lỗi tool → `{ error }` không throw

- [ ] **Step 1: Viết failing harness tests** (seed + LLM trả lời ngay / seed + LLM gọi tool thêm / seed + execute throw / regression không seed)
- [ ] **Step 2: Chạy test seeded → FAIL**
- [ ] **Step 3: Implement constructor + `run` seed + `applySeededToolCall` (có `await Promise.resolve()` trước emit)
- [ ] **Step 4: Chạy toàn `copilot-agent.harness.spec.ts` → PASS**

---

### Task 3: Wire factory

**Files:**
- Modify: `apps/backend/src/modules/ai/copilot-agent-factory.service.ts`
- Create: `apps/backend/src/modules/ai/copilot-agent-factory.service.spec.ts`

**Interfaces:**
- Consumes: `matchReviewQueueCountIntent`
- Produces: `createCopilotRunner` truyền `seededToolCall` arg thứ 8 khi match

- [ ] **Step 1: Viết factory tests** (mock `CopilotAgentHarness`, assert arg seed / undefined)
- [ ] **Step 2: FAIL → implement wire → PASS**

---

### Task 4: Verify

- [ ] `pnpm exec turbo run lint type-check test build --filter=@xcash/backend`
- [ ] Commit chỉ khi user yêu cầu

## Self-Review

- Spec coverage: heuristic + seed harness + factory + tests listed — đủ.
- Timing: documented deviation (microtask yield trước emit) — bắt buộc để UI activity card không mất.
- Không đụng tool khác / stream service.
