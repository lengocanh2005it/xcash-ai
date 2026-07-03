# 📅 X-Cash AI — Sprint Plan

**Tổng thời gian:** ~4 sprints (mỗi sprint 2 tuần) còn lại sau pivot
**Mục tiêu cuối:** Demo được hệ thống X-Cash AI với kế toán SME: nhận GD → AI định khoản → kế toán confirm → export Excel

---

## 📊 Tổng quan

| Sprint | Tuần | Mục tiêu | Demo được |
|---|---|---|---|
| Sprint 1 | 1–2 | Foundation (đã xong ✅) | Auth, Cas Link, Webhook, Transactions |
| Sprint 2 | 3–6 | **X-Cash AI Pivot** — refactor backend + UI mới | AI định khoản hoạt động, Review queue, Export Excel |
| Sprint 3 | 7–8 | Analytics, AI Copilot, Settings | Báo cáo đầy đủ, hỏi đáp AI |
| Sprint 4 | 9–10 | Partner Dashboard + Polish + Deploy | System production-ready |

---

## ✅ Sprint 1 — Foundation (ĐÃ XONG)

Tất cả đã hoàn thành:
- Auth (register/login/refresh/logout/me) — JWT + refresh cookie Redis-backed
- RBAC: `cas_partner`/`admin`/`accountant`/`viewer`, RolesGuard, PartnerGuard
- Cas SDK + Cas Link (Grant/Exchange flow, sandbox thật)
- Webhook `POST /webhook/cas` — HMAC verify, idempotency Redis, quota, save transaction, BullMQ enqueue
- Transaction module — list + detail tenant-scoped
- Frontend: Auth UI, Onboarding Cas Link, Dashboard, Transactions, dark/light mode, responsive

---

## 🔄 Sprint 2 — X-Cash AI Pivot

**Tuần 3–4 (Anh — Backend)**

### Anh: Backend Refactor

**Tuần 3 — Schema + Classification Core:**

- [ ] Prisma: xóa Invoice, Customer, InvoiceMatch tables; thêm ChartOfAccount, TransactionClassification
- [ ] Migration mới (`klassi_pivot_schema`)
- [ ] Xóa `invoice` module, `customer` module
- [ ] `chart-of-accounts` module:
  - `GET /accounts` — list (tenant-scoped)
  - `POST /accounts` — thêm tài khoản con
  - `PUT /accounts/:id` — sửa
  - `DELETE /accounts/:id` — soft delete
  - Seed TT133 (~60 tài khoản) khi tenant đăng ký (hook vào auth/register flow)
- [ ] Refactor `ai` module:
  - Đổi BullMQ job từ `ai-matching` → `ai-classify`
  - Đầu vào: `transaction` (content, amount, direction)
  - Text preprocessing (chuẩn hóa nội dung GD tiếng Việt)
  - pgvector: tìm 5 phân loại cũ tương tự của tenant (few-shot)
  - OpenAI `gpt-4o-mini` — prompt TT133, trả `{debit, credit, confidence, reason}`
  - Confidence ≥ 85% → auto classify; < 85% → status=review
  - Lưu vào `transaction_classifications`
  - Embedding content → lưu vector (để future few-shot tốt hơn)
- [ ] Update `banking` module: enqueue `ai-classify` thay vì `ai-matching`
- [ ] `GET /transactions/:id/classification` — kết quả phân loại

**Tuần 4 — Review + Report:**

- [ ] `classification` module / review sub-resource:
  - `GET /review/queue` — list GD status=review (tenant-scoped, pagination)
  - `POST /review/:id/confirm` — xác nhận, status → classified
  - `POST /review/:id/correct` — sửa debit/credit, status → classified, lưu correction vector
  - `POST /review/:id/skip` — bỏ qua, status → skipped
- [ ] `report` module:
  - `GET /reports/summary?year=&month=` — tổng thu/chi theo tháng group by account
  - `GET /reports/by-account?from_date=&to_date=` — chi tiết từng tài khoản
  - `GET /reports/export?from_date=&to_date=` — export Excel `.xlsx` (StreamableFile)
- [ ] Update `shared-types`: types cho Classification, ChartOfAccount, Report
- [ ] Tests: `ai.service.spec.ts` (mocked OpenAI), `classification.service.spec.ts`

---

**Tuần 5–6 (Vinh — Frontend)**

### Vinh: Frontend Refactor

