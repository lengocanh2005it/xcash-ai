# Environment Setup — Local Dev

## Yêu cầu

- Node.js ≥ 20
- pnpm ≥ 10 (`corepack enable` hoặc cài trực tiếp — repo pin version qua `packageManager` trong `package.json` root)
- Docker + Docker Compose (PostgreSQL + pgvector, Redis) — file `docker-compose.yml` ở root repo
- Profile `fullstack`: thêm `backend` + `frontend-dev` (Vite). Profile `production`: `backend` + `frontend` (Nginx static). Xem `deploy/README.md`
- `ngrok` — chỉ cần khi test webhook **từ Cas Console** (Cas server không gọi được `localhost`). **Không cần** nếu mock webhook bằng Postman/curl gọi thẳng `localhost:3000` (xem mục Smoke test E2E bên dưới).

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

**Thay thế (khuyến nghị cho smoke test Sprint 1):** dùng Postman/curl gọi thẳng `http://localhost:3000/api/v1/webhook/cas` — không cần ngrok, không cần Cas Console "Gọi thử". Xem mục **Smoke test E2E** bên dưới.

## Smoke test E2E (Sprint 1 — đã pass)

Luồng chuẩn để đóng Sprint 1 trên local:

1. `docker compose up -d` + migrate + `pnpm dev`
2. **Register** + **Login** trên UI (`localhost:5173`)
3. **Onboarding → Liên kết ngân hàng** (Cas Link sandbox thật) → lấy `grantId` từ `GET /api/v1/onboarding/status`
4. **Postman/curl** mock webhook (đặt `WEBHOOK_SKIP_SIGNATURE_VERIFY=true` trong `apps/backend/.env`):

```bash
curl -X POST "http://localhost:3000/api/v1/webhook/cas" \
  -H "Content-Type: application/json" \
  -d '{
    "webhookType": "TRANSACTIONS",
    "grantId": "<grantId từ onboarding/status>",
    "transaction": {
      "id": "mock-txn-001",
      "amount": 1500000,
      "description": "Thanh toan HD001 Nguyen Van A",
      "transactionDateTime": "2026-07-02T10:30:00.000Z",
      "counterAccountName": "Nguyen Van A",
      "fiName": "VCB"
    }
  }'
```

5. Mở **Dashboard** / **Giao dịch** — thấy giao dịch mới. Mỗi lần gửi mock dùng `transaction.id` **khác nhau** (idempotency Redis 24h).

**Lưu ý Dashboard:** FE gọi `GET /transactions?limit=100` (max BE cho phép).

**Deploy VPS:** hoãn **Sprint 4** — không chặn đóng Sprint 1. Xem `deploy/README.md` khi sẵn sàng production.

## Tài khoản demo Cas (sandbox)

Dùng khi test luồng Cas Link (liên kết ngân hàng) ở Onboarding. Grant token dùng scope **`identity,transaction`** (`identity` để gọi `GET /identity`, `transaction` cho Balance Hook), **không** dùng `qrpay` (luồng đăng ký QR Pay merchant — form xác thực STK/tên TK hay lỗi sandbox).

**Sandbox ngân hàng:** VietinBank demo (`bankusrdemo1`) hay bị lock bởi Cas ID — ưu tiên thử **Vietcombank (VCB)** khi test Cas Link.

```
username: bankusrdemo1
password: soproud
OTP:      123456
```

Luồng đúng: chọn ngân hàng → **đăng nhập iBanking** trong popup (không nhập form xác thực QR Pay, không quét Cas ID).

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
| Cas Link báo lỗi ở form xác thực STK/tên TK | Đang dùng nhầm scope `qrpay` — PayPilot cần `identity,transaction`. Restart backend, bấm lại Liên kết ngân hàng |
| Callback `/onboarding/banking/callback` lỗi `Cas API error 400` sau khi Cas Link thành công | Thường do thiếu scope `identity` khi gọi `GET /identity`, hoặc `publicToken` đã dùng (bấm lại từ đầu, tạo grant mới). Restart backend sau khi đổi scope |
| Dashboard hiện 0 giao dịch dù webhook OK | FE gọi `limit>100` → BE trả 400; Dashboard dùng `limit=100` |
