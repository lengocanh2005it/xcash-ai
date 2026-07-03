# 🗄 X-Cash AI — Database Schema

> Tài liệu này định nghĩa toàn bộ schema database cho X-Cash AI. Dùng file này làm nguồn tham chiếu chính khi viết Prisma schema thật. Schema X-Cash AI kế thừa các bảng nền tảng từ Sprint 1 và thay thế các bảng PayPilot cũ (invoices, customers, invoice_matches) bằng các bảng mới phù hợp với nghiệp vụ định khoản tự động.

---

## 📐 ERD tổng quan

```
                          ┌──────────────┐
                          │   tenants    │
                          └──────┬───────┘
                                 │ 1
            ┌────────────────────┼────────────────────┬──────────────┐
            │ N                  │ N                   │ N            │ N
      ┌─────▼─────┐       ┌──────▼──────┐       ┌──────▼──────┐  ┌───▼─────────────────┐
      │   users   │       │ cas_grants  │       │ subscriptions│  │ chart_of_accounts   │
      └───────────┘       └─────────────┘       └──────┬──────┘  └─────────────────────┘
            │ 1                  │ 1                    │ 1
            │ N                  │ N                    │ N
      ┌─────▼──────┐      ┌──────▼────────────┐  ┌─────▼────────┐
      │ audit_logs │      │   transactions    │  │payment_orders│
      │ (actor)    │      └──────┬────────────┘  └──────────────┘
      └────────────┘             │ 1 (unique FK)
                                 │ 1
                          ┌──────▼──────────────────┐
                          │ transaction_classifications│
                          └────────────────────────────┘

tenants ──N── usage_logs    (tổng hợp số liệu usage theo ngày/tháng)
tenants ──N── audit_logs    (mọi thao tác trong tenant)
```

**Đọc nhanh quan hệ:**
- 1 `tenant` có nhiều `users`, nhiều `cas_grants`, 1 `subscription` active, nhiều `chart_of_accounts`
- 1 `transaction` có tối đa 1 `transaction_classification` (unique FK) — mỗi GD chỉ có 1 định khoản
- `chart_of_accounts` là danh mục TT133 — được seed sẵn khi tenant đăng ký, tenant có thể thêm tài khoản con

---

## 📋 Danh sách bảng

| # | Bảng | Mục đích |
|---|---|---|
| 1 | `tenants` | 1 doanh nghiệp = 1 dòng |
| 2 | `users` | Tài khoản đăng nhập (Admin/Accountant/Viewer/Cas Partner) |
| 3 | `cas_grants` | Tài khoản ngân hàng đã liên kết qua Cas Link |
| 4 | `transactions` | Giao dịch ngân hàng nhận từ Cas Balance Hook |
| 5 | `chart_of_accounts` | **MỚI** — Danh mục tài khoản TT133 của từng tenant |
| 6 | `transaction_classifications` | **MỚI** — Kết quả AI định khoản từng giao dịch |
| 7 | `subscriptions` | Gói dịch vụ đang active của 1 tenant |
| 8 | `payment_orders` | Lịch sử thanh toán nâng cấp gói qua PayOS |
| 9 | `usage_logs` | Log usage để Cas Partner xem thống kê |
| 10 | `audit_logs` | Lịch sử thao tác toàn hệ thống |

---

## 1. `tenants`

1 doanh nghiệp = 1 dòng. Không có webhook URL riêng (Cas dùng chung 1 URL, định tuyến qua `cas_grants.grant_id`).

```
tenants
├── id                          PK (UUID)
├── business_name               tự nhập khi đăng ký
├── classification_threshold    ngưỡng Confidence Score để Auto Classify, mặc định 85
├── created_at
└── updated_at
```

> **Đổi từ PayPilot:** `matching_threshold` (95) → `classification_threshold` (85)

---

## 2. `users`

```
users
├── id                          PK (UUID)
├── tenant_id                   FK → tenants.id, NULLABLE (NULL nếu role = cas_partner)
├── name
├── email                       unique
├── password_hash               bcrypt
├── role                        enum: cas_partner / admin / accountant / viewer
├── invited_by                  FK → users.id, NULL nếu là Admin đầu tiên
├── invited_at
├── created_at
└── updated_at
```

