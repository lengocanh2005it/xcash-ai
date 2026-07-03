# Current State — Đọc file này ĐẦU TIÊN

> Mục đích: cho biết **chính xác** cái gì đã tồn tại trong repo ngay lúc này, để agent không cần `find`/`grep`/`ls` lại từ đầu mỗi session mới. File này phải được cập nhật mỗi khi có thay đổi cấu trúc đáng kể (thêm module, thêm page, đổi dependency lớn, thêm service hạ tầng). Nếu file này và thực tế code lệch nhau, **tin thực tế code**, và sửa lại file này ngay sau đó.

Cập nhật lần cuối: **Sprint 2 Klassi AI pivot — backend + frontend refactor HOÀN THÀNH, migration đã apply.**

---

## Repo đang ở giai đoạn nào

**Trạng thái: Klassi AI pivot HOÀN THÀNH — toàn bộ backend và frontend đã được refactor sang Klassi AI (TT133 định khoản tự động). Migration `klassi_ai_pivot` đã apply thành công trên dev DB.**

**Đã xong:**
- Auth, Onboarding (Cas Link), Banking webhook, Transaction module ✅
- AI module: `classification.service` + `classification.processor` (ai-classify job, TT133, pgvector few-shot) ✅
- `chart-of-accounts` module: CRUD + seed TT133 (~60 tài khoản) on tenant register ✅
- `classification` module: Human Review queue (confirm/correct/skip) ✅
- `report` module: tổng hợp thu/chi + export Excel ✅
- Migration `klassi_ai_pivot`: bỏ invoices/customers/invoice_matches, thêm chart_of_accounts/transaction_classifications ✅
- Frontend: Dashboard (stat cards Klassi), Transactions (TK Nợ/Có), ReviewPage, ReportsPage, AccountsPage ✅
- Sidebar: Klassi AI branding, nav items mới (Human Review / Báo cáo / Danh mục TK) ✅
- shared-types: `MATCHED` → `CLASSIFIED`, thêm `ClassificationType`, `AccountType` ✅

**Chưa làm (Sprint 3+):**
- AI Copilot (hỏi đáp tự nhiên)
- Partner Dashboard
- Deploy VPS thật (hoãn Sprint 4)
- Cash Flow Forecasting (Sprint 3)

---

## Cây file thực tế toàn repo (không tính `node_modules`, `.git`, `.turbo`)

