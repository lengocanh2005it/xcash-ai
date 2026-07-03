# X-Cash AI

**AI-powered Automatic Transaction Classification & Accounting for SMEs**

> Tự động phân loại giao dịch ngân hàng theo chuẩn kế toán TT133, giảm 80% thời gian nhập liệu thủ công, tổng hợp báo cáo thu chi real-time. Tích hợp Cas Balance Hook để nhận giao dịch real-time.

---

## 👥 Team Members

| Họ và tên | MSSV | Vai trò | Phụ trách |
|---|---|---|---|
| Lê Ngọc Anh | 23520048 | Backend & AI Developer | Backend Architecture, AI Engine, Webhook Integration |
| Lưu Nguyễn Thế Vinh | 22521653 | Full-stack Developer | Frontend, Backend Modules, DevOps, Testing |

---

## 📌 Tổng quan

**Bài toán thực tế:**

Kế toán SME mỗi ngày nhận hàng chục giao dịch từ Casso:

```
"CONG TY ABC CK TIEN HANG THANG 6"
"THANH TOAN HOA DON DIEN THANG 6"
"TRA LUONG NV NGUYEN VAN A"
"MUA VAN PHONG PHAM"
```

Hiện tại họ phải **tự đọc từng giao dịch → tự phân loại → tự gõ vào MISA/Excel**. Tốn 30–60 phút mỗi ngày, dễ sai.

**X-Cash AI làm được gì:**

```
Giao dịch → AI đọc nội dung → gợi ý định khoản TT133
                    ↓
"TRA LUONG"     → Nợ 334 / Có 112 (Chi phí lương)
"TIEN HANG"     → Nợ 112 / Có 511 (Doanh thu bán hàng)
"HOA DON DIEN"  → Nợ 627 / Có 112 (Chi phí điện)
                    ↓
Kế toán chỉ cần bấm Xác nhận (hoặc sửa nếu sai)
                    ↓
Hệ thống tự tổng hợp báo cáo thu chi real-time
Export Excel cuối tháng — không cần nhập tay
```

---

## 👥 Target Segment

**SME Việt Nam** — quán cà phê, shop bán lẻ, công ty dịch vụ 5–50 người — bất kỳ doanh nghiệp nào có tài khoản ngân hàng và cần theo dõi thu chi.

**Tại sao mọi SME đều cần (khác sản phẩm B2B đối soát hóa đơn chỉ nhắm doanh nghiệp có hóa đơn):**

| | X-Cash AI |
|---|---|
| Target | Mọi SME có giao dịch ngân hàng |
| Bài toán | Phân loại chi phí/doanh thu tự động |
| AI làm gì | Đọc nội dung → gợi ý tài khoản kế toán |
| Output | Báo cáo thu chi theo tháng, export Excel |
| Cần dữ liệu lịch sử dài | Không — hoạt động ngay từ giao dịch đầu tiên |

---

## 🏗 System Architecture

### Luồng tổng thể

```
Cas Balance Hook (Casso webhook)
        │
        ▼
NestJS Backend — Banking Module
        │
        ▼
Lưu Transaction vào DB
        │
        ▼
BullMQ enqueue job "ai-classify"
        │
        ▼
AI Classification Pipeline
   ┌────────────────────────────┐
   │  Text Preprocessing        │
   │  → OpenAI gpt-4o-mini      │
   │    (few-shot TT133 examples)│
   │  → pgvector similarity     │
   │    (tra phân loại cũ của    │
   │     tenant này để học)      │
   │  → Confidence Score        │
   └────────────────────────────┘
        │
   ┌────┴────┐
   │         │
≥ threshold  < threshold
   │         │
   ▼         ▼
Auto      Human Review
Classify  Queue
   │
   ▼
Cập nhật TransactionClassification
   │
   ▼
Báo cáo thu chi real-time
```

### Tech stack (kế thừa từ Sprint 1)

