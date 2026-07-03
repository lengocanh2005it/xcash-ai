# Current State — Đọc file này ĐẦU TIÊN

> Mục đích: cho biết **chính xác** cái gì đã tồn tại trong repo ngay lúc này, để agent không cần `find`/`grep`/`ls` lại từ đầu mỗi session mới. File này phải được cập nhật mỗi khi có thay đổi cấu trúc đáng kể (thêm module, thêm page, đổi dependency lớn, thêm service hạ tầng). Nếu file này và thực tế code lệch nhau, **tin thực tế code**, và sửa lại file này ngay sau đó.

Cập nhật lần cuối: **Sprint 4 — phần code (Partner Dashboard, rate limiting, onboarding tour) đã xong. Deploy VPS thật/SSL/nginx production CHƯA làm (hoãn, cần môi trường thật ngoài phạm vi code).**

---

## Repo đang ở giai đoạn nào

**Trạng thái: Sprint 3 HOÀN THÀNH toàn bộ. Sprint 4 — Partner Dashboard (API + UI), rate limiting per-tenant/per-phút, onboarding welcome tour đã xong. Còn lại: Docker build pipeline production, SSL/nginx, deploy VPS thật, final E2E QA thủ công.**

**Đã xong (Sprint 1–2):**
- Auth, Onboarding (Cas Link), Banking webhook, Transaction module ✅
- AI module: `classification.service` + `classification.processor` (ai-classify job, TT133, pgvector few-shot) ✅
- `chart-of-accounts` module: CRUD + seed TT133 (~60 tài khoản) on tenant register ✅
- `classification` module: Human Review queue (confirm/correct/skip) ✅
- `report` module: tổng hợp thu/chi + export Excel ✅
- Migration `klassi_ai_pivot` (tên lịch sử): bỏ invoices/customers/invoice_matches, thêm chart_of_accounts/transaction_classifications ✅
- Frontend: Dashboard (stat cards X-Cash), Transactions (TK Nợ/Có), ReviewPage, ReportsPage, AccountsPage ✅
- Sidebar: X-Cash AI branding, nav items mới (Human Review / Báo cáo / Danh mục TK) ✅
- shared-types: `MATCHED` → `CLASSIFIED`, thêm `ClassificationType`, `AccountType` ✅

**Đã xong (Sprint 3):**
- Backend: `POST /ai/copilot` — AI Copilot chat có financial context real-time (doanh thu/chi phí/review count tháng hiện tại) ✅
- Backend: `settings` module — threshold (Prisma) + notifications (Redis key `settings:notifications:{tenantId}`) ✅
- Backend: `team` module — invite/list/remove member, safety check (không xóa chính mình, không xóa admin cuối) ✅
- Backend: `billing` module — current-plan + usage-history ✅
- Backend: `report` module mở rộng — `GET /reports/comparison` (so tháng trước) + `GET /reports/top-accounts` (top 5 chi/thu) ✅
- Backend: `GET /review/count` — đếm số GD đang chờ review, dùng cho polling notification (không dùng SSE vì `EventSource` chuẩn không gửi được header `Authorization: Bearer`) ✅
- Frontend: `AnalyticsPage` (so sánh tháng, BarChart thu/chi, top 5 danh mục), `CopilotPage` (chat UI), `SettingsPage` (5 tab: Banking/Threshold/Notifications/Team/Billing) ✅
- Frontend: hook `useReviewCount` (poll 20s) → Sidebar hiện badge đỏ + toast khi review count tăng ✅
- Frontend: `ReviewPage` — thêm `SwipeableReviewCard` cho mobile (vuốt phải confirm / vuốt trái skip), giữ bảng cũ cho desktop ✅
- Frontend: ShadCN components mới — `progress.tsx`, `separator.tsx`, `switch.tsx`, `tabs.tsx` (dùng `radix-ui` umbrella package, pattern giống `select.tsx` — KHÔNG dùng `@radix-ui/react-*` riêng lẻ) ✅
- Sidebar: bật đủ 8 nav items (`/analytics`, `/copilot`, `/settings`), bỏ block "Sắp ra mắt" ✅

