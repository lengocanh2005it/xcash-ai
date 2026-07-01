# Current State — Đọc file này ĐẦU TIÊN

> Mục đích: cho biết **chính xác** cái gì đã tồn tại trong repo ngay lúc này, để agent không cần `find`/`grep`/`ls` lại từ đầu mỗi session mới. File này phải được cập nhật mỗi khi có thay đổi cấu trúc đáng kể (thêm module, thêm page, đổi dependency lớn, thêm service hạ tầng). Nếu file này và thực tế code lệch nhau, **tin thực tế code**, và sửa lại file này ngay sau đó.

Cập nhật lần cuối: sau Sprint 1 tuần 1 — backend (Ngọc Anh) + frontend/DevOps foundation (Thế Vinh).

## Repo đang ở giai đoạn nào

**Trạng thái: Sprint 1 tuần 1 xong (cả Ngọc Anh + Thế Vinh).** Backend: Prisma schema 11 bảng, Auth, RBAC, Cas SDK, Redis/BullMQ, Swagger. Frontend foundation: Tailwind v4, ShadCN/UI (button/card/badge/input/skeleton), TanStack Query, Axios client (refresh token interceptor), demo health-check page. DevOps: `docker-compose.yml` full stack (profile `fullstack` / `production`), Dockerfiles (`docker/backend.Dockerfile`, `docker/frontend.Dockerfile`), CI verify + **deploy workflow** (`.github/workflows/deploy.yml`), nginx template (`deploy/nginx/paypilot.conf`).

**Chưa có (Sprint 1 tuần 2+):** Cas Link onboarding, webhook banking, transaction CRUD, Layout/Router/Auth UI, deploy VPS thật (cần cấu hình GitHub Secrets + VPS).

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
│   │   ├── prisma/
│   │   │   ├── schema.prisma               # 11 bảng đầy đủ + pgvector extension
│   │   │   └── migrations/
│   │   │       ├── migration_lock.toml
│   │   │       └── 20260301120000_init_sprint1_week1/
│   │   ├── package.json                    # đã thêm NestJS deps, Prisma 6, bcryptjs
│   │   ├── src/
│   │   │   ├── main.ts                     # global prefix api/v1, Swagger, CORS, ValidationPipe, cookie-parser
│   │   │   ├── app.module.ts
│   │   │   ├── config/configuration.ts
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
│   │   │       ├── cas/                  # CasClientService + health/ping endpoints
│   │   │       └── health/               # GET /api/v1/health
│   │   └── test/
│   │       ├── app.e2e-spec.ts
│   │       └── jest-setup.ts
│   └── frontend/
│       ├── components.json                 # ShadCN config
│       ├── .env.example                    # VITE_API_BASE_URL
│       ├── src/
│       │   ├── main.tsx                    # QueryClientProvider
│       │   ├── App.tsx                     # foundation demo (health check)
│       │   ├── components/ui/              # ShadCN: button, card, badge, input, skeleton
│       │   ├── hooks/useHealthCheck.ts
│       │   ├── lib/api.ts                  # Axios + refresh interceptor
│       │   ├── lib/utils.ts                # cn()
│       │   └── types/auth.ts
│       ├── vite.config.ts                  # Tailwind v4 + @ alias
│       └── package.json
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

**DevDependencies mới:** `prisma` ^6.8, `@types/bcryptjs`, `@types/cookie-parser`, `@types/passport-jwt`.

## Danh sách việc CHƯA làm

- [ ] Copy `.env` local từ `.env.example` (gitignore — không commit): root (docker), `apps/backend/.env`, `apps/frontend/.env` — xem `04-environment-setup.md`
- [ ] Chạy `docker compose up -d` + migrate (hoặc `docker compose --profile fullstack up -d --build` cho full stack)
- [ ] `apps/backend/src/modules/onboarding/` — Cas Link Grant/Exchange (Sprint 1 tuần 2)
- [ ] `apps/backend/src/modules/banking/` — webhook Cas Balance Hook (tuần 2)
- [ ] `apps/backend/src/modules/transaction/` — CRUD giao dịch (tuần 2)
- [ ] Frontend tuần 2: Layout, React Router, Auth UI, Onboarding UI
- [ ] Cấu hình GitHub Secrets + deploy VPS thật (workflow deploy.yml đã có template)

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

## Quy tắc giữ file này luôn đúng

(Same as before — cập nhật khi cấu trúc thay đổi.)