**Quy tắc:**
- Đăng ký tenant mới → user đầu tiên tự động là `admin`, `invited_by = NULL`
- `cas_partner` chỉ tạo thủ công trong DB, `tenant_id = NULL`

---

## 3. `cas_grants`

Mỗi dòng = 1 lần doanh nghiệp liên kết 1 tài khoản ngân hàng qua Cas Link.

```
cas_grants
├── id                          PK
├── tenant_id                   FK → tenants.id, INDEXED
├── grant_id                    unique, INDEXED — dùng để định tuyến webhook đúng tenant
├── access_token                encrypted
├── account_number              số tài khoản ngân hàng
├── bank_name                   lấy từ GET /identity
├── status                      enum: active / invalidated
└── linked_at
```

> **Vì sao `grant_id` phải có index:** Mọi webhook Cas đều query bảng này real-time bằng `grant_id`.

---

## 4. `transactions`

Giao dịch ngân hàng nhận từ Cas Balance Hook. Không thay đổi so với Sprint 1.

```
transactions
├── id                          PK (UUID)
├── tenant_id                   FK → tenants.id, INDEXED
├── grant_id                    FK → cas_grants.grant_id (trace ngân hàng nào)
├── transaction_id              string, unique trong phạm vi grantId — idempotency key
├── amount                      decimal (dương = tiền vào, âm = tiền ra)
├── content                     nội dung chuyển khoản gốc từ Cas
├── transaction_date            datetime (từ Cas payload)
├── direction                   enum: in / out
├── status                      enum: pending / classified / review / skipped
├── created_at
└── updated_at
```

> **`status` field:** đồng bộ với `transaction_classifications.status` — khi classification được tạo/sửa, status ở cả 2 bảng đều được update.

---

## 5. `chart_of_accounts` ← **MỚI**

Danh mục tài khoản kế toán TT133 của từng tenant. Được seed sẵn ~60 tài khoản cơ bản khi tenant đăng ký. Tenant có thể thêm tài khoản con.

```
chart_of_accounts
├── id                          PK (UUID)
├── tenant_id                   FK → tenants.id, INDEXED
├── account_code                string — vd: "334", "511", "642"
├── account_name                string — vd: "Phải trả người lao động"
├── account_type                enum: asset / liability / equity / revenue / expense
├── parent_code                 string, nullable — mã tài khoản cha (phân cấp)
├── is_active                   boolean, default true
├── created_at
└── updated_at
```

**Unique constraint:** `(tenant_id, account_code)` — mỗi tenant có bộ mã tài khoản riêng.

**Seed data TT133 cơ bản:**

| Mã | Tên | Loại |
|---|---|---|
| 111 | Tiền mặt | asset |
| 112 | Tiền gửi ngân hàng | asset |
| 131 | Phải thu khách hàng | asset |
| 331 | Phải trả người bán | liability |
| 333 | Thuế và các khoản phải nộp Nhà nước | liability |
| 334 | Phải trả người lao động | liability |
| 511 | Doanh thu bán hàng và cung cấp dịch vụ | revenue |
| 515 | Doanh thu hoạt động tài chính | revenue |
| 521 | Các khoản giảm trừ doanh thu | revenue |
| 611 | Chi phí mua hàng | expense |
| 621 | Chi phí nguyên vật liệu trực tiếp | expense |
| 622 | Chi phí nhân công trực tiếp | expense |
| 627 | Chi phí sản xuất chung | expense |
| 635 | Chi phí tài chính | expense |
| 641 | Chi phí bán hàng | expense |
| 642 | Chi phí quản lý doanh nghiệp | expense |
| ... | *(~60 tài khoản TT133 đầy đủ)* | |

---

## 6. `transaction_classifications` ← **MỚI**

Kết quả AI định khoản từng giao dịch. Quan hệ 1-1 với `transactions`.

```
transaction_classifications
├── id                          PK (UUID)
├── tenant_id                   FK → tenants.id, INDEXED
├── transaction_id              FK → transactions.id, UNIQUE — 1 GD chỉ có 1 định khoản
├── debit_account               string — mã TK bên Nợ (vd: "334")
├── credit_account              string — mã TK bên Có (vd: "112")
├── amount                      decimal — số tiền phân loại
├── confidence_score            integer 0-100 — do AI tính
├── classification_type         enum: auto / manual
│                                ← auto: AI classify ≥ threshold
│                                ← manual: kế toán ghi đè / confirm / correct
├── classified_by               string — "ai" hoặc user_id (UUID) nếu human review
├── reason                      text, nullable — lý do AI giải thích (tiếng Việt)
├── embedding                   vector(1536) — pgvector, dùng để few-shot cho GD tương tự
├── status                      enum: pending / classified / review / skipped
│                                ← pending: chưa có AI chạy
│                                ← classified: AI auto classify ≥ threshold (hoặc human confirm)
│                                ← review: AI dưới threshold, chờ kế toán xem xét
│                                ← skipped: kế toán bỏ qua
├── created_at
└── updated_at
```