**Đã xong (Sprint 4 — phần code):**
- Backend: `partner` module — `GET /partner/tenants` (danh sách + plan/status/GD tháng/doanh thu), `GET /partner/stats` (tổng DN/active/suspended/GD tháng/doanh thu/AI accuracy toàn hệ thống), `GET /partner/revenue-trend` (doanh thu 6 tháng, đọc từ `payment_orders` status=paid), `PATCH /partner/tenants/:id/suspend`, `PATCH /partner/tenants/:id/activate` — dùng `PartnerGuard` có sẵn ✅
- Backend: bảng `plan_pricing` (mới) + `GET /partner/plan-pricing`, `PATCH /partner/plan-pricing/:plan` — Cas Partner chỉnh giá/quota Starter trở lên, Free luôn cố định 0đ/50GD. Đây là giá áp dụng cho lần nâng cấp tiếp theo, không hồi tố `subscriptions` đang active (snapshot giá riêng) ✅
- Backend: chặn login nếu subscription của tenant đang `suspended` (`auth.service.ts`) — hoàn thiện edge case đã ghi trong `rbac.md` ✅
- Backend: rate limiting per-tenant/per-phút bằng `@nestjs/throttler` — `TenantThrottlerGuard` (tracker = `tenantId`, fallback `userId`/IP), áp dụng global qua `APP_GUARD`, giới hạn cấu hình qua env `RATE_LIMIT_PER_MINUTE` (default 120) ✅
- Frontend: `PartnerPage` hoàn chỉnh — stat cards (tổng DN/active-suspended/doanh thu/AI accuracy), biểu đồ doanh thu 6 tháng (LineChart), tìm kiếm/lọc theo tên-trạng thái-gói, bảng tenant có nút Khóa/Mở khóa, section "Cài đặt giá gói dịch vụ" (sửa giá/quota/phí vượt Starter trở lên qua Dialog) ✅
- Frontend: `WelcomeTour` — dialog 4 bước giới thiệu luồng (Liên kết NH → AI định khoản → Human Review → Báo cáo/Copilot), hiện 1 lần cho mỗi user (`localStorage` key `xcash_welcome_tour_seen_{userId}`), gắn ở `DashboardPage` ✅
- **Kế hoạch chưa triển khai:** nâng cấp gói qua PayOS thật (chọn gói → thanh toán → webhook xác nhận) — xem [`reference/payos-billing-plan.md`](./reference/payos-billing-plan.md) mô tả đầy đủ 5 phase cần làm

**Chưa làm (Sprint 4 — còn lại):**
- Production env vars + Docker build pipeline, SSL/HTTPS + nginx config production
- Deploy VPS thật (GitHub Actions `deploy.yml`)
- Final E2E QA thủ công toàn luồng (register → Cas Link → nhận GD → AI classify → review → export)

---

## Cây file thực tế toàn repo (không tính `node_modules`, `.git`, `.turbo`)

