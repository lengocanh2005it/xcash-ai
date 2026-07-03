---
name: db-migrate
description: Quy trình chuẩn khi thêm/sửa bảng trong Prisma schema của X-Cash AI — đối chiếu database-schema.md, tạo migration, cập nhật shared-types và index bắt buộc. Dùng khi cần đổi schema DB hoặc khi user gõ "/db-migrate".
---

# DB Migrate — Quy trình sửa Prisma schema chuẩn X-Cash AI

## Trước khi sửa schema

**Không tự sáng tác cột/bảng mới.** Đọc kỹ [`agent-docs/reference/database-schema.md`](../../agent-docs/reference/database-schema.md) trước — đây là **nguồn chuẩn duy nhất**, đã được rà soát để không còn mâu thuẫn giữa các bản nháp cũ (đặc biệt bảng `users` từng bị định nghĩa khác nhau ở 2 nơi, nay đã gộp). Không dùng lại bảng rút gọn trong `reference/business-overview.md` — nó chỉ để tham khảo nhanh, có thể thiếu cột so với bản chuẩn.

Nếu thay đổi cần làm **không có** trong `database-schema.md` (thêm bảng mới hoàn toàn, đổi kiểu dữ liệu cột hiện có, xóa cột) — dừng lại và hỏi user trước khi migrate, vì đây là thay đổi nghiệp vụ đã được duyệt trong tài liệu đồ án, không tự quyết định thay.

## Checklist bắt buộc khi viết/sửa Prisma schema (`apps/backend/prisma/schema.prisma`)

Đối chiếu đúng 5 điểm nêu ở cuối `database-schema.md` mục "Những điểm cần lưu ý khi viết Prisma schema thật":

1. **Index bắt buộc** — các cột sau phải có `@unique` hoặc `@@index` vì dùng để tra cứu real-time:
   - `cas_grants.grant_id` (unique) — tra tenant mỗi khi webhook Cas đến
   - `transactions.transaction_id` (unique) — idempotency key
   - `users.email` (unique)
   - `invoices.invoice_code` — unique **composite** với `tenant_id` (không unique toàn cục, vì mỗi tenant có mã hóa đơn riêng)
   - `payment_orders.order_code` (unique)

2. **Soft delete** — `customers` và `invoices` phải có cột `deleted_at DateTime?` thay vì cho phép xóa cứng. Mọi query `findMany`/`findFirst` liên quan 2 bảng này phải filter `deletedAt: null` mặc định (đặt trong Prisma middleware hoặc luôn thêm tay trong service, thống nhất 1 cách trong toàn repo).

3. **pgvector extension** — trước khi migrate lần đầu, phải bật extension trên Postgres:
   ```sql
   CREATE EXTENSION IF NOT EXISTS vector;
   ```
   Cột `customers.embedding` và `invoices.embedding` dùng type `vector` (qua `pgvector` Prisma client extension hoặc raw SQL migration, Prisma chưa hỗ trợ type `vector` native — cần custom).

4. **Encrypted field** — `cas_grants.access_token` không bao giờ lưu plaintext. Mã hóa/giải mã ở tầng service (trước insert, sau khi select), không dựa vào DB-level encryption một mình.

5. **Cascade behavior** khi xóa `tenant`:
   - `CASCADE`: `users`, `cas_grants`, `customers`, `invoices`, `transactions`, `subscriptions`
   - **Giữ lại** (set `tenant_id = NULL`): `audit_logs` — để vẫn truy vết được lịch sử dù tenant đã xóa

## Quan hệ many-to-many cần bảng trung gian

`transactions` ↔ `invoices` đi qua `invoice_matches` (không FK trực tiếp) — vì 1 giao dịch có thể trả gộp nhiều hóa đơn (Multiple Invoice) và 1 hóa đơn có thể nhận nhiều giao dịch (Partial Payment). Không thay bằng FK 1-nhiều dù trông đơn giản hơn.

## Quy trình chạy

```bash
# 1. Sửa apps/backend/prisma/schema.prisma theo checklist trên
# 2. Tạo migration (dev)
pnpm --filter @xcash/backend exec prisma migrate dev --name <mo_ta_ngan_gon>

# 3. Generate lại Prisma Client
pnpm --filter @xcash/backend exec prisma generate

# 4. Type-check để bắt lỗi chỗ code cũ dùng field/model đã đổi
pnpm --filter @xcash/backend type-check
```

## Sau khi migrate

- Nếu bảng/cột mới cần enum (status, role, plan...), enum đó phải định nghĩa **một chỗ duy nhất** ở `packages/shared-types/src/index.ts` rồi map sang Prisma enum tương ứng trong schema — tránh lệch giá trị giữa Prisma enum và enum TypeScript dùng ở service/controller/frontend.
- Nếu đổi cấu trúc bảng nghiệp vụ mà ảnh hưởng response API, cập nhật type liên quan trong `packages/shared-types` và note cho phía frontend biết field đã đổi.
- Không tự xóa migration cũ đã apply — nếu migrate sai, tạo migration mới để sửa (không dùng `prisma migrate reset` trên môi trường có data thật, chỉ dùng ở local dev trống).
