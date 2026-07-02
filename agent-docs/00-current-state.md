# Current State — Đọc file này ĐẦU TIÊN

> Mục đích: cho biết **chính xác** cái gì đã tồn tại trong repo ngay lúc này, để agent không cần `find`/`grep`/`ls` lại từ đầu mỗi session mới. File này phải được cập nhật mỗi khi có thay đổi cấu trúc đáng kể (thêm module, thêm page, đổi dependency lớn, thêm service hạ tầng). Nếu file này và thực tế code lệch nhau, **tin thực tế code**, và sửa lại file này ngay sau đó.

Cập nhật lần cuối: Sprint 1 **đã đóng** (07/2026) — smoke test E2E pass (Postman mock webhook); deploy VPS **hoãn Sprint 4**.

## Repo đang ở giai đoạn nào

**Trạng thái: Sprint 1 xong — sẵn sàng Sprint 2.** Backend: Onboarding, Banking webhook, Transaction list/detail. Frontend: React Router, TenantLayout, Auth, Onboarding Cas Link, Dashboard (Recharts + stat cards), Transactions list.

**Smoke test E2E đã pass (local):** Register → Cas Link (sandbox) → Postman mock `POST /webhook/cas` → Dashboard/Transactions hiển thị giao dịch thật. Webhook Cas Console / ngrok **không bắt buộc** khi dùng Postman gọi thẳng `localhost`.

**Chưa có (Sprint 2+):** AI matching pipeline, Invoice/Customer CRUD UI, Partner Dashboard đầy đủ.

**Hoãn Sprint 4:** deploy VPS thật + GitHub Secrets + HTTPS production (workflow `deploy.yml` + `deploy/README.md` đã có template, chưa chạy trên VPS).

## Cây file thực tế toàn repo (không tính `node_modules`, `.git`, `.turbo`)

```
paypilot-ai/
├── .claude/skills/                         # 6 skills (không đổi)
├── .env.example                            # tham chiếu đầy đủ — split sang từng app khi setup
├── .github/workflows/
│   ├── ci.yml                              # GitHub Actions: pnpm verify
│   └── deploy.yml                          # workflow_dispatch deploy VPS qua SSH
├── .dockerignore
├── .husky/                                 # pre-commit, pre-push
├── docker-compose.yml                      # postgres + redis (+ backend/frontend qua profile)
├── docker/
│   ├── backend.Dockerfile
│   ├── frontend.Dockerfile
│   └── nginx-frontend.conf
├── deploy/
│   ├── README.md                           # hướng dẫn deploy VPS
│   └── nginx/paypilot.conf
├── CLAUDE.md
├── agent-docs/                             # (không đổi cấu trúc)
├── apps/
│   ├── backend/
│   │   ├── .env.example                  # template backend (copy → .env)
│   │   ├── prisma/
│   │   │   ├── schema.prisma               # 11 bảng đầy đủ + pgvector extension
│   │   │   └── migrations/
│   │   │       ├── migration_lock.toml
│   │   │       └── 20260301120000_init_sprint1_week1/
│   │   ├── package.json                    # đã thêm NestJS deps, Prisma 6, bcryptjs, SWC
│   │   ├── nest-cli.json                   # builder: swc
│   │   ├── .swcrc                          # decoratorMetadata cho Nest DI
│   │   ├── src/
│   │   │   ├── main.ts                     # global prefix api/v1, Swagger, CORS, ValidationPipe, cookie-parser, rawBody: true (webhook signature)
│   │   │   ├── app.module.ts
│   │   │   ├── config/configuration.ts     # + WEBHOOK_* env vars
│   │   │   ├── common/
│   │   │   │   ├── decorators/           # @Roles(), @CurrentUser()
│   │   │   │   ├── guards/auth.guards.ts # JwtAuthGuard, RolesGuard, PartnerGuard
│   │   │   │   ├── filters/all-exceptions.filter.ts
│   │   │   │   ├── interceptors/response.interceptor.ts
│   │   │   │   ├── middleware/request-id.middleware.ts
│   │   │   │   └── types/authenticated-user.type.ts
│   │   │   ├── prisma/                   # PrismaModule + PrismaService (global)
│   │   │   ├── redis/                    # RedisModule + RedisService (global)
│   │   │   ├── queue/queue.module.ts     # BullMQ root + webhook-processing queue placeholder
│   │   │   └── modules/
│   │   │       ├── auth/                 # register, login, refresh, logout, me
│   │   │       ├── banking/              # POST /webhook/cas — signature, idempotency, quota, save transaction
│   │   │       ├── cas/                  # CasClientService (+ exchangeGrant, getIdentity) + health/ping
│   │   │       ├── health/               # GET /api/v1/health
│   │   │       ├── onboarding/           # grant-token, banking/callback, status
│   │   │       └── transaction/          # GET list + detail (tenant-scoped)
│   │   └── test/
│   │       ├── app.e2e-spec.ts
│   │       └── jest-setup.ts
│   └── frontend/
│       ├── vite.config.ts                  # Tailwind v4 + @ alias
│       ├── package.json                    # + react-router-dom, sonner, recharts
│       ├── src/
│       │   ├── main.tsx                    # QueryClientProvider
│       │   ├── App.tsx                     # React Router + AuthProvider + Toaster
│       │   ├── contexts/auth-context.tsx   # Auth state, login/register/logout, onboarding status
│       │   ├── contexts/theme-context.tsx  # dark/light mode (localStorage paypilot-theme)
│       │   ├── routes/ProtectedRoute.tsx   # GuestRoute, ProtectedRoute (onboarding gate)
│       │   ├── components/
│       │   │   ├── layout/                 # TenantLayout, Sidebar (collapse), Header, AuthLayout
│       │   │   ├── dashboard/              # BankStatusCard, TransactionTrendChart, TransactionStatusChart, RecentTransactionsCard
│       │   │   ├── shared/                 # ThemeToggle, SensitiveField
│       │   │   └── ui/                     # ShadCN: button, card, badge, input, skeleton, table, label, dialog
│       │   ├── pages/
│       │   │   ├── auth/                   # LoginPage, RegisterPage
│       │   │   ├── onboarding/             # OnboardingPage, OnboardingCallbackPage (Cas Link)
│       │   │   ├── dashboard/              # DashboardPage (Recharts: area 7 ngày + donut trạng thái)
│       │   │   ├── transactions/           # TransactionsPage
│       │   │   └── partner/                # PartnerPage placeholder (Sprint 3)
│       │   ├── hooks/useAuth.ts, useOnboarding.ts, useHealthCheck.ts
│       │   ├── lib/api.ts, casLink.ts, dashboard-transactions.ts, mask-sensitive.ts, errors.ts, utils.ts
│       │   └── types/auth.ts, onboarding.ts, transaction.ts
├── packages/shared-types/                  # build → dist/ (CommonJS)
├── biome.json, package.json, turbo.json, pnpm-workspace.yaml
```