```
paypilot-ai/                                   ← tên folder local có thể khác; repo GitHub: lengocanh2005it/xcash-ai (package npm: x-cash-ai)
├── .claude/skills/                            # 6 skills
├── .env.example
├── .github/workflows/
│   ├── ci.yml
│   └── deploy.yml
├── .husky/
├── docker-compose.yml                         # postgres + redis
├── docker/
│   ├── backend.Dockerfile
│   ├── frontend.Dockerfile
│   └── nginx-frontend.conf
├── deploy/
├── CLAUDE.md
├── agent-docs/
│   ├── README.md
│   ├── 00-current-state.md                    ← file này
│   ├── 01-monorepo-structure.md
│   ├── 02-backend-conventions.md
│   ├── 03-frontend-conventions.md
│   ├── 04-environment-setup.md
│   └── reference/
│       ├── business-overview.md               ← X-Cash AI ✅
│       ├── rbac.md                            ← X-Cash AI ✅
│       ├── database-schema.md                 ← X-Cash AI ✅
│       ├── user-journey.md                    ← X-Cash AI ✅
│       ├── ui-design.md                       ← X-Cash AI ✅
│       └── sprint-plan.md                     ← X-Cash AI ✅
├── apps/
│   ├── backend/
│   │   ├── .env.example
│   │   ├── prisma/
│   │   │   ├── schema.prisma                  # X-Cash AI schema ✅
│   │   │   └── migrations/
│   │   │       ├── 20260301120000_init_sprint1_week1/
│   │   │       ├── 20260702032642_add_cas_grant_account_holder_name/
│   │   │       ├── 20260702080000_add_cas_grant_bank_logo/
│   │   │       ├── 20260703041453_klassi_ai_pivot/   ← migration đã apply (tên lịch sử) ✅
│   │   │       └── 20260703091815_add_plan_pricing/  ← thêm bảng plan_pricing + seed giá mặc định ✅
│   │   ├── package.json
│   │   ├── nest-cli.json
│   │   ├── .swcrc
│   │   └── src/
│   │       ├── main.ts
│   │       ├── app.module.ts                  # imports: Auth, Cas, Health, Onboarding, Banking, Ai, ChartOfAccounts, Classification, Report, Transaction, Settings, Team, Billing, Partner; + ThrottlerModule + APP_GUARD (TenantThrottlerGuard)
│   │       ├── config/configuration.ts        # + RATE_LIMIT_PER_MINUTE (default 120)
│   │       ├── common/
│   │       │   ├── decorators/                # @Roles() dùng Role từ @xcash/shared-types
│   │       │   ├── guards/auth.guards.ts       # JwtAuthGuard, RolesGuard, PartnerGuard
│   │       │   ├── guards/tenant-throttler.guard.ts  # TenantThrottlerGuard (tracker = tenantId)
│   │       │   ├── filters/all-exceptions.filter.ts
│   │       │   ├── interceptors/response.interceptor.ts
│   │       │   ├── middleware/request-id.middleware.ts
│   │       │   └── types/authenticated-user.type.ts
│   │       ├── prisma/
│   │       ├── redis/
│   │       ├── queue/queue.module.ts
│   │       └── modules/
│   │           ├── auth/                      # register (seeds TT133 sau khi tạo tenant), login, refresh, logout, me ✅
│   │           ├── banking/                   # POST /webhook/cas → enqueue ai-classify ✅
│   │           ├── ai/                        # openai.service, embedding.service, classification.service, classification.processor, copilot.controller ✅
│   │           │   └── copilot.controller.ts  # POST /ai/copilot — chat, fetch financial context từ Prisma
│   │           ├── chart-of-accounts/         # CRUD + seedTt133() ✅
│   │           │   ├── chart-of-accounts.controller.ts
│   │           │   ├── chart-of-accounts.service.ts
│   │           │   ├── chart-of-accounts.module.ts
│   │           │   ├── tt133-seed.ts          # ~60 tài khoản TT133
│   │           │   └── dto/account.dto.ts
│   │           ├── classification/            # Human Review queue + review count ✅
│   │           │   ├── classification.controller.ts  # + GET /review/count
│   │           │   ├── classification.service.ts      # + getReviewCount()
│   │           │   ├── classification.module.ts
│   │           │   └── dto/review.dto.ts
│   │           ├── report/                    # Tổng hợp + export Excel + so sánh tháng + top accounts ✅
│   │           │   ├── report.controller.ts   # + GET /reports/comparison, /reports/top-accounts
│   │           │   ├── report.service.ts       # + getComparison(), getTopAccounts()
│   │           │   └── report.module.ts
│   │           ├── settings/                  # Threshold (Prisma) + Notifications (Redis) ✅
│   │           │   ├── settings.controller.ts
│   │           │   ├── settings.service.ts
│   │           │   ├── settings.module.ts
│   │           │   └── dto/settings.dto.ts
│   │           ├── team/                      # Invite/list/remove member ✅
│   │           │   ├── team.controller.ts
│   │           │   ├── team.service.ts
│   │           │   ├── team.module.ts
│   │           │   └── dto/team.dto.ts
│   │           ├── billing/                   # Current plan + usage history ✅
│   │           │   ├── billing.controller.ts
│   │           │   ├── billing.service.ts
│   │           │   └── billing.module.ts
│   │           ├── partner/                   # /partner/* — chỉ Cas Partner ✅
│   │           │   ├── partner.controller.ts
│   │           │   ├── partner.service.ts
│   │           │   ├── partner.module.ts
│   │           │   └── dto/plan-pricing.dto.ts
│   │           ├── cas/
│   │           ├── health/
│   │           ├── onboarding/
│   │           └── transaction/               # GET list (kèm classification) + detail ✅
│   └── frontend/
│       ├── vite.config.ts
│       ├── package.json
│       └── src/
│           ├── main.tsx
│           ├── App.tsx                        # routes: dashboard, transactions, review, reports, accounts, analytics, copilot, settings ✅
│           ├── contexts/auth-context.tsx
│           ├── contexts/theme-context.tsx
│           ├── routes/ProtectedRoute.tsx
│           ├── lib/
│           │   ├── api.ts                     # export: api (axios instance), getApiData, postApiData
│           │   ├── dashboard-transactions.ts  # CLASSIFIED (không còn MATCHED), buildDashboardOverviewStats mới
│           │   └── ...
│           ├── components/
│           │   ├── layout/Sidebar.tsx         # X-Cash AI branding, 8 nav item (đủ), badge đỏ + toast review count ✅
│           │   ├── dashboard/                 # stat cards, charts ✅
│           │   ├── shared/                    # TransactionStatusBadge (CLASSIFIED), ConfidenceBadge ✅
│           │   └── ui/                        # + progress.tsx, separator.tsx, switch.tsx, tabs.tsx (radix-ui umbrella) ✅
│           ├── pages/
│           │   ├── auth/                      # LoginPage, RegisterPage ✅
│           │   ├── onboarding/                # OnboardingPage, OnboardingCallbackPage ✅
│           │   ├── dashboard/DashboardPage.tsx # stat cards: định khoản hôm nay / chờ AI / chờ review / độ chính xác ✅
│           │   ├── transactions/              # TransactionsPage (cột TK Nợ/Có) + TransactionDetailSheet (hiển thị định khoản) ✅
│           │   ├── review/ReviewPage.tsx      # Human Review queue (confirm/correct/skip) + SwipeableReviewCard mobile ✅
│           │   ├── reports/ReportsPage.tsx    # Báo cáo tháng + export Excel ✅
│           │   ├── analytics/AnalyticsPage.tsx # So sánh tháng, BarChart thu/chi, top 5 danh mục ✅
│           │   ├── copilot/CopilotPage.tsx    # AI Copilot chat, gợi ý câu hỏi ✅
│           │   ├── settings/SettingsPage.tsx  # Tabs: Banking/Threshold/Notifications/Team/Billing ✅
│           │   ├── accounts/AccountsPage.tsx  # Danh mục TK TT133 ✅
│           │   └── partner/PartnerPage.tsx    # Stat cards, revenue chart, filter, bảng tenant, cài đặt giá gói ✅
│           ├── components/shared/WelcomeTour.tsx  # Dialog 4 bước, 1 lần/user (localStorage) ✅
│           ├── hooks/                          # + useReviewCount.ts (poll 20s /review/count)
│           └── types/transaction.ts           # thêm TransactionClassificationSummary, bỏ MatchCandidate ✅
├── packages/shared-types/src/index.ts        # TransactionStatus.CLASSIFIED (bỏ MATCHED), ClassificationType, AccountType ✅
├── biome.json, package.json, turbo.json, pnpm-workspace.yaml
```