```
Backend  : NestJS + TypeScript + Prisma + PostgreSQL (pgvector) + Redis + BullMQ
AI       : OpenAI API (gpt-4o-mini chat + text-embedding-3-small) — không tự train model
Banking  : Cas Balance Hook (webhook) + Cas Link (onboarding liên kết tài khoản)
Frontend : React + Vite + TypeScript + Tailwind v4 + ShadCN/UI + TanStack Query + Recharts
Monorepo : Turborepo + pnpm workspaces
```

---

## 🤖 AI Classification — Cốt lõi kỹ thuật

### Chuẩn TT133

X-Cash AI dùng **Thông tư 133/2016/TT-BTC** (kế toán doanh nghiệp nhỏ và vừa) — ít tài khoản hơn TT200, phù hợp SME:

| Tài khoản | Tên | Ví dụ giao dịch |
|---|---|---|
| 111 | Tiền mặt | Rút tiền mặt |
| 112 | Tiền gửi ngân hàng | Mọi GD qua TK ngân hàng |
| 331 | Phải trả người bán | Trả tiền mua hàng |
| 334 | Phải trả người lao động | Trả lương |
| 511 | Doanh thu bán hàng | Tiền hàng vào |
| 515 | Doanh thu tài chính | Lãi ngân hàng |
| 627 | Chi phí sản xuất chung | Điện, nước, thuê kho |
| 641 | Chi phí bán hàng | Marketing, ship |
| 642 | Chi phí quản lý | Văn phòng phẩm, phí DV |
| 635 | Chi phí tài chính | Phí ngân hàng, lãi vay |

### AI Pipeline chi tiết

```
Giao dịch mới: content="TRA LUONG NV NGUYEN VAN A", amount=-15000000
        │
        ▼
Text Preprocessing
(chuẩn hóa: bỏ dấu, lowercase, chuẩn hóa viết tắt phổ biến)
        │
        ▼
pgvector similarity search
(tìm 5 phân loại cũ nhất của tenant này có content tương tự
 → few-shot examples từ chính dữ liệu của họ)
        │
        ▼
OpenAI gpt-4o-mini
Input: content + amount + direction (in/out) + few-shot examples
System prompt: "Phân loại theo TT133. Trả JSON: {debit, credit, confidence, reason}"
        │
        ▼
Response: {
  debit: "334",   // Nợ TK Phải trả người lao động
  credit: "112",  // Có TK Tiền gửi ngân hàng
  confidence: 94,
  reason: "Nội dung 'TRA LUONG' + chiều tiền ra → định khoản lương"
}
        │
   ┌────┴────┐
   │         │
≥ 85%     < 85%
   │         │
   ▼         ▼
Auto      Human Review
```

**Tại sao cần AI, không dùng rule-based:**
- `"TIEN HANG"` có thể là: tiền bán hàng (Có 511) HOẶC tiền mua hàng (Nợ 331) → chỉ AI mới phân biệt được qua chiều giao dịch + ngữ cảnh
- `"CK CONG TY ABC"` → không rõ loại chi phí → AI tra lịch sử tenant để học
- Mỗi doanh nghiệp có cách viết riêng → càng dùng nhiều AI càng chính xác (few-shot từ lịch sử)

---

## 🗄 Database Schema (X-Cash AI)

### Các bảng kế thừa từ Sprint 1 (giữ nguyên)

- `tenants` — đa tenant
- `users` — auth, RBAC
- `transactions` — giao dịch từ Casso webhook
- `cas_grants` — liên kết ngân hàng qua Cas Link
- `subscriptions`, `payment_orders` — billing
- `audit_logs` — lịch sử thao tác

### Bảng mới (thay thế invoices/customers/invoice_matches)