```
klassi-ai/                                     ← root repo (tên folder vẫn là klassi-ai trên disk)
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
│       ├── business-overview.md               ← Klassi AI ✅
│       ├── rbac.md                            ← Klassi AI ✅
│       ├── database-schema.md                 ← Klassi AI ✅
│       ├── user-journey.md                    ← Klassi AI ✅
│       ├── ui-design.md                       ← Klassi AI ✅
│       └── sprint-plan.md                     ← Klassi AI ✅
├── apps/
│   ├── backend/
│   │   ├── .env.example
│   │   ├── prisma/
│   │   │   ├── schema.prisma                  # Klassi AI schema ✅
│   │   │   └── migrations/
│   │   │       ├── 20260301120000_init_sprint1_week1/
│   │   │       ├── 20260702032642_add_cas_grant_account_holder_name/
│   │   │       ├── 20260702080000_add_cas_grant_bank_logo/
│   │   │       └── 20260703041453_klassi_ai_pivot/   ← migration đã apply ✅
│   │   ├── package.json
│   │   ├── nest-cli.json
│   │   ├── .swcrc
│   │   └── src/
│   │       ├── main.ts
│   │       ├── app.module.ts                  # imports: Auth, Cas, Health, Onboarding, Banking, Ai, ChartOfAccounts, Classification, Report, Transaction
│   │       ├── config/configuration.ts        # thêm AI_CLASSIFICATION_THRESHOLD (default 85)
│   │       ├── common/
│   │       │   ├── decorators/                # @Roles() dùng Role từ @klassi/shared-types
│   │       │   ├── guards/auth.guards.ts
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
│   │           ├── ai/                        # openai.service, embedding.service, classification.service, classification.processor ✅
│   │           ├── chart-of-accounts/         # CRUD + seedTt133() ✅
│   │           │   ├── chart-of-accounts.controller.ts
│   │           │   ├── chart-of-accounts.service.ts
│   │           │   ├── chart-of-accounts.module.ts
│   │           │   ├── tt133-seed.ts          # ~60 tài khoản TT133
│   │           │   └── dto/account.dto.ts
│   │           ├── classification/            # Human Review queue ✅
│   │           │   ├── classification.controller.ts
│   │           │   ├── classification.service.ts
│   │           │   ├── classification.module.ts
│   │           │   └── dto/review.dto.ts
│   │           ├── report/                    # Tổng hợp + export Excel ✅
│   │           │   ├── report.controller.ts
│   │           │   ├── report.service.ts
│   │           │   └── report.module.ts
│   │           ├── cas/
│   │           ├── health/
│   │           ├── onboarding/
│   │           └── transaction/               # GET list (kèm classification) + detail ✅
│   └── frontend/
│       ├── vite.config.ts
│       ├── package.json
│       └── src/
│           ├── main.tsx
│           ├── App.tsx                        # routes: dashboard, transactions, review, reports, accounts ✅
│           ├── contexts/auth-context.tsx
│           ├── contexts/theme-context.tsx
│           ├── routes/ProtectedRoute.tsx
│           ├── lib/
│           │   ├── api.ts                     # export: api (axios instance), getApiData, postApiData
│           │   ├── dashboard-transactions.ts  # CLASSIFIED (không còn MATCHED), buildDashboardOverviewStats mới
│           │   └── ...
│           ├── components/
│           │   ├── layout/Sidebar.tsx         # Klassi AI branding, nav: Dashboard/Giao dịch/Human Review/Báo cáo/Danh mục TK ✅
│           │   ├── dashboard/                 # stat cards, charts ✅
│           │   ├── shared/                    # TransactionStatusBadge (CLASSIFIED), ConfidenceBadge ✅
│           │   └── ui/
│           ├── pages/
│           │   ├── auth/                      # LoginPage, RegisterPage ✅
│           │   ├── onboarding/                # OnboardingPage, OnboardingCallbackPage ✅
│           │   ├── dashboard/DashboardPage.tsx # stat cards: định khoản hôm nay / chờ AI / chờ review / độ chính xác ✅
│           │   ├── transactions/              # TransactionsPage (cột TK Nợ/Có) + TransactionDetailSheet (hiển thị định khoản) ✅
│           │   ├── review/ReviewPage.tsx      # Human Review queue (confirm/correct/skip) ✅
│           │   ├── reports/ReportsPage.tsx    # Báo cáo tháng + export Excel ✅
│           │   ├── accounts/AccountsPage.tsx  # Danh mục TK TT133 ✅
│           │   └── partner/PartnerPage.tsx
│           ├── hooks/
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

**Dependencies đáng chú ý:** `xlsx` (export Excel), `openai`, `bullmq`, `@nestjs/bullmq`, `@prisma/client ^6`, `@klassi/shared-types`.

**Build:** NestJS SWC builder. `@Roles()` decorator nhận `Role` từ `@klassi/shared-types` (không phải `@prisma/client`) — quan trọng, dùng sai sẽ lỗi type.

---

## Lưu ý kỹ thuật quan trọng

- **`api` export từ `@/lib/api`** — axios instance tên `api` (không phải `apiClient`). Dùng `api.get()`, `api.post()` trong các page mới.
- **`TableSkeleton` props:** `rows` và `columns` (không phải `cols`).
- **`@Roles()` decorator:** nhận `Role` từ `@klassi/shared-types`, enum value là `Role.ADMIN`, `Role.ACCOUNTANT` (UPPERCASE) — không phải `Role.admin`.
- **AI job name:** `ai-classify` (không còn `ai-matching`). Constant `AI_CLASSIFY_JOB` export từ `classification.processor.ts`.
- **Threshold mặc định:** 85% (config key `AI_CLASSIFICATION_THRESHOLD`). Dưới ngưỡng → status = `review`.
- **TT133 seed:** tự động chạy sau khi tạo tenant (`auth.service.ts` gọi `chartOfAccountsService.seedTt133()` sau `$transaction`). Non-blocking (`.catch(() => {})`).
- **pgvector few-shot:** `embedding.service.ts` → `findSimilarClassifications()` trả về 5 ví dụ gần nhất của tenant để feed vào OpenAI prompt.

---

## Quy tắc giữ file này luôn đúng

- Cập nhật ngay sau khi thêm module mới, thêm page, đổi dependency lớn, migrate schema
- Nếu thực tế code lệch với file này → tin thực tế code, sửa file này
- Đây là file duy nhất agent đọc đầu tiên — phải đủ đọc xong là biết bước tiếp theo