---

## API endpoints hiện tại (prefix `/api/v1`)

### Đang chạy ✅

| Method | Path | Auth | Ghi chú |
|---|---|---|---|
| GET | `/health` | Public | Health check |
| POST | `/auth/register` | Public | Tạo tenant + admin + seed TT133 |
| POST | `/auth/login` | Public | JWT access + refresh cookie |
| POST | `/auth/refresh` | Cookie | Rotate tokens |
| POST | `/auth/logout` | Cookie | Revoke refresh |
| GET | `/auth/me` | Bearer JWT | User hiện tại |
| GET | `/cas/health` | Public | |
| POST | `/onboarding/banking/grant-token` | Admin, Accountant | |
| POST | `/onboarding/banking/callback` | Admin, Accountant | |
| GET | `/onboarding/status` | Bearer JWT | |
| POST | `/webhook/cas` | Public (signature) | → enqueue `ai-classify` |
| GET | `/transactions` | Bearer JWT | Kèm `classification` nested |
| GET | `/transactions/:id` | Bearer JWT | Kèm `classification` nested |
| GET | `/transactions/:id/classification` | Bearer JWT | Chi tiết định khoản |
| POST | `/transactions/:id/classification` | Admin, Accountant | Ghi đè thủ công |
| GET | `/review/queue` | Bearer JWT | Hàng chờ Human Review |
| GET | `/review/count` | Bearer JWT | Đếm số GD chờ review — FE poll 20s cho badge/toast |
| POST | `/review/:id/confirm` | Admin, Accountant | Xác nhận |
| POST | `/review/:id/correct` | Admin, Accountant | Sửa TK Nợ/Có |
| POST | `/review/:id/skip` | Admin, Accountant | Bỏ qua |
| GET | `/accounts` | Bearer JWT | Danh mục TT133 |
| POST | `/accounts` | Admin, Accountant | Thêm tài khoản |
| PUT | `/accounts/:id` | Admin, Accountant | Sửa tài khoản |
| DELETE | `/accounts/:id` | Admin | Ẩn tài khoản |
| GET | `/reports/summary` | Bearer JWT | Tổng hợp tháng |
| GET | `/reports/by-account` | Bearer JWT | Chi tiết theo TK |
| GET | `/reports/export` | Bearer JWT | Export Excel (.xlsx) |
| GET | `/reports/comparison` | Bearer JWT | So sánh tháng này vs tháng trước |
| GET | `/reports/top-accounts` | Bearer JWT | Top 5 TK chi/thu nhiều nhất |
| POST | `/ai/copilot` | Bearer JWT | AI Copilot chat, kèm financial context |
| GET | `/settings/threshold` | Admin, Accountant | Đọc threshold hiện tại |
| PUT | `/settings/threshold` | Admin | Cập nhật threshold (50–99) |
| GET | `/settings/notifications` | Admin | Đọc cấu hình notification (Redis) |
| PUT | `/settings/notifications` | Admin | Cập nhật cấu hình notification |
| GET | `/team/members` | Admin | Danh sách thành viên tenant |
| POST | `/team/members` | Admin | Mời thành viên mới (tạo trực tiếp, không gửi email) |
| DELETE | `/team/members/:id` | Admin | Xóa thành viên (chặn tự xóa / xóa admin cuối) |
| GET | `/billing/current-plan` | Admin, Accountant | Gói hiện tại |
| GET | `/billing/usage-history` | Admin | Lịch sử sử dụng quota |
| GET | `/partner/tenants` | Cas Partner | Danh sách toàn bộ tenant + plan/status/GD tháng/doanh thu |
| GET | `/partner/stats` | Cas Partner | Tổng DN/active/suspended/GD tháng/doanh thu/AI accuracy toàn hệ thống |
| GET | `/partner/revenue-trend` | Cas Partner | Doanh thu 6 tháng gần nhất (từ `payment_orders` status=paid) |
| PATCH | `/partner/tenants/:id/suspend` | Cas Partner | Khóa tài khoản doanh nghiệp |
| PATCH | `/partner/tenants/:id/activate` | Cas Partner | Mở khóa tài khoản doanh nghiệp |
| GET | `/partner/plan-pricing` | Cas Partner | Xem giá/quota từng gói |
| PATCH | `/partner/plan-pricing/:plan` | Cas Partner | Sửa giá/quota/phí vượt (chặn sửa `free`) |