```
chart_of_accounts                    ← danh mục tài khoản TT133 của từng tenant
├── id
├── tenant_id (FK → tenants)
├── account_code                     ← "334", "511", "642"...
├── account_name                     ← "Phải trả người lao động"
├── account_type                     ← asset | liability | equity | revenue | expense
├── parent_code                      ← tài khoản cha (phân cấp)
├── is_active
├── created_at
└── updated_at

transaction_classifications          ← kết quả AI phân loại từng giao dịch
├── id
├── tenant_id (FK → tenants)
├── transaction_id (FK → transactions, unique)
├── debit_account                    ← mã TK bên Nợ (vd: "334")
├── credit_account                   ← mã TK bên Có (vd: "112")
├── amount                           ← số tiền phân loại
├── confidence_score                 ← 0-100, do AI tính
├── classification_type              ← auto | manual
├── classified_by                    ← "ai" | user_id (nếu human review)
├── reason                           ← lý do AI giải thích (tiếng Việt)
├── embedding (vector)               ← pgvector — dùng để few-shot cho GD tương tự
├── status                           ← pending | classified | review | skipped
├── created_at
└── updated_at
```

**Ghi chú quan trọng:**
- `transactions` giữ nguyên schema — chỉ thêm relation sang `transaction_classifications`
- `chart_of_accounts` được **seed sẵn TT133** khi tenant mới đăng ký (khoảng 60-70 tài khoản cơ bản)
- Tenant có thể thêm/sửa tài khoản con (sub-account) theo nhu cầu

### Bảng đã bỏ (so với PayPilot)

- ~~`invoices`~~ — không còn quản lý hóa đơn
- ~~`customers`~~ — không còn quản lý khách hàng
- ~~`invoice_matches`~~ — không còn ghép giao dịch với hóa đơn

---

## 🌐 API Endpoints (X-Cash AI)

### Kế thừa (không đổi)

```
POST  /api/v1/auth/register
POST  /api/v1/auth/login
POST  /api/v1/auth/logout
POST  /api/v1/auth/refresh
GET   /api/v1/auth/me
POST  /api/v1/onboarding/banking/grant-token
POST  /api/v1/onboarding/banking/callback
GET   /api/v1/onboarding/status
POST  /api/v1/webhook/cas
GET   /api/v1/transactions
GET   /api/v1/transactions/:id
GET   /api/v1/health
```

### Mới — Classification

```
GET   /api/v1/transactions/:id/classification   # Kết quả AI phân loại
POST  /api/v1/transactions/:id/classification   # Tạo/ghi đè phân loại thủ công
```

### Mới — Human Review

```
GET   /api/v1/review/queue              # Danh sách GD cần review (confidence < threshold)
POST  /api/v1/review/:id/confirm        # Xác nhận phân loại AI gợi ý
POST  /api/v1/review/:id/correct        # Sửa lại: body { debit, credit }
POST  /api/v1/review/:id/skip           # Bỏ qua
```

### Mới — Chart of Accounts

```
GET   /api/v1/accounts                  # Danh mục tài khoản TT133 của tenant
POST  /api/v1/accounts                  # Thêm tài khoản con
PUT   /api/v1/accounts/:id              # Sửa tên/type
DELETE /api/v1/accounts/:id             # Ẩn tài khoản (soft delete)
```

### Mới — Reports

```
GET   /api/v1/reports/summary           # Tổng hợp thu/chi theo tháng
      ?year=2026&month=6
GET   /api/v1/reports/by-account        # Chi tiết theo từng tài khoản
      ?from_date=&to_date=
GET   /api/v1/reports/export            # Export Excel báo cáo thu chi
      ?from_date=&to_date=
```

### Đã bỏ (so với PayPilot)

- ~~`/invoices/*`~~ — không quản lý hóa đơn
- ~~`/customers/*`~~ — không quản lý khách hàng
- ~~`/review/:id/confirm`~~ (kiểu cũ ghép invoice) → đổi thành `/review/:id/correct` (sửa định khoản)

---

## 🔒 Security & Infrastructure (kế thừa)

Toàn bộ cơ chế security giữ nguyên từ Sprint 1:
- JWT Access Token (15 phút) + Refresh Token HttpOnly Cookie (Redis-backed)
- RBAC: `cas_partner` / `admin` / `accountant` / `viewer`
- Webhook Cas: HMAC-SHA256 verify + Redis idempotency (TTL 24h)
- Multi-tenant: mọi query scope theo `tenant_id`
- Cas Link: 1 URL webhook dùng chung, phân biệt tenant qua `grantId`

