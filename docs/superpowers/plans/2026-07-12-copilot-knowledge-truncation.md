# Copilot knowledge content truncation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Cắt bớt field `content` của mỗi section trả về bởi tool `search_knowledge_base` xuống tối đa 800 ký tự (ưu tiên cắt tại ranh giới câu) trước khi đưa vào context gửi LLM, giảm token cho các câu hỏi khái niệm mà không mất phần nội dung cốt lõi.

**Architecture:** Thêm 1 hàm thuần `truncateAtSentenceBoundary(content, maxLength = 800)` trong `apps/backend/src/modules/ai/tools/knowledge-tools.ts`, áp dụng cho `sections[].content` ngay trong `execute` của tool `search_knowledge_base` — không đổi tầng service (`copilot-knowledge.service.ts`, `knowledge/index.ts`) vì chỉ có 1 nơi gọi service này (chính tool này).

**Tech Stack:** NestJS backend (TypeScript), Jest cho test, không thêm dependency mới.

## Global Constraints

- Ngưỡng cắt: **800 ký tự**. Nếu `content.length <= 800`: giữ nguyên, không đổi, không thêm `"…"`.
- Nếu `content.length > 800`: tìm vị trí dấu `.` **gần nhất, nằm trong khoảng ký tự [0, 800]** (lấy vị trí lớn nhất ≤ 800), cắt tại đó (bao gồm dấu `.`), thêm `"…"` vào cuối.
- Nếu không tìm thấy dấu `.` nào trong khoảng [0, 800]: fallback cắt cứng đúng ký tự thứ 800, thêm `"…"`.
- Không đổi field `id`, `title` của section, không đổi `query`, `totalFound` của kết quả.
- Không đụng `apps/backend/src/modules/ai/copilot-knowledge.service.ts`, `apps/backend/src/modules/ai/knowledge/index.ts`, hay tool `search_casso_public`.
- Sau khi code xong: chạy `pnpm verify` — phải pass trước khi coi task hoàn thành.

---

### Task 1: Truncate helper + áp dụng vào tool search_knowledge_base

**Files:**
- Modify: `apps/backend/src/modules/ai/tools/knowledge-tools.ts`
- Test: `apps/backend/src/modules/ai/tools/knowledge-tools.spec.ts` (file mới)

**Interfaces:**
- Consumes: `ToolDeps`, `CopilotToolEntry` từ `../copilot-tool.types` (không đổi). `KnowledgeSearchResult` (shape `{ sections: Array<{ id: string; title: string; content: string }>; query: string; totalFound: number }`) là kiểu trả về của `deps.knowledgeService.searchKnowledge()` — định nghĩa tại `apps/backend/src/modules/ai/knowledge/index.ts:18-22`, không đổi.
- Produces: hàm thuần `truncateAtSentenceBoundary(content: string, maxLength?: number): string`, export từ `knowledge-tools.ts` để test trực tiếp. Tool `search_knowledge_base` trong mảng `knowledgeTools` giữ nguyên `name`, `description`, `parameters`, `activity`, `formatSnippet` — chỉ đổi `execute`.

- [ ] **Step 1: Viết test cho `truncateAtSentenceBoundary` và cho `execute` của tool `search_knowledge_base`**

Tạo file `apps/backend/src/modules/ai/tools/knowledge-tools.spec.ts`:

```typescript
import type { ToolDeps } from '../copilot-tool.types';
import { knowledgeTools, truncateAtSentenceBoundary } from './knowledge-tools';

const searchKnowledgeBaseTool = knowledgeTools.find((t) => t.name === 'search_knowledge_base');
if (!searchKnowledgeBaseTool) {
  throw new Error('search_knowledge_base tool not found in knowledgeTools');
}

function depsWithKnowledgeResult(
  sections: Array<{ id: string; title: string; content: string }>,
): ToolDeps {
  return {
    knowledgeService: {
      searchKnowledge: jest.fn().mockResolvedValue({
        sections,
        query: 'câu hỏi test',
        totalFound: sections.length,
      }),
    },
  } as never;
}

describe('truncateAtSentenceBoundary', () => {
  it('returns content unchanged when at or under 800 chars', () => {
    const content = 'a'.repeat(800);
    expect(truncateAtSentenceBoundary(content)).toBe(content);
  });

  it('returns short content unchanged without adding an ellipsis', () => {
    const content = 'Nội dung ngắn.';
    expect(truncateAtSentenceBoundary(content)).toBe(content);
  });

  it('cuts at the nearest sentence boundary at or before 800 chars', () => {
    const content = `${'a'.repeat(700)}. ${'b'.repeat(200)}`;
    expect(truncateAtSentenceBoundary(content)).toBe(`${'a'.repeat(700)}.…`);
  });

  it('falls back to a hard cut at 800 chars when no period appears in the first 800 chars', () => {
    const content = 'a'.repeat(1000);
    expect(truncateAtSentenceBoundary(content)).toBe(`${'a'.repeat(800)}…`);
  });
});

describe('search_knowledge_base tool execute', () => {
  it('truncates long section content and leaves short section content untouched', async () => {
    const shortContent = 'Nội dung ngắn.';
    const longContent = `${'x'.repeat(700)}. ${'y'.repeat(200)}`;
    const deps = depsWithKnowledgeResult([
      { id: 'sec-short', title: 'Ngắn', content: shortContent },
      { id: 'sec-long', title: 'Dài', content: longContent },
    ]);

    const result = (await searchKnowledgeBaseTool.execute(deps, 'tenant-1', {
      query: 'x',
    })) as {
      sections: Array<{ id: string; title: string; content: string }>;
      query: string;
      totalFound: number;
    };

    expect(result.sections[0]).toEqual({ id: 'sec-short', title: 'Ngắn', content: shortContent });
    expect(result.sections[1].id).toBe('sec-long');
    expect(result.sections[1].title).toBe('Dài');
    expect(result.sections[1].content).toBe(`${'x'.repeat(700)}.…`);
    expect(result.query).toBe('câu hỏi test');
    expect(result.totalFound).toBe(2);
  });

  it('returns an empty sections array unchanged when the knowledge base has no hits', async () => {
    const deps = depsWithKnowledgeResult([]);

    const result = (await searchKnowledgeBaseTool.execute(deps, 'tenant-1', {
      query: 'không tồn tại',
    })) as { sections: unknown[]; totalFound: number };

    expect(result.sections).toEqual([]);
    expect(result.totalFound).toBe(0);
  });
});
```