**Lưu ý quan trọng:**
- `embedding` lưu vector của `transaction.content` (sau preprocessing) — không phải vector của định khoản
- Khi kế toán `correct` (sửa định khoản), cập nhật `debit_account`, `credit_account`, `classification_type = manual`, `classified_by = user_id` — giữ nguyên `embedding` để AI học từ đây
- pgvector index trên `embedding` để similarity search khi tìm few-shot examples

---

## 7. `subscriptions`

Gói dịch vụ đang active của 1 tenant.

```
subscriptions
├── id                          PK
├── tenant_id                   FK → tenants.id, INDEXED
├── plan                        enum: free / starter / pro / enterprise
├── price_per_month
├── transaction_quota           số GD tối đa/tháng (NULL = không giới hạn, Enterprise)
├── transaction_used_this_cycle cộng dồn mỗi khi nhận webhook
├── overage_price_per_transaction
├── status                      enum: active / suspended / cancelled
├── started_at
├── current_cycle_start
└── current_cycle_end
```

**Bảng giá:**

| Gói | Giá/tháng | Quota | Phí vượt |
|---|---|---|---|
| Free | 0đ | 50 GD | Khóa đến chu kỳ sau |
| Starter | 299.000đ | 500 GD | 800đ/GD |
| Pro | 799.000đ | 2.000 GD | 600đ/GD |
| Enterprise | Liên hệ | Không giới hạn | — |

---

## 8. `payment_orders`

Lịch sử thanh toán nâng cấp gói qua PayOS.

```
payment_orders
├── id
├── tenant_id                   FK → tenants.id
├── order_code (unique)         "UPG-{tenant_id}-{timestamp}" — định tuyến PayOS callback
├── target_plan
├── amount
├── status                      enum: pending / paid / expired / failed
├── paid_at
└── created_at
```

---

## 9. `usage_logs`

```
usage_logs
├── id
├── tenant_id                   FK → tenants.id
├── metric                      enum: transaction_count / ai_classification_calls / storage_mb
├── value
└── recorded_at
```

---

## 10. `audit_logs`

```
audit_logs
├── id
├── tenant_id                   FK → tenants.id (nullable — Cas Partner có thể ghi log system-level)
├── actor_id                    FK → users.id
├── actor_role
├── action                      string — vd: "classification.correct", "account.create"
├── entity_type                 string — vd: "transaction_classification", "chart_of_account"
├── entity_id                   UUID
├── metadata                    JSON — before/after values khi sửa
└── created_at
```

---

## 🔑 Index bắt buộc

```sql
-- Routing webhook (real-time, mỗi GD đều query)
CREATE UNIQUE INDEX ON cas_grants(grant_id);

-- Tenant-scoped queries (tất cả API nghiệp vụ)
CREATE INDEX ON transactions(tenant_id, created_at DESC);
CREATE INDEX ON transaction_classifications(tenant_id, status);
CREATE INDEX ON chart_of_accounts(tenant_id, account_code);

-- Idempotency (webhook Cas có thể retry)
CREATE UNIQUE INDEX ON transactions(transaction_id, grant_id);

-- pgvector similarity search (few-shot AI)
CREATE INDEX ON transaction_classifications USING ivfflat (embedding vector_cosine_ops)
  WITH (lists = 100);
```

---

## 📝 Ghi chú Prisma

```prisma
// Khai báo pgvector
generator client {
  provider        = "prisma-client-js"
  previewFeatures = ["postgresqlExtensions"]
}

datasource db {
  provider   = "postgresql"
  url        = env("DATABASE_URL")
  extensions = [pgvector(map: "vector")]
}

// Field vector trong TransactionClassification
model TransactionClassification {
  embedding Unsupported("vector(1536)")?
  // ...
}
```
