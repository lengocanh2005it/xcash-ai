# X-Cash AI

**Nền tảng AI định khoản tự động cho SME Việt Nam** — nhận giao dịch qua Cas Balance Hook hoặc import Excel, AI gợi ý bút toán **TT133**, kế toán xác nhận qua Human Review, báo cáo thu chi và export Excel.

> **Trạng thái:** POC/MVP (đồ án thực tập) — chạy được end-to-end trên **sandbox/local**. Chưa go-live production; không phải sản phẩm thương mại chính thức của Casso.

---

## Trạng thái

| | |
|---|---|
| **Code feature** | Sprint 1–4 + Excel Import + Copilot function calling — **đã xong** |
| **Còn lại** | Deploy VPS + SSL, env production đầy đủ, E2E QA thủ công |
| **Môi trường** | Local + Cas sandbox (`sandbox.bankhub.dev`) |

**Luồng chính:** Đăng ký → Cas Link (hoặc import Excel) → webhook/queue → AI định khoản (ngưỡng 85%) → Human Review → báo cáo / Copilot / billing PayOS.

---

## Tính năng

| Nhóm | Nội dung |
|------|----------|
| **Core** | Multi-tenant auth (OTP email, quên MK), Cas Link, webhook Cas, AI classify TT133, Human Review, danh mục TK, báo cáo + export Excel |
| **Giao dịch** | Danh sách/chi tiết, filter theo nguồn (Ngân hàng / Import Excel), bulk reclassify |
| **Import Excel** | Validate → preview → import; template `.xlsx`; quota tách `fromBank` / `fromImport` |
| **AI Copilot** | Chat SSE + function calling (số liệu nội bộ, knowledge base pgvector, tìm giao dịch); quota theo gói |
| **Billing** | PayOS nâng cấp gói, phí vượt quota; plan gating (Copilot Starter+, export Pro+) |
| **Thông báo** | In-app (SSE) + email Resend; quota / billing / review |
| **Settings** | Threshold AI, team invite, audit log tenant, profile + avatar |
| **Partner** | Dashboard, tenants (paginate), giá gói, audit log cross-tenant — role `cas_partner` |
| **Khác** | Landing `/`, Analytics, Welcome Tour, Dashboard stat cards + CTA liên kết NH |

Chi tiết nghiệp vụ, RBAC, API đầy đủ: [`agent-docs/`](./agent-docs/README.md) (đọc [`00-current-state.md`](./agent-docs/00-current-state.md) trước).

---

## Tech stack

| Tầng | Công nghệ |
|------|-----------|
| Backend | NestJS, Prisma, PostgreSQL + pgvector, Redis, BullMQ |
| AI | OpenAI `gpt-4o-mini` + `text-embedding-3-small` (không tự train model) |
| Banking | Cas Balance Hook + Cas Link |
| Frontend | React, Vite, Tailwind v4, ShadCN, TanStack Query, Recharts |
| Monorepo | Turborepo, pnpm, Biome, `@xcash/shared-types` |

```
xcash-ai/
├── apps/backend/       # NestJS API
├── apps/frontend/      # React SPA
├── packages/shared-types/
├── agent-docs/         # Source of truth nghiệp vụ + trạng thái repo
├── docker/ + deploy/
└── docker-compose.yml  # PostgreSQL (pgvector) + Redis
```

---

## Chạy local

**Yêu cầu:** Node ≥ 20, pnpm ≥ 10, Docker Compose.

```bash
git clone https://github.com/lengocanh2005it/xcash-ai.git
cd xcash-ai
pnpm install

cp .env.example .env
cp apps/backend/.env.example apps/backend/.env
cp apps/frontend/.env.example apps/frontend/.env
# Điền DATABASE_URL, JWT secrets, CAS_CLIENT_ID/SECRET (sandbox)

docker compose up -d
pnpm --filter @xcash/backend exec prisma migrate deploy
pnpm dev
```

| Service | URL |
|---------|-----|
| Frontend | http://localhost:5173 |
| Backend / Swagger | http://localhost:3000 / http://localhost:3000/api/docs |

Dev webhook: `WEBHOOK_SKIP_SIGNATURE_VERIFY=true` trong `apps/backend/.env`. Setup đầy đủ (Cas, PayOS, OpenAI, mock webhook): [`agent-docs/04-environment-setup.md`](./agent-docs/04-environment-setup.md).

---

## RBAC (tóm tắt)

| Role | Phạm vi |
|------|---------|
| `admin` | Toàn quyền tenant |
| `accountant` | Định khoản, review, báo cáo |
| `viewer` | Chỉ xem |
| `cas_partner` | Chỉ `/partner/*` (system-level) |

Ma trận đầy đủ: [`agent-docs/reference/rbac.md`](./agent-docs/reference/rbac.md).

> Hai webhook khác nhau: `POST /webhook/cas` (giao dịch, routing `grantId`) và `POST /webhook/payos-billing` (billing, routing `orderCode`).

---

## Lệnh phát triển

```bash
pnpm dev              # backend + frontend
pnpm verify           # lint + type-check + test + build (chạy trước merge)
pnpm --filter @xcash/backend exec prisma migrate deploy
```

---

## Tài liệu

| File | Khi nào đọc |
|------|-------------|
| [`agent-docs/00-current-state.md`](./agent-docs/00-current-state.md) | Trạng thái repo — **đọc đầu tiên** |
| [`agent-docs/04-environment-setup.md`](./agent-docs/04-environment-setup.md) | Setup local chi tiết |
| [`agent-docs/reference/`](./agent-docs/reference/) | Nghiệp vụ, schema, UI, sprint |
| [`CLAUDE.md`](./CLAUDE.md) | Entry point cho AI agent |
| [`deploy/README.md`](./deploy/README.md) | Deploy VPS |

---

## Team

| Họ và tên | MSSV | Vai trò |
|-----------|------|---------|
| Lê Ngọc Anh | 23520048 | Backend & AI Developer |
| Lưu Nguyễn Thế Vinh | 22521653 | Full-stack Developer |

**License:** Private — UNLICENSED. Dự án học tập / thực tập.