**Tuần 5 — Dashboard + Transactions mới:**

- [ ] Sidebar: xóa nav Hóa đơn/Khách hàng; thêm Review Queue, Báo cáo, Tài khoản
- [ ] Dashboard stat cards mới:
  - GD đã định khoản hôm nay
  - GD chờ review
  - Độ chính xác AI (%)
  - Tổng thu-chi tháng này
- [ ] Dashboard chart: biểu đồ thu-chi theo tuần (Recharts AreaChart, groupBy account_type revenue/expense)
- [ ] Transactions page: hiển thị nhãn định khoản (TK Nợ / TK Có badge), confidence, reason
- [ ] TransactionDetailSheet: thay "AI match hóa đơn" bằng "Định khoản: Nợ xxx / Có xxx", lý do AI, nút sửa nhanh

**Tuần 6 — Review + Report + Chart of Accounts:**

- [ ] `ReviewPage` (`/review`):
  - Feed card từng GD cần review
  - Card hiển thị: nội dung GD, số tiền, AI gợi ý Nợ/Có, confidence, lý do
  - 3 nút action: Xác nhận / Sửa / Bỏ qua
  - Dialog sửa: dropdown chọn TK Nợ + TK Có từ chart_of_accounts
  - Sau action → remove card khỏi queue (optimistic update)
- [ ] `ReportsPage` (`/reports`):
  - Bộ lọc tháng/năm
  - Bảng tổng hợp thu/chi theo tài khoản
  - Nút Export Excel
- [ ] `AccountsPage` (`/accounts`):
  - Cây tài khoản TT133 đã seed
  - Thêm/sửa tài khoản con (Dialog)
- [ ] App.tsx: thêm routes mới, xóa routes cũ (invoices, customers)

---

## 🔮 Sprint 3 — Analytics + AI Copilot + Settings

**Tuần 7–8**

### Anh:

- [ ] AI Copilot endpoint — `POST /chat` — natural language query về tài chính
  - Input: câu hỏi tiếng Việt ("Tháng này tôi chi nhiều nhất vào đâu?")
  - AI tổng hợp từ `transaction_classifications` → trả lời có số liệu
- [ ] Advanced reports: so sánh tháng này vs tháng trước, top 5 danh mục chi nhiều nhất
- [ ] Notification: push khi có GD mới cần review (webhook → realtime qua SSE/polling)

### Vinh:

- [ ] Settings page: Threshold confidence (slider 50–99%), invite team member, liên kết ngân hàng
- [ ] AI Copilot chat bubble (floating, gợi ý query mẫu)
- [ ] Analytics dashboard: so sánh tháng, top categories chart
- [ ] Mobile polish: touch actions trên Review card (swipe confirm/skip)

---

## 🚀 Sprint 4 — Partner Dashboard + Deploy

**Tuần 9–10**

### Anh:

- [ ] Partner Dashboard API (`/partner/*`) — xem toàn bộ tenant, usage stats, AI accuracy global
- [ ] Rate limiting nâng cao (per-tenant, per-minute)
- [ ] Production env vars + Docker build pipeline
- [ ] SSL/HTTPS + nginx config production

### Vinh:

- [ ] PartnerPage hoàn chỉnh — table tenant, stats, usage
- [ ] Onboarding welcome tour (intro steps cho kế toán mới)
- [ ] Final QA: E2E test toàn bộ luồng (register → Cas Link → nhận GD → AI classify → review → export)
- [ ] Deploy VPS thật (GitHub Actions `deploy.yml`)

---

## 📋 Ghi chú phân công

| Task | Ai làm |
|---|---|
| Tất cả backend module mới (classification, chart-of-accounts, report) | Anh |
| Refactor AI pipeline (matching → classify) | Anh |
| Tất cả frontend pages mới (Review, Reports, Accounts) | Vinh |
| Frontend refactor (Dashboard, Transactions, Sidebar) | Vinh |
| Schema migration + seed data | Anh |
| shared-types update | Anh (FE dùng theo) |
| DevOps + Docker + CI | Vinh |

---

## 🎯 Definition of Done cho mỗi feature

1. `pnpm verify` pass (lint + type-check + test + build)
2. Test unit cho service method mới (mocked dependencies)
3. Swagger docs cập nhật (NestJS swagger decorators)
4. `agent-docs/00-current-state.md` cập nhật
5. Demo được trên localhost với data thật từ Cas sandbox