- [ ] **Step 2: Chạy test để xác nhận FAIL**

Run: `pnpm --filter @xcash/backend test -- knowledge-tools.spec.ts`

Expected: FAIL — `truncateAtSentenceBoundary` chưa tồn tại (import error), và `execute` của tool hiện tại trả thẳng kết quả từ `searchKnowledge()` không cắt content.

- [ ] **Step 3: Implement `truncateAtSentenceBoundary` và sửa `execute`**

Trong `apps/backend/src/modules/ai/tools/knowledge-tools.ts`, thêm hàm mới ngay sau dòng `import type { CopilotToolEntry } from '../copilot-tool.types';` (dòng 1) và trước `export const knowledgeTools`:

```typescript
export function truncateAtSentenceBoundary(content: string, maxLength = 800): string {
  if (content.length <= maxLength) return content;

  const window = content.slice(0, maxLength);
  const lastPeriod = window.lastIndexOf('.');

  if (lastPeriod === -1) {
    return `${window}…`;
  }

  return `${window.slice(0, lastPeriod + 1)}…`;
}
```

Thay `execute` của tool `search_knowledge_base` (hiện tại dòng 28-29):

```typescript
    execute: (deps, _tenantId, args) =>
      deps.knowledgeService.searchKnowledge(String(args.query ?? '')),
```

bằng:

```typescript
    execute: async (deps, _tenantId, args) => {
      const result = await deps.knowledgeService.searchKnowledge(String(args.query ?? ''));
      return {
        ...result,
        sections: result.sections.map((section) => ({
          ...section,
          content: truncateAtSentenceBoundary(section.content),
        })),
      };
    },
```

- [ ] **Step 4: Chạy lại test, xác nhận PASS**

Run: `pnpm --filter @xcash/backend test -- knowledge-tools.spec.ts`

Expected: tất cả test PASS.

- [ ] **Step 5: Chạy test của `copilot-tool.executor.spec.ts` để xác nhận không phá vỡ test dispatch hiện có**

Run: `pnpm --filter @xcash/backend test -- copilot-tool.executor.spec.ts`

Expected: PASS — test `dispatches search_knowledge_base to knowledgeService.searchKnowledge` (mock trả `{ sections: [], totalFound: 0 }`) vẫn pass vì `sections: []` qua `.map()` vẫn là `[]`, `toEqual` vẫn khớp.

- [ ] **Step 6: Commit**

```bash
git add apps/backend/src/modules/ai/tools/knowledge-tools.ts apps/backend/src/modules/ai/tools/knowledge-tools.spec.ts
git commit -m "perf(ai): truncate search_knowledge_base section content before sending to LLM context"
```

---

### Task 2: Verify toàn repo

**Files:** không tạo/sửa file — chỉ chạy kiểm tra tổng.

**Interfaces:**
- Consumes: kết quả của Task 1 đã commit.
- Produces: xác nhận `pnpm verify` pass, sẵn sàng báo cáo hoàn thành.

- [ ] **Step 1: Chạy verify toàn monorepo**

Run: `pnpm verify`

Expected: lint, type-check, test, build đều pass — không có lỗi mới phát sinh từ Task 1.

- [ ] **Step 2: Nếu verify pass, không cần thêm commit**

Nếu verify FAIL, xác định lỗi có thuộc về thay đổi ở Task 1 hay không (phân biệt với WIP có sẵn không liên quan trên working tree). Nếu thuộc Task 1, sửa tại `knowledge-tools.ts`/`knowledge-tools.spec.ts`, chạy lại `pnpm verify`, tạo commit fix riêng (không amend commit Task 1).

---

## Self-Review Notes

- **Spec coverage:** Task 1 phủ toàn bộ mục "Thiết kế" và "Testing" của spec (ngưỡng 800, cắt tại dấu `.` gần nhất ≤ 800, fallback cắt cứng, giữ nguyên `id`/`title`/`totalFound`/`query`, 5 test case tương ứng đúng danh sách trong spec — bao gồm case section ngắn + dài cùng lúc và case rỗng). Mục "Ngoài phạm vi" của spec (không đụng `search_casso_public`, các tool danh sách khác) không có task nào động vào — đúng yêu cầu.
- **Placeholder scan:** không còn "TBD"/mô tả mơ hồ — mọi step có code đầy đủ.
- **Type consistency:** `truncateAtSentenceBoundary(content: string, maxLength = 800): string` dùng nhất quán giữa Step 1 (test) và Step 3 (implementation). `CopilotToolEntry['execute']` giữ nguyên chữ ký `(deps, tenantId, args, role?) => Promise<unknown>` — không đổi type của tool entry.
