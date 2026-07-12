# Cắt bớt content của search_knowledge_base trước khi đưa vào context Copilot

**Ngày:** 2026-07-12
**Phạm vi:** `apps/backend/src/modules/ai/tools/knowledge-tools.ts` (tool `search_knowledge_base`)

## Bối cảnh

Đây là hạng mục (4) đã được defer từ spec trước
([`2026-07-12-copilot-latency-cost-design.md`](./2026-07-12-copilot-latency-cost-design.md)) với tên gọi ban
đầu "tóm tắt/paginate tool result lớn". Sau khi đọc lại code thật của các tool trả danh sách
(`list_review_queue`, `search_transactions`, `get_top_accounts`), phát hiện chúng **đã có cap sẵn** ở tầng
schema tool (`limit` tối đa 10-20 bản ghi, mỗi bản ghi là object phẳng gọn) — không phải vấn đề thật.

Vấn đề thật sự hẹp hơn: tool `search_knowledge_base` (`apps/backend/src/modules/ai/tools/knowledge-tools.ts`)
trả tối đa 2 section (cả nhánh pgvector lẫn keyword fallback trong
`apps/backend/src/modules/ai/copilot-knowledge.service.ts` và `apps/backend/src/modules/ai/knowledge/index.ts`
đều cap `maxResults`/`LIMIT` = 2), nhưng field `content` của mỗi section là **toàn bộ nội dung gốc, không cắt**
khi đưa vào `messages` gửi cho LLM (chỉ UI snippet ở `copilot-activity.helper.ts:91`
— `section.content.slice(0, 350)` — mới bị cắt, và đó là luồng hiển thị nguồn tham khảo, không phải luồng gửi
LLM).

Đo thực tế độ dài `content` trong 4 file nguồn kiến thức
(`apps/backend/src/modules/ai/knowledge/{tt133,xcash-features,casso,billing-settings}.ts`): dao động 145-1629
ký tự, đa số 500-1300 ký tự. Trường hợp xấu nhất (2 section dài nhất cùng khớp 1 câu hỏi) gửi khoảng
2600-3200 ký tự thô cho LLM chỉ riêng phần `content`.

## Mục tiêu

- Giảm số ký tự/token của tool-result message khi `search_knowledge_base` được gọi, mà không làm mất phần nội
  dung cốt lõi LLM cần để trả lời đúng.
- Không đổi hành vi UI (source card đã tự cắt 350 ký tự riêng, không phụ thuộc thay đổi này).
- Không đổi tool `search_casso_public` hay `copilot-knowledge.service.ts` — chỉ sửa tại tool boundary của
  `search_knowledge_base`.

## Thiết kế

### Vị trí sửa

`apps/backend/src/modules/ai/tools/knowledge-tools.ts`, tool `search_knowledge_base`, hàm `execute` (dòng
28-29 hiện tại):

```typescript
execute: (deps, _tenantId, args) =>
  deps.knowledgeService.searchKnowledge(String(args.query ?? '')),
```

### Thay đổi

Bọc kết quả trả về, map qua `sections` để cắt `content` bằng 1 helper mới `truncateAtSentenceBoundary`:

- Nếu `content.length <= 800`: giữ nguyên, không đổi.
- Nếu `content.length > 800`: tìm vị trí dấu `.` (kết thúc câu) **gần nhất, nằm trong khoảng [0, 800]**
  (ưu tiên vị trí lớn nhất ≤ 800 để giữ được nhiều nội dung nhất trong giới hạn). Cắt tại vị trí đó (bao gồm
  dấu `.`), thêm `"…"` vào cuối.
- Nếu không tìm thấy dấu `.` nào trong khoảng [0, 800] (content toàn 1 câu dài không có dấu chấm câu ở nửa
  đầu): fallback cắt cứng tại đúng ký tự thứ 800, thêm `"…"`.

Các field khác của section (`id`, `title`) và của toàn bộ result (`query`, `totalFound`) giữ nguyên, không
đổi.

Ngưỡng 800 ký tự chọn dựa trên phân bố đo thực tế (median section ~830 ký tự) — chỉ cắt phần đuôi của các
section dài nhất (1036-1629 ký tự), giữ nguyên phần lớn nội dung cốt lõi ở đầu section (theo cách viết hiện
tại của các file nguồn, ý chính luôn nằm ở đầu đoạn).

### Vì sao an toàn

- Chỉ 1 nơi gọi `knowledgeService.searchKnowledge()` trong toàn repo (`knowledge-tools.ts:29`) — sửa tại tool
  boundary không ảnh hưởng test/consumer khác của `copilot-knowledge.service.ts` hay
  `apps/backend/src/modules/ai/knowledge/index.ts`.
- `buildActivities()` (`copilot-activity.helper.ts:77-96`) tự `.slice(0, 350)` trên `section.content` nhận
  được — 800 ≥ 350 nên không có thay đổi hành vi UI dù input đã bị cắt trước hay chưa.
- `id` dùng để lọc `KNOWLEDGE_SECTION_IDS_HIDDEN_FROM_SOURCES` và `sectionCategoryLabel(id)` — không đổi,
  không phụ thuộc `content`.
- `search_casso_public` không bị đụng tới (dùng `knowledgeService.searchCassoPublic`, hàm khác).

## Testing

Thêm test cho helper `truncateAtSentenceBoundary` (hoặc test trực tiếp qua `search_knowledge_base`'s
`execute` với `deps.knowledgeService.searchKnowledge` mock trả về section content được kiểm soát — theo đúng
pattern test hiện có trong `copilot-tool.executor.spec.ts`):

- Content ≤ 800 ký tự → giữ nguyên, không có `"…"`.
- Content > 800 ký tự, có dấu `.` trong khoảng [0, 800] → cắt tại dấu `.` gần 800 nhất, có `"…"` ở cuối, độ
  dài kết quả ≤ 801 (800 + dấu `.` nếu vị trí dấu `.` đúng bằng 800) + độ dài `"…"`.
- Content > 800 ký tự, không có dấu `.` nào trong khoảng [0, 800] → fallback cắt cứng đúng 800 ký tự + `"…"`.
- `id`, `title`, `totalFound`, `query` không đổi qua truncation.
- Section content ≤ 800 và section content > 800 xuất hiện cùng lúc trong 1 kết quả (2 section) → chỉ section
  dài bị cắt, section ngắn giữ nguyên.

## Ngoài phạm vi

- `search_casso_public` — dữ liệu lấy từ web ngoài, có cơ chế cắt riêng (`formatSnippet` cắt 300 ký tự cho
  UI), không thuộc scope hạng mục (4) đã defer.
- Các tool trả danh sách khác (`list_review_queue`, `search_transactions`, `get_top_accounts`) — đã có cap
  hợp lý sẵn ở tầng schema, không cần thay đổi.