## API endpoints đã có (prefix `/api/v1`)

| Method | Path | Auth | Ghi chú |
|---|---|---|---|
| GET | `/health` | Public | Health check |
| POST | `/auth/register` | Public | Tạo tenant + admin, set refresh cookie |
| POST | `/auth/login` | Public | JWT access + refresh cookie |
| POST | `/auth/refresh` | Cookie | Rotate tokens |
| POST | `/auth/logout` | Cookie | Revoke refresh |
| GET | `/auth/me` | Bearer JWT | User hiện tại |
| GET | `/cas/health` | Public | Kiểm tra Cas SDK config |
| GET | `/cas/ping` | Admin only | Gọi thử `POST /grant/token` — demo RBAC |
| POST | `/onboarding/banking/grant-token` | Admin, Accountant | Tạo grantToken mở Cas Link |
| POST | `/onboarding/banking/callback` | Admin, Accountant | Đổi publicToken → grantId, lưu `cas_grants` |
| GET | `/onboarding/status` | Bearer JWT (mọi role tenant) | Trạng thái onboarding tenant |
| POST | `/webhook/cas` | Public (signature) | Cas Balance Hook — **không JWT** |
| GET | `/transactions` | Bearer JWT | Danh sách giao dịch (filter + pagination) |
| GET | `/transactions/:id` | Bearer JWT | Chi tiết giao dịch (tenant-scoped) |

Swagger UI: `http://localhost:3000/api/docs`

## Nguyên văn `packages/shared-types/src/index.ts` hiện tại

(Không đổi — xem block cũ trong git history hoặc file trực tiếp.)

## Scripts thật — root `package.json` (thêm so với bootstrap)

```
prepare  → husky   (chạy sau pnpm install, gắn git hooks)
```

**devDependencies mới:** `husky ^9.1.7`, `lint-staged ^17.0.8`.

**`lint-staged`** (root): `*.{js,ts,tsx,json,jsonc,css}` → `biome check --write --no-errors-on-unmatched`.

## Scripts thật — `apps/backend/package.json` (thêm so với scaffold)

**Thêm so với scaffold:**
```
prisma:generate  → prisma generate
prisma:migrate   → prisma migrate deploy
postinstall      → prisma generate
```

**Dependencies mới chính:** `@nestjs/config`, `@nestjs/swagger`, `@nestjs/jwt`, `@nestjs/passport`, `@nestjs/bullmq`, `@prisma/client` ^6.8, `bcryptjs`, `bullmq`, `class-validator`, `class-transformer`, `cookie-parser`, `ioredis`, `passport`, `passport-jwt`, `@paypilot/shared-types`.

**DevDependencies mới:** `prisma` ^6.8, `@types/bcryptjs`, `@types/cookie-parser`, `@types/passport-jwt`, `@swc/core`, `@swc/cli`.

