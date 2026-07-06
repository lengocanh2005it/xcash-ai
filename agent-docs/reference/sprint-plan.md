# 📅 X-Cash AI — Sprint Plan

**Tổng thời gian:** ~4 sprints (mỗi sprint 2 tuần) còn lại sau pivot
**Mục tiêu cuối:** Demo được hệ thống X-Cash AI với kế toán SME: nhận GD → AI định khoản → kế toán confirm → export Excel

> **Cập nhật trạng thái (đồng bộ code):** Sprint 1–3 hoàn thành. Sprint 4 — **toàn bộ feature code + polish UX/Copilot đã xong**; còn lại DevOps (deploy production) + E2E QA thủ công. Chi tiết thực tế xem [`agent-docs/00-current-state.md`](../00-current-state.md).

---

## 📊 Tổng quan

| Sprint | Tuần | Mục tiêu | Trạng thái |
|---|---|---|---|
| Sprint 1 | 1–2 | Foundation | ✅ Xong |
| Sprint 2 | 3–6 | X-Cash AI Pivot — refactor backend + UI mới | ✅ Xong |
| Sprint 3 | 7–8 | Analytics, AI Copilot, Settings | ✅ Xong |
| Sprint 4 | 9–10 | Partner Dashboard + Polish + Deploy | 🔄 Code xong — còn deploy + QA |

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

## ✅ Sprint 2 — X-Cash AI Pivot (ĐÃ XONG)

**Tuần 3–4 (Backend):**

- [x] Prisma: xóa Invoice, Customer, InvoiceMatch; thêm ChartOfAccount, TransactionClassification
- [x] Migration `klassi_ai_pivot` (tên lịch sử)
- [x] Xóa `invoice` module, `customer` module
- [x] `chart-of-accounts` module — CRUD + seed TT133 khi đăng ký
- [x] Refactor `ai` module — job `ai-classify`, pgvector few-shot, OpenAI TT133 prompt
- [x] Update `banking` module — enqueue `ai-classify`
- [x] `GET /transactions/:id/classification`

**Tuần 4 — Review + Report:**

- [x] `classification` module — review queue (confirm/correct/skip)
- [x] `report` module — summary, by-account, export Excel
- [x] Update `shared-types`
- [x] Tests: classification service

**Tuần 5–6 (Frontend):**

- [x] Sidebar — Review Queue, Báo cáo, Tài khoản
- [x] Dashboard stat cards + charts mới
- [x] Transactions — TK Nợ/Có, confidence, reason
- [x] TransactionDetailSheet — định khoản AI
- [x] `ReviewPage`, `ReportsPage`, `AccountsPage`
- [x] Routes mới trong `App.tsx`

---

## ✅ Sprint 3 — Analytics + AI Copilot + Settings (ĐÃ XONG)

**Backend:**

- [x] `POST /ai/copilot` — natural language query tài chính
- [x] Advanced reports — `GET /reports/comparison`, `GET /reports/top-accounts`
- [x] Notification — in-app + SSE stream + email Resend (BullMQ); review badge qua `GET /review/count` (polling)

**Frontend:**

- [x] Settings page — Threshold, Notifications, Team, Banking, Billing
- [x] AI Copilot chat (`CopilotPage`) — sau đó migrate `runTools` + SSE streaming (Sprint 4 polish)
- [x] Analytics dashboard (`AnalyticsPage`)
- [x] Mobile polish — `SwipeableReviewCard` trên Review

---

## 🔄 Sprint 4 — Partner Dashboard + Deploy

### Đã xong (code feature)

**Anh — Backend:**

- [x] Partner Dashboard API — `GET /partner/tenants` (paginate optional), `GET /partner/stats`, `GET /partner/tenants/:id`, `GET /partner/revenue-trend`, `GET /partner/payments`, `GET /partner/audit-logs`, `PATCH /partner/tenants/:id/suspend|activate|plan`, `GET|PATCH /partner/plan-pricing`
- [x] Rate limiting per-tenant (`TenantThrottlerGuard`, `RATE_LIMIT_PER_MINUTE`)
- [x] Billing PayOS — upgrade, webhook, overage billing, mock-confirm dev-only
- [x] Plan gating (`PlanGuard`, `@RequiresPlan`)
- [x] Notification module — in-app, email, Slack webhook (per-tenant URL trong Settings)
- [x] Auth security — OTP verify email, forgot/reset password, rememberMe

**Vinh — Frontend:**

- [x] Partner layout + pages — Dashboard, Tenants, Payments, Audit logs, Plans
- [x] Onboarding welcome tour (`WelcomeTour`)
- [x] Settings BillingTab — nâng cấp gói + QR + overage
- [x] `NotificationBell`, `PlanGate`, auth pages mới

**Polish — Copilot (Anh + Vinh, sau Sprint 3):**

- [x] Copilot Function Calling — `runTools` 8 tools + `search_casso_public` (Tavily, flag `COPILOT_CASSO_SEARCH_ENABLED`)
- [x] `POST /ai/copilot/stream` — SSE `activity`/`delta`/`done`; FE `fetch` + ReadableStream
- [x] `search_knowledge_base` (pgvector) thay FAQ tĩnh `get_cas_integration_help` trong factory
- [x] Hardening — SSE buffer TCP, `try/catch` stream sau `flushHeaders`, `resultsCapture` JSON path, `TOOL_ACTIVITIES` / `getStreamingActivityMeta`, Tavily singleton

**Polish — UX tenant + Partner (Vinh):**

- [x] Dashboard — stat cards từ `/reports/summary` + count API (không derive từ `limit=100`); cards clickable; CTA liên kết NH khi chưa onboarding
- [x] `GET /partner/tenants` paginated — `PartnerTenantsPage` 20/trang; Dashboard gọi full list cho MRR/plan pie
- [x] Review queue poll 15s; validate TK Nợ/Có `^\d{3,4}$`; Transactions đọc `?status=` từ URL
- [x] Shared `plan-labels`, `types/partner`, `useSidebarCollapsed`, `ErrorBoundary` bọc routes
- [x] Partner Dashboard hint MRR/plan khi lọc ngày; Accounts search; NotificationBell confirm xóa tất cả

### Chưa xong (DevOps + QA)

**Anh:**

- [ ] Production env vars đầy đủ trong `docker-compose.yml` (OpenAI, Resend, PayOS, v.v.)
- [ ] SSL/HTTPS + nginx config production (domain thật, certbot)
- [ ] Deploy VPS thật qua GitHub Actions `deploy.yml` + secrets

**Vinh:**

- [ ] Final E2E QA thủ công toàn luồng (register → verify email → Cas Link → webhook → AI → review → export → billing)
- [ ] Test Slack + Resend email trên môi trường có key thật (Pro+ tenant)

### Tùy chọn (không chặn go-live)

- [ ] Partner API phụ theo spec gốc: `GET /partner/revenue`, `GET /partner/revenue/:tenantId`, `GET /partner/system-health` (một phần đã gộp vào `/partner/stats`, `/partner/revenue-trend`, `/partner/payments`; `GET /partner/audit-logs` **đã có**)

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
