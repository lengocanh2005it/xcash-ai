# Environment Setup — Local Dev

## Yêu cầu

- Node.js ≥ 20
- pnpm ≥ 10 (`corepack enable` hoặc cài trực tiếp — repo pin version qua `packageManager` trong `package.json` root)
- Docker + Docker Compose (PostgreSQL + pgvector, Redis) — file `docker-compose.yml` ở root repo (postgres + redis; nestjs/react service sẽ thêm ở Sprint 1 tuần 1 phần Vinh)
- `ngrok` (chỉ cần khi test webhook Cas thật ở local — Cas server không gọi được vào `localhost`)

## Cài đặt lần đầu

```bash
git clone <repo>
cd paypilot-ai
pnpm install

# Copy env theo từng app (KHÔNG commit file .env thật)
cp .env.example .env                          # docker compose (postgres + redis)
cp .env.example apps/backend/.env             # backend — xóa dòng chỉ dành cho FE/docker nếu muốn gọn
# Hoặc tách tay: xem bảng bên dưới
echo "VITE_API_BASE_URL=http://localhost:3000/api/v1" > apps/frontend/.env
```

**Cấu trúc `.env` trong monorepo:**

| File | Dùng cho | Nội dung chính |
|---|---|---|
| `.env` (root) | `docker compose` | `POSTGRES_*`, `REDIS_PORT` |
| `apps/backend/.env` | NestJS + Prisma | `DATABASE_URL`, JWT, Cas, Redis URL, OpenAI... |
| `apps/frontend/.env` | Vite | `VITE_*` (bắt buộc prefix `VITE_`) |

`.env.example` ở root là **bản tham chiếu đầy đủ** tất cả biến — khi setup lần đầu copy/split sang từng app theo bảng trên.

## Biến môi trường — nhóm chính (đầy đủ xem `.env.example` ở root)

| Nhóm | Biến quan trọng | Ghi chú |
|---|---|---|
| App | `PORT`, `APP_URL`, `FRONTEND_URL` | backend mặc định port 3000, frontend (Vite) port 5173 |
| Database | `DATABASE_URL` | PostgreSQL, **phải bật extension `pgvector`** trước khi migrate |
| Redis | `REDIS_URL` | dùng cho cache + BullMQ + webhook idempotency |
| JWT | `JWT_ACCESS_SECRET`, `JWT_ACCESS_EXPIRES_IN=15m`, `JWT_REFRESH_SECRET`, `JWT_REFRESH_EXPIRES_IN=7d` | Access token ngắn hạn, Refresh lưu HttpOnly Cookie |
| OpenAI | `OPENAI_API_KEY`, `OPENAI_EMBEDDING_MODEL`, `OPENAI_CHAT_MODEL` | công ty cấp sẵn key, không tự train model |
| Cas SDK | `CAS_API_BASE_URL`, `CAS_CLIENT_ID`, `CAS_SECRET_KEY`, `CAS_GRANT_REDIRECT_URI` | sandbox thật, lấy tại `sandbox.console.bankhub.dev/developer/keys` |
| Cas Webhook | `NGROK_WEBHOOK_URL` | chỉ cần khi test webhook local qua ngrok |
| PayOS (billing) | `PAYOS_CHECKSUM_KEY`, `PAYOS_BILLING_WEBHOOK_URL` | mock qua Postman, chưa có account PayOS thật |
| Webhook security | `WEBHOOK_SIGNATURE_HEADER`, `WEBHOOK_TIMESTAMP_TOLERANCE_SECONDS`, `WEBHOOK_IDEMPOTENCY_TTL_SECONDS` | **cần đọc kỹ `https://cas.so/general/api/webhook` trước khi code phần verify signature** — tài liệu Cas chưa nêu rõ tên header chữ ký |
| AI Matching | `AI_MATCHING_AUTO_THRESHOLD=95`, `AI_MATCHING_MIN_THRESHOLD=50` | mặc định, tenant có thể override qua `tenants.matching_threshold` |
| Frontend | `VITE_API_BASE_URL` | `apps/frontend/.env` — prefix `VITE_` bắt buộc |
| Docker Compose | `POSTGRES_*`, `REDIS_PORT` | `.env` ở **root** repo |
| Backend (còn lại) | xem `.env.example` | `apps/backend/.env` |

## Chạy dev

```bash
# 1. Khởi động PostgreSQL (pgvector) + Redis
docker compose up -d

# 2. Migrate database (lần đầu hoặc sau khi pull migration mới)
pnpm --filter @paypilot/backend exec prisma migrate deploy

# 3. Chạy apps
pnpm dev                 # backend (port 3000) + frontend (port 5173)
```

Swagger docs (khi backend đã setup): `http://localhost:3000/api/docs` (đường dẫn cụ thể tùy config trong `main.ts`).

## Test webhook Cas Balance Hook ở local

Cas server thật **không gọi vào được `localhost`**, nên phải dùng `ngrok`:

```bash
ngrok http 3000
# copy URL public (vd: https://abc123.ngrok-free.app) → cấu hình trên
# sandbox.console.bankhub.dev → Developer → Webhooks → loại TRANSACTIONS
# URL: https://abc123.ngrok-free.app/api/v1/webhook/cas
```

Đây là thao tác cấu hình **1 lần duy nhất cho toàn App** (không lặp lại cho từng tenant) — xem chi tiết tại `reference/business-overview.md` mục "Webhook URL — DÙNG CHUNG 1 URL cho toàn bộ App".

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
| Webhook Cas không đến local | Ngrok tunnel đã tắt, hoặc URL trên Cas Console chưa cập nhật URL ngrok mới (ngrok free đổi URL mỗi lần restart) |
| `grantToken` hết hạn khi test Cas Link | Token chỉ sống 30 phút, dùng 1 lần — tạo lại token mới, không cache/reuse |