**Build:** `nest build` dùng **SWC** (`nest-cli.json` → `compilerOptions.builder: "swc"`, config `.swcrc`). Type-check vẫn qua `tsc --noEmit` riêng trong `pnpm verify` — SWC chỉ transpile, không thay type-check.

## Danh sách việc CHƯA làm

- [ ] AI matching pipeline (Sprint 2 tuần 3)
- [ ] Invoice / Customer CRUD (Sprint 2)
- [ ] Deploy VPS thật + HTTPS production (**hoãn Sprint 4** — xem `deploy/README.md`)

## Việc Sprint 1 đã đóng (07/2026)

- [x] Copy `.env` local + `docker compose up -d` + migrate (môi trường dev team)
- [x] Smoke test E2E: Register → Cas Link → Postman mock webhook → xem Transactions/Dashboard trên UI
- [x] GitHub Actions CI — `pnpm verify` trên push/PR

## Việc ĐÃ làm xong (mới so với bootstrap)

- [x] `docker-compose.yml` — PostgreSQL pgvector + Redis
- [x] `apps/backend/prisma/schema.prisma` — 11 bảng theo `database-schema.md`
- [x] Migration `20260301120000_init_sprint1_week1`
- [x] NestJS modular architecture: `common/`, `config/`, `prisma/`, `redis/`, `queue/`, `modules/auth|cas|health`
- [x] Auth: register/login/refresh/logout/me — JWT access + refresh HttpOnly cookie (Redis-backed)
- [x] RBAC: RolesGuard + PartnerGuard + `@Roles()` — Cas Partner bị chặn khỏi route nghiệp vụ
- [x] Cas SDK: `CasClientService` wrap HTTP với headers `x-client-id`, `x-secret-key`, `X-BankHub-Api-Version`
- [x] Redis + BullMQ configured (`webhook-processing` queue placeholder)
- [x] Swagger + global ValidationPipe + CORS + ApiResponse interceptor
- [x] Husky git hooks — pre-commit (`lint-staged` + `type-check`), pre-push (`pnpm verify`)
- [x] GitHub Actions CI — `.github/workflows/ci.yml` chạy `pnpm verify` trên push/PR tới `main`/`develop`
- [x] Frontend foundation (Vinh tuần 1): Tailwind v4, ShadCN/UI, TanStack Query, Axios (`lib/api.ts`), `@/` alias
- [x] Docker full stack — `docker-compose.yml` profiles `fullstack` (backend + frontend-dev) / `production` (backend + nginx frontend)
- [x] GitHub Actions deploy — `.github/workflows/deploy.yml` (workflow_dispatch, SSH)
- [x] Deploy docs + nginx template — `deploy/README.md`, `deploy/nginx/paypilot.conf`
- [x] `@paypilot/shared-types` build → `dist/` (CommonJS) — FE/BE import từ package exports
- [x] Onboarding module — Cas Link grant-token, banking/callback, status (`modules/onboarding/`)
- [x] Banking webhook — `POST /webhook/cas`: HMAC signature verify, Redis idempotency (txn id, TTL 24h), grant→tenant routing, free-plan quota block, save `transactions` + increment usage (`modules/banking/`)
- [x] Transaction module — `GET /transactions`, `GET /transactions/:id` với filter/pagination tenant-scoped (`modules/transaction/`)
- [x] `CasClientService` mở rộng — `exchangeGrant()`, `getIdentity()`, `parseIdentity()`
- [x] Test `banking.service.spec.ts` — idempotency, quota block, happy path, signature verify
- [x] Frontend tuần 2 (Vinh): React Router, TenantLayout (Sidebar + Header), Auth UI (Register/Login), Onboarding Cas Link (popup + `/onboarding/callback`), Dashboard + Transactions list
- [x] Dark/light mode toggle — `ThemeProvider` + `ThemeToggle` (Sidebar, Header, Auth layout), lưu `localStorage` key `paypilot-theme`
- [x] Responsive UI — mobile sidebar drawer + top bar (`lg` breakpoint), card list giao dịch trên mobile
- [x] Casso/payOS design system — primary `#16AB64`, nền `#FFFFFF`, surface `#F8FAFB` (`index.css`); docs: `03-frontend-conventions.md`, `ui-design.md` Brand palette, skill `new-page` bước 8
- [x] ShadCN/UI first — ưu tiên `@/components/ui/*`; thêm component qua `shadcn add`; docs [ui.shadcn.com/docs/components](https://ui.shadcn.com/docs/components); `table`, `label` đã có
- [x] `AuthProvider` + `ProtectedRoute`/`GuestRoute` — redirect theo auth + onboarding status
- [x] Dependencies FE mới: `react-router-dom`, `sonner` (toast)
- [x] Dashboard `GET /transactions?limit=100` (max BE); fix lỗi `limit=200` → 400
- [x] `RecentTransactionsCard` — nút "Xem tất cả" luôn ở đáy card (`mt-auto`)

## Quy tắc giữ file này luôn đúng

(Same as before — cập nhật khi cấu trúc thay đổi.)