**Threshold mặc định:** 85% (thấp hơn ngưỡng đối soát hóa đơn cũ 95% vì phân loại kế toán có nhiều trường hợp biên hơn)

---

## 📐 Webhook Cas — Giữ nguyên hoàn toàn

```
POST /api/v1/webhook/cas  (1 URL chung cho toàn bộ App)
        │
        ▼
Verify HMAC-SHA256
        │
        ▼
Check Redis idempotency (transaction.id, TTL 24h)
        │
        ▼
Resolve tenant_id từ grantId (query cas_grants)
        │
        ▼
Save transaction
        │
        ▼
BullMQ enqueue "ai-classify"  ← ĐÃ ĐỔI: trước là "ai-matching"
        │
        ▼
AI Classification Pipeline
```

---

## 🖥 Frontend UI/UX

### Onboarding Flow (giữ nguyên)

Đăng ký → Liên kết ngân hàng qua Cas Link → Hệ thống tự seed chart of accounts TT133 → Sẵn sàng nhận giao dịch.

### Các màn hình chính

**1. Dashboard**
- Tổng thu / tổng chi tháng này
- Số giao dịch đã phân loại / chờ review
- Biểu đồ thu-chi theo tuần (Recharts)
- Feed giao dịch mới nhất với nhãn phân loại

**2. Transactions**
- Table giao dịch + nhãn phân loại AI (Nợ/Có TK)
- Filter: status (classified/review/pending/skipped), date
- Click vào GD → xem định khoản chi tiết + lý do AI

**3. Human Review Queue**
- Card từng giao dịch: nội dung + AI gợi ý Nợ/Có + confidence
- 3 action: Xác nhận / Sửa định khoản / Bỏ qua
- Sửa định khoản: dropdown chọn TK Nợ + TK Có từ chart_of_accounts

**4. Báo cáo (Reports)**
- Bảng tổng hợp thu chi theo tháng (group by account)
- Nút Export Excel (`.xlsx`)
- Filter theo khoảng thời gian

**5. Danh mục tài khoản (Chart of Accounts)**
- Cây tài khoản TT133 đã seed sẵn
- Thêm/sửa tài khoản con

**6. Settings**
- Liên kết ngân hàng (Cas Link)
- Threshold confidence (mặc định 85%)
- Quản lý team (invite, RBAC)

---

## 🚀 Project Highlights

- **Tích hợp Cas SDK sandbox thật** — Grant/Link/Exchange flow, Balance Hook real-time
- **AI Classification Pipeline** — OpenAI gpt-4o-mini + few-shot từ lịch sử tenant + pgvector
- **Chuẩn TT133** — seed sẵn danh mục tài khoản khi onboard, tenant có thể tùy chỉnh
- **Human-in-the-loop** — confidence thấp → kế toán confirm/sửa → AI học lại
- **Export Excel** — báo cáo thu chi kế toán theo tháng, import được vào MISA
- **Multi-Tenant** qua 1 Webhook URL chung, routing thông minh bằng `grantId`
- **Monolithic Modular** NestJS, Docker, CI/CD GitHub Actions, VPS

---

## 🔮 Future Enhancements

- **Import từ MISA/Excel** — kế toán upload sao kê → AI phân loại hàng loạt
- **Export chuẩn MISA** — file Excel đúng format để import thẳng vào MISA
- **Báo cáo thuế** — tổng hợp VAT đầu vào/ra theo kỳ khai thuế
- **AI Copilot** — hỏi đáp tài chính bằng ngôn ngữ tự nhiên ("Tháng này tôi chi nhiều nhất vào đâu?")
- **Predictive Cash Flow** — dự báo khi đã có đủ lịch sử 6+ tháng
- **Mobile App** — kế toán review và approve trên điện thoại
- **Partner Dashboard** — Cas/CASSO xem toàn bộ tenant đang dùng X-Cash
