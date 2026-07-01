# Current State — Đọc file này ĐẦU TIÊN

> Mục đích: cho biết **chính xác** cái gì đã tồn tại trong repo ngay lúc này, để agent không cần `find`/`grep`/`ls` lại từ đầu mỗi session mới. File này phải được cập nhật mỗi khi có thay đổi cấu trúc đáng kể (thêm module, thêm page, đổi dependency lớn, thêm service hạ tầng). Nếu file này và thực tế code lệch nhau, **tin thực tế code**, và sửa lại file này ngay sau đó.

Cập nhật lần cuối: sau Sprint 1 tuần 1 (Lê Ngọc Anh) — foundation backend: Prisma schema + migration, Auth, RBAC guards, Cas SDK client, Redis + BullMQ, Swagger, Docker Compose (postgres+redis).

## Repo đang ở giai đoạn nào

**Trạng thái: Sprint 1 tuần 1 backend (Ngọc Anh) xong.** Đã có: monorepo + tooling, **toàn bộ Prisma schema 11 bảng** + migration đầu tiên, **Auth module** (register/login/refresh/logout/me), **RBAC foundation** (JwtAuthGuard, RolesGuard, PartnerGuard, `@Roles()`), **Cas SDK HTTP client** + endpoint ping demo, **Redis + BullMQ** wiring, **Swagger** tại `/api/docs`, **docker-compose.yml** (PostgreSQL pgvector + Redis). **Chưa có:** Cas Link onboarding (tuần 2), webhook banking, transaction CRUD, frontend thật (Tailwind/ShadCN/Router), CI/CD, deploy VPS.

Đối chiếu với `reference/sprint-plan.md`: Sprint 1 tuần 1 phần Lê Ngọc Anh **đã xong**; phần Lưu Nguyễn Thế Vinh (Tailwind, ShadCN, Docker full stack, CI/CD, deploy) **chưa làm**.

## Cây file thực tế toàn repo (không tính `node_modules`, `.git`, `.turbo`)

```
paypilot-ai/
├── .claude/skills/                         # 6 skills (không đổi)
├── .env.example
├── .husky/                       # pre-commit, pre-push (Husky)
├── docker-compose.yml                      # NEW — postgres (pgvector) + redis
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
│   └── frontend/                           # CHƯA ĐỔI — placeholder React
├── packages/shared-types/                  # (không đổi nội dung)
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

## Scripts thật — thay đổi ở `apps/backend/package.json`

**Thêm so với scaffold:**
```
prisma:generate  → prisma generate
prisma:migrate   → prisma migrate deploy
postinstall      → prisma generate
```

**Dependencies mới chính:** `@nestjs/config`, `@nestjs/swagger`, `@nestjs/jwt`, `@nestjs/passport`, `@nestjs/bullmq`, `@prisma/client` ^6.8, `bcryptjs`, `bullmq`, `class-validator`, `class-transformer`, `cookie-parser`, `ioredis`, `passport`, `passport-jwt`, `@paypilot/shared-types`.

**DevDependencies mới:** `prisma` ^6.8, `@types/bcryptjs`, `@types/cookie-parser`, `@types/passport-jwt`.

## Danh sách việc CHƯA làm

- [ ] `.env` thật (chỉ có `.env.example`) — cần copy và điền `CAS_CLIENT_ID`/`CAS_SECRET_KEY` để test Cas ping
- [ ] Chạy `docker compose up -d` + `pnpm --filter @paypilot/backend exec prisma migrate deploy` trên máy dev (migration file đã có, chưa tự chạy)
- [ ] `apps/backend/src/modules/onboarding/` — Cas Link Grant/Exchange (Sprint 1 tuần 2)
- [ ] `apps/backend/src/modules/banking/` — webhook Cas Balance Hook (tuần 2)
- [ ] `apps/backend/src/modules/transaction/` — CRUD giao dịch (tuần 2)
- [ ] Frontend: Tailwind, ShadCN, React Router, TanStack Query, Axios (Vinh tuần 1)
- [ ] GitHub Actions deploy VPS (Vinh tuần 1 — CI verify workflow đã có tại `.github/workflows/ci.yml`)
- [ ] ShadCN/UI chưa init ở frontend

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
- [x] GitHub Actions CI — `.github/workflows/ci.yml` chạy `pnpm verify` trên push/PR tới `main`/`develop`

## Quy tắc giữ file này luôn đúng

(Same as before — cập nhật khi cấu trúc thay đổi.)
