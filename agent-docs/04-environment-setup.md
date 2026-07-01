# Environment Setup — Local Dev

## Yêu cầu

- Node.js ≥ 20
- pnpm ≥ 10 (`corepack enable` hoặc cài trực tiếp — repo pin version qua `packageManager` trong `package.json` root)
- Docker + Docker Compose (PostgreSQL + pgvector, Redis) — file `docker-compose.yml` ở root repo
- Profile `fullstack`: thêm `backend` + `frontend-dev` (Vite). Profile `production`: `backend` + `frontend` (Nginx static). Xem `deploy/README.md`
- `ngrok` — **bắt buộc khi test webhook Cas ở local** (Cas server không gọi được `localhost`)

## Cài đặt lần đầu

```bash
git clone <repo>
cd paypilot-ai
pnpm install

# Copy env theo từng app (KHÔNG commit file .env thật)
cp .env.example .env
cp apps/backend/.env.example apps/backend/.env
cp apps/frontend/.env.example apps/frontend/.env
# Điền CAS_CLIENT_ID / CAS_SECRET_KEY thật vào apps/backend/.env (sandbox console)
```

**Cấu trúc `.env` trong monorepo:**

| File | Dùng cho | Nội dung chính |
|---|---|---|
| `.env` (root) | `docker compose` | `POSTGRES_*`, `REDIS_PORT` + biến fullstack (JWT, Cas, `VITE_API_BASE_URL`) |
| `apps/backend/.env` | NestJS + Prisma | `DATABASE_URL`, JWT, Cas, Redis, webhook... — template: `apps/backend/.env.example` |
| `apps/frontend/.env` | Vite | `VITE_*` — template: `apps/frontend/.env.example` |

`.env.example` ở root là **bản tham chiếu đầy đủ**; mỗi app có `.env.example` riêng để copy nhanh.

## Biến môi trường — nhóm chính (đầy đủ xem `.env.example` ở root)

| Nhóm | Biến quan trọng | Ghi chú |
|---|---|---|
| App | `PORT`, `APP_URL`, `FRONTEND_URL` | backend mặc định port 3000, frontend (Vite) port 5173 |
| Database | `DATABASE_URL` | PostgreSQL, **phải bật extension `pgvector`** trước khi migrate |
| Redis | `REDIS_URL` | dùng cho cache + BullMQ + webhook idempotency |
| JWT | `JWT_ACCESS_SECRET`, `JWT_ACCESS_EXPIRES_IN=15m`, `JWT_REFRESH_SECRET`, `JWT_REFRESH_EXPIRES_IN=7d` | Access token ngắn hạn, Refresh lưu HttpOnly Cookie |
| OpenAI | `OPENAI_API_KEY`, `OPENAI_EMBEDDING_MODEL`, `OPENAI_CHAT_MODEL` | công ty cấp sẵn key, không tự train model |
| Cas SDK | `CAS_API_BASE_URL`, `CAS_CLIENT_ID`, `CAS_SECRET_KEY`, `CAS_GRANT_REDIRECT_URI` | sandbox thật, lấy tại `sandbox.console.bankhub.dev/developer/keys` |
| Cas Webhook | `CAS_WEBHOOK_URL` | URL đăng ký trên Cas Console; dev local dùng **ngrok** → `https://<id>.ngrok-free.app/api/v1/webhook/cas` |
| PayOS (billing) | `PAYOS_CHECKSUM_KEY`, `PAYOS_BILLING_WEBHOOK_URL` | mock qua Postman, chưa có account PayOS thật |
| Webhook security | `WEBHOOK_SIGNATURE_HEADER`, `WEBHOOK_TIMESTAMP_TOLERANCE_SECONDS`, `WEBHOOK_IDEMPOTENCY_TTL_SECONDS`, `WEBHOOK_SKIP_SIGNATURE_VERIFY` | dev local/ngrok: `WEBHOOK_SKIP_SIGNATURE_VERIFY=true`; production **phải** `false` |
| AI Matching | `AI_MATCHING_AUTO_THRESHOLD=95`, `AI_MATCHING_MIN_THRESHOLD=50` | mặc định, tenant có thể override qua `tenants.matching_threshold` |
| Frontend | `VITE_API_BASE_URL` | `apps/frontend/.env` — prefix `VITE_` bắt buộc |
| Docker Compose | `POSTGRES_*`, `REDIS_PORT` | `.env` ở **root** repo |
| Backend (còn lại) | xem `.env.example` | `apps/backend/.env` |

## Chạy dev

```bash
# 1. Khởi động PostgreSQL (pgvector) + Redis (chỉ infra)
docker compose up -d

# Hoặc full stack (backend + frontend trong Docker):
docker compose --profile fullstack up -d --build

# 2. Migrate database (nếu chạy backend ngoài Docker)
pnpm --filter @paypilot/backend exec prisma migrate deploy

# 3. Chạy apps local (không Docker cho BE/FE)
pnpm dev                 # backend (port 3000) + frontend (port 5173)
```

Swagger docs (khi backend đã setup): `http://localhost:3000/api/docs` (đường dẫn cụ thể tùy config trong `main.ts`).

## Test webhook Cas Balance Hook ở local

Cas server **không gọi được `localhost`** — phải dùng **ngrok**:

```bash
# Terminal 1: backend đang chạy port 3000
pnpm dev:backend

# Terminal 2: tạo tunnel public
ngrok http 3000
# Forwarding: https://abc123.ngrok-free.app -> http://localhost:3000
```

1. Copy URL ngrok → điền `CAS_WEBHOOK_URL` trong `apps/backend/.env`:
   `https://abc123.ngrok-free.app/api/v1/webhook/cas`
2. Cas Console → Developer → Webhooks → loại **TRANSACTIONS** → dán cùng URL trên
3. Bấm **Gọi thử**

**Lưu ý:** ngrok free đổi URL mỗi lần restart — phải cập nhật lại Cas Console + `.env`.

Production: URL public HTTPS của backend (không cần ngrok).

Đây là thao tác cấu hình **1 lần duy nhất cho toàn App** — xem `reference/business-overview.md` mục "Webhook URL — DÙNG CHUNG 1 URL cho toàn bộ App".

## Tài khoản demo Cas (sandbox)

Dùng khi test luồng Cas Link (liên kết ngân hàng) ở Onboarding:

```
username: bankusrdemo1
password: soproud
OTP:      123456
```

## Mock data có sẵn

3 file Excel mẫu để test import/webhook nằm ở: (đường dẫn gốc ngoài repo, copy vào `apps/backend/test/fixtures/` khi cần dùng cho integration test)
- `customers_import.xlsx` — mẫu import khách hàng
- `invoices_import.xlsx` — mẫu import hóa đơn
- `transactions_sample.xlsx` — mẫu payload giao dịch, dùng làm dữ liệu mock khi Cas sandbox không ổn định (xem rủi ro trong `reference/sprint-plan.md`)

## Troubleshooting nhanh

| Vấn đề | Nguyên nhân thường gặp |
|---|---|
| `pnpm install` báo lỗi workspace | Kiểm tra `package.json` của package mới có `name` dạng `@paypilot/<tên>` và nằm đúng dưới `apps/` hoặc `packages/` chưa |
| Turbo báo "no script found" | Bình thường nếu package đó chưa cần script đó — không phải lỗi |
| Webhook Cas không đến local | Chưa chạy ngrok, URL Cas Console chưa khớp tunnel mới, hoặc backend chưa listen port 3000 |
| `grantToken` hết hạn khi test Cas Link | Token chỉ sống 30 phút, dùng 1 lần — tạo lại token mới, không cache/reuse |