Swagger UI: `http://localhost:3000/api/docs`

---

## Database schema (sau migration `klassi_ai_pivot`)

**Giữ nguyên:** `tenants`, `users`, `transactions`, `cas_grants`, `subscriptions`, `payment_orders`, `audit_logs`

**Đã xóa:** ~~`invoices`~~, ~~`customers`~~, ~~`invoice_matches`~~, ~~enum `InvoiceStatus`~~, ~~enum `MatchType`~~

**Đã thêm:**
```
chart_of_accounts
  id, tenant_id, account_code, account_name, account_type (AccountType enum),
  parent_code, is_active, created_at, updated_at
  unique: (tenant_id, account_code)

transaction_classifications
  id, tenant_id, transaction_id (unique FK → transactions),
  debit_account, credit_account, amount (Decimal),
  confidence_score (Int), classification_type (auto|manual),
  classified_by, reason, embedding (vector 1536),
  status (TransactionStatus), created_at, updated_at
```

**Đổi:**
- `tenants.matching_threshold` → `tenants.classification_threshold` (default 85)
- `TransactionStatus` enum: `matched` → `classified`
- `transactions`: bỏ cột `confidence_score`, thêm relation `classification`

---

## Nguyên văn `shared-types/src/index.ts`

```typescript
export enum Role {
  CAS_PARTNER = 'cas_partner',
  ADMIN = 'admin',
  ACCOUNTANT = 'accountant',
  VIEWER = 'viewer',
}

export enum TransactionStatus {
  PENDING = 'pending',
  CLASSIFIED = 'classified',
  REVIEW = 'review',
  SKIPPED = 'skipped',
}

export enum ClassificationType {
  AUTO = 'auto',
  MANUAL = 'manual',
}

export enum AccountType {
  ASSET = 'asset',
  LIABILITY = 'liability',
  EQUITY = 'equity',
  REVENUE = 'revenue',
  EXPENSE = 'expense',
}

// + CasGrantStatus, SubscriptionPlan, SubscriptionStatus, PaymentOrderStatus, ApiResponse<T>
```

---

## Scripts thật — root `package.json`

```
prepare      → husky
lint-staged  → biome check --write --no-errors-on-unmatched
```

---

## Scripts thật — `apps/backend/package.json`

```
prisma:generate  → prisma generate
prisma:migrate   → prisma migrate deploy
postinstall      → prisma generate
```

