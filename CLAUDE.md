# X-Cash AI — Agent Entry Point

X-Cash AI là nền tảng AI-powered Automatic Transaction Classification (Định khoản tự động) cho SME Việt Nam: nhận giao dịch ngân hàng real-time qua **Cas Balance Hook**, dùng AI (OpenAI gpt-4o-mini + pgvector) để tự động phân loại giao dịch theo chuẩn kế toán TT133, kế toán xác nhận qua Human Review, export báo cáo Excel cuối tháng.

Đây là **Turborepo monorepo** (pnpm workspaces) gồm backend NestJS + frontend React, chia sẻ types qua package nội bộ.

## Đọc gì trước khi code

1. **[`agent-docs/00-current-state.md`](./agent-docs/00-current-state.md) — ĐỌC FILE NÀY TRƯỚC TIÊN, LUÔN LUÔN.** Đây là ảnh chụp chính xác trạng thái repo (cây file thật, script thật, dependency thật, việc gì đã xong/chưa xong). Đọc xong thường đủ để biết bước tiếp theo — **không cần `find`/`grep`/`ls` lại từ đầu mỗi session**, tránh tốn token dò lại những gì đã được ghi sẵn.
2. [`agent-docs/README.md`](./agent-docs/README.md) — mục lục đầy đủ, tra theo việc đang làm.
3. [`agent-docs/01-monorepo-structure.md`](./agent-docs/01-monorepo-structure.md) — cấu trúc thư mục, lệnh chạy, quy tắc thêm package mới.
4. [`agent-docs/02-backend-conventions.md`](./agent-docs/02-backend-conventions.md) — quy ước code NestJS, cấu trúc module.
5. [`agent-docs/03-frontend-conventions.md`](./agent-docs/03-frontend-conventions.md) — quy ước code React.
6. [`agent-docs/reference/`](./agent-docs/reference/) — tài liệu nghiệp vụ gốc đầy đủ (business logic, RBAC, DB schema, UI spec, sprint plan). **Đây là nguồn sự thật (source of truth) cho mọi quyết định nghiệp vụ** — không tự suy diễn nghiệp vụ khi tài liệu này đã trả lời.

## Quy trình chuẩn cho mọi task code

```
1. Đọc agent-docs/00-current-state.md (+ reference/ nếu cần hiểu nghiệp vụ)
2. Code
3. pnpm verify  (hoặc skill /verify) — PHẢI pass trước khi coi là xong
4. Nếu thay đổi ảnh hưởng agent-docs/ hoặc .claude/skills/ → chạy skill /sync-agent-docs
5. Báo kết quả cho user
```

**Bước 4 không tùy chọn khi có ảnh hưởng thật** — thêm/xóa module, đổi API, sửa Prisma schema, thêm dependency lớn, đổi convention... đều phải đồng bộ lại tài liệu ngay, đừng để dồn lại "làm sau". Xem đầy đủ điều kiện & cách làm tại [`.claude/skills/sync-agent-docs/SKILL.md`](./.claude/skills/sync-agent-docs/SKILL.md). Nếu task không ảnh hưởng gì đến docs (fix bug nhỏ, đổi text UI...), bỏ qua bước này.

## Nguyên tắc quan trọng khi làm việc trên repo này

- **Không tự chế nghiệp vụ.** Mọi hành vi (RBAC, luồng webhook, cách tính quota, luồng Cas Link...) đã được đặc tả rất chi tiết trong `agent-docs/reference/`. Nếu chưa chắc, đọc lại tài liệu trước khi đoán.
- **2 webhook khác nhau, đừng nhầm:** `POST /api/v1/webhook/cas` (nghiệp vụ, Cas Balance Hook, 1 URL chung cho toàn app, routing qua `grantId`) vs `POST /api/v1/webhook/payos-billing` (billing, PayOS, routing qua `orderCode`). Xem [`reference/business-overview.md`](./agent-docs/reference/business-overview.md) mục Webhook.
- **4 role RBAC:** `cas_partner` (system-level, `tenant_id = NULL`, chỉ được gọi `/partner/*`) / `admin` / `accountant` / `viewer`. Mọi endpoint nghiệp vụ mới phải tra bảng phân quyền trong [`reference/rbac.md`](./agent-docs/reference/rbac.md) trước khi gắn `@Roles()`.
- **Đa tenant:** hầu hết bảng có `tenant_id`. Mọi query nghiệp vụ phải scope theo `tenant_id` của user hiện tại (trừ route `/partner/*`).
- **AI không tự train model** — toàn bộ AI chạy qua OpenAI API (chat `gpt-4o-mini` + embedding `text-embedding-3-small`) + pgvector, không có ML infra riêng.
- **Idempotency trước, quota sau:** khi xử lý webhook Cas, luôn check Redis idempotency (theo `transaction.id`) trước khi đếm quota — tránh đếm trùng khi Cas retry.
- **Chuẩn kế toán TT133** — Thông tư 133/2016/TT-BTC cho SME, khoảng 60–70 tài khoản, seed sẵn khi tenant đăng ký. Threshold confidence mặc định **85%** — dưới ngưỡng → Human Review queue.
- Toàn bộ text UI, message lỗi, tên nghiệp vụ dùng **tiếng Việt** (đúng theo `ui-design.md`), code (biến, hàm, comment) dùng tiếng Anh theo chuẩn thông thường.

## Lệnh thường dùng (chạy từ root)

```bash
pnpm install              # cài toàn bộ workspace
pnpm dev                  # chạy tất cả app ở dev mode (turbo run dev)
pnpm dev:backend          # chỉ chạy backend
pnpm dev:frontend         # chỉ chạy frontend
pnpm build                # build toàn bộ
pnpm lint                 # lint + format toàn bộ (Biome, tự fix được phần lớn)
pnpm test                 # test toàn bộ
pnpm type-check           # type-check toàn bộ
pnpm verify                # lint + type-check + test + build — CHẠY LỆNH NÀY sau mọi lần sửa code, trước khi báo task xong (xem skill verify)
```

**Sau khi sửa code, luôn chạy `pnpm verify` (hoặc dùng skill `/verify`) trước khi coi task là hoàn thành** — không tự cho là đúng chỉ vì đọc lại code thấy ổn.

Repo dùng **Biome** (không dùng ESLint/Prettier/oxlint) cho cả lint và format, cấu hình tại `biome.json` ở root, áp dụng chung cho mọi package.

Chi tiết đầy đủ về cấu trúc thư mục, cách thêm app/package mới — xem [`agent-docs/01-monorepo-structure.md`](./agent-docs/01-monorepo-structure.md).

## Agent skills

### Issue tracker

Issues sống trong GitHub Issues (`lengocanh2005it/xcash-ai`), thao tác qua `gh` CLI; PR ngoài cũng được `/triage` gom vào cùng hàng đợi labels/states như issue. Xem [`docs/agents/issue-tracker.md`](./docs/agents/issue-tracker.md).

### Triage labels

Dùng đúng 5 nhãn mặc định: `needs-triage`, `needs-info`, `ready-for-agent`, `ready-for-human`, `wontfix`. Xem [`docs/agents/triage-labels.md`](./docs/agents/triage-labels.md).

### Domain docs

Single-context — thay vì `CONTEXT.md`/`docs/adr/` chung, repo dùng sẵn `agent-docs/` (đặc biệt `agent-docs/reference/`) làm nguồn sự thật nghiệp vụ. Xem [`docs/agents/domain.md`](./docs/agents/domain.md).