**Dependencies đáng chú ý:** `xlsx` (export Excel), `openai`, `bullmq`, `@nestjs/bullmq`, `@nestjs/throttler` (rate limiting per-tenant), `@prisma/client ^6`, `@xcash/shared-types`.

**Build:** NestJS SWC builder. `@Roles()` decorator nhận `Role` từ `@xcash/shared-types` (không phải `@prisma/client`) — quan trọng, dùng sai sẽ lỗi type.

---

## Lưu ý kỹ thuật quan trọng

- **`api` export từ `@/lib/api`** — axios instance tên `api` (không phải `apiClient`). Dùng `api.get()`, `api.post()` trong các page mới.
- **`TableSkeleton` props:** `rows` và `columns` (không phải `cols`).
- **`@Roles()` decorator:** nhận `Role` từ `@xcash/shared-types`, enum value là `Role.ADMIN`, `Role.ACCOUNTANT` (UPPERCASE) — không phải `Role.admin`.
- **AI job name:** `ai-classify` (không còn `ai-matching`). Constant `AI_CLASSIFY_JOB` export từ `classification.processor.ts`.
- **Threshold mặc định:** 85% (config key `AI_CLASSIFICATION_THRESHOLD`). Dưới ngưỡng → status = `review`.
- **TT133 seed:** tự động chạy sau khi tạo tenant (`auth.service.ts` gọi `chartOfAccountsService.seedTt133()` sau `$transaction`). Non-blocking (`.catch(() => {})`).
- **pgvector few-shot:** `embedding.service.ts` → `findSimilarClassifications()` trả về 5 ví dụ gần nhất của tenant để feed vào OpenAI prompt.
- **Notification realtime = polling, không phải SSE:** `EventSource` chuẩn của trình duyệt không gửi được custom header, mà JWT strategy hiện tại chỉ nhận `Authorization: Bearer` (xem `jwt.strategy.ts`, `ExtractJwt.fromAuthHeaderAsBearerToken()`). Nên `useReviewCount` hook dùng react-query `refetchInterval: 20_000` gọi `GET /review/count` qua axios (đã có sẵn interceptor gắn Bearer token) thay vì SSE.
- **ShadCN mới (Progress/Separator/Switch/Tabs) dùng `radix-ui` umbrella package**, KHÔNG dùng `@radix-ui/react-progress` v.v. riêng lẻ — dự án chỉ có `radix-ui` (^1.6.1) trong `package.json`, import theo pattern `import { Progress as ProgressPrimitive } from 'radix-ui'` giống `select.tsx` đã có sẵn. Chạy `pnpm dlx shadcn@latest add <name>` có thể ghi nhầm vào thư mục `@/` sai chỗ (alias resolve lỗi) — nếu gặp, viết file thủ công theo pattern của component ShadCN có sẵn trong repo (`select.tsx`) thay vì tin theo output CLI.
- **Team invite đơn giản hoá:** tạo user trực tiếp với password do Admin nhập, không gửi email thật (chỉ demo).
- **`dto.role as unknown as import('@prisma/client').Role`** — cast cần thiết trong `team.service.ts` vì `Role` từ `@xcash/shared-types` (dùng cho DTO/RBAC) không trùng type với `Role` enum của Prisma Client dù cùng giá trị string.
- **Rate limiting per-tenant:** `TenantThrottlerGuard` override `getTracker()` để dùng `tenantId` (fallback `userId` rồi IP) làm key thay vì mặc định theo IP — vì nhiều user cùng tenant có thể gọi API từ IP khác nhau, và Cas Partner (không có `tenantId`) vẫn cần giới hạn theo user. Áp dụng global qua `APP_GUARD`, bỏ qua `/health`. Giới hạn: `RATE_LIMIT_PER_MINUTE` (default 120 request/phút/tenant).
- **Tenant suspend chặn login:** `auth.service.ts` → `login()` tra `subscription` mới nhất theo `tenantId`, nếu `status === 'suspended'` thì từ chối đăng nhập luôn (không cho vào hệ thống dù JWT hợp lệ) — khớp edge case đã ghi trong `rbac.md`.

---

## Quy tắc giữ file này luôn đúng

- Cập nhật ngay sau khi thêm module mới, thêm page, đổi dependency lớn, migrate schema
- Nếu thực tế code lệch với file này → tin thực tế code, sửa file này
- Đây là file duy nhất agent đọc đầu tiên — phải đủ đọc xong là biết bước tiếp theo
