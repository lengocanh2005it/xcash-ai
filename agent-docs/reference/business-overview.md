# 🚀 PayPilot AI

**AI-powered Payment Operations & Reconciliation Platform**

> Tự động hóa quy trình đối soát thanh toán, ghép giao dịch với hóa đơn và vận hành tài chính cho doanh nghiệp — tích hợp Cas Balance Hook để nhận giao dịch ngân hàng thời gian thực.

---

## 👥 Team Members

| Họ và tên | MSSV | Vai trò | Phụ trách |
|---|---|---|---|
| Lê Ngọc Anh | 23520048 | Backend & AI Developer | Backend Architecture, AI Engine, Webhook Integration |
| Lưu Nguyễn Thế Vinh | 22521653 | Full-stack Developer | Frontend, Backend Modules, DevOps, Testing |

---

## 📌 Tổng quan

PayPilot AI là nền tảng hỗ trợ doanh nghiệp tự động hóa quy trình **Payment Operations** — từ nhận giao dịch, đối soát hóa đơn đến cập nhật trạng thái thanh toán và thông báo cho khách hàng.

Hệ thống tích hợp với **Cas Balance Hook** để nhận giao dịch chuyển khoản tự do theo thời gian thực, sau đó sử dụng AI để:

- Tự động ghép giao dịch với hóa đơn (AI Transaction Matching)
- Xác định khách hàng dù nội dung chuyển khoản không đầy đủ
- Cập nhật trạng thái thanh toán tự động
- Hỗ trợ kế toán bằng ngôn ngữ tự nhiên
- Phân tích dữ liệu tài chính

> **PayPilot AI không thay thế hệ thống ngân hàng.** Hệ thống hoạt động như một lớp ứng dụng (Application Layer) phía trên Banking API và Payment Gateway, tập trung vào tự động hóa quy trình vận hành thanh toán của doanh nghiệp.

### System Context

```
                    Bank
                     │
                     ▼
          Cas Link + Balance Hook
       (doanh nghiệp liên kết tài khoản
        ngân hàng qua Cas Link 1 lần lúc
        Onboarding, Cas tự động bắn
        webhook khi có giao dịch mới)
                     │
                     ▼
              PayPilot AI
     ├── AI Transaction Matching
     ├── AI Customer Matching
     ├── AI Invoice Assistant
     ├── AI Copilot
     ├── Workflow Automation
     ├── Notification
     ├── Analytics Dashboard
     └── Audit Log
                     │
                     ▼
        Doanh nghiệp / Kế toán
```

### Khách hàng thanh toán như thế nào?

Doanh nghiệp dùng **QR ngân hàng công khai** (chuẩn VietQR — giống QR dán tại quán cà phê, shop online) chứa số tài khoản đã liên kết với Cas. Khách quét QR bằng app ngân hàng bất kỳ, tự gõ nội dung chuyển khoản, chuyển tiền — không cần qua bất kỳ cổng thanh toán trung gian nào:

```
Doanh nghiệp dán QR ngân hàng công khai
(tại quầy / website / hóa đơn)
        │
        ▼
Khách quét QR → tự gõ nội dung → chuyển khoản
        │
        ▼
Ngân hàng ghi nhận giao dịch
        │
        ▼
Cas phát hiện biến động số dư trên tài khoản đã liên kết
        │
        ▼
Cas tự động POST webhook về PayPilot
```

> **Vì sao không cần Payment Gateway cho nghiệp vụ đối soát:** QR ngân hàng công khai đã đủ để khách thanh toán thuận tiện (quét thay vì gõ tay số tài khoản). Nội dung chuyển khoản trong trường hợp này **vẫn là khách tự gõ** — đây chính là lý do AI Transaction Matching có giá trị thực sự, thay vì bị làm dư thừa bởi một payment link đã điền sẵn nội dung. Việc bổ sung Payment Gateway để gửi link thanh toán online cho khách hàng cuối là tính năng có thể cân nhắc ở giai đoạn mở rộng (xem Future Enhancements), không phải nhu cầu cốt lõi của bài toán đối soát.
>
> **Lưu ý:** Điều này chỉ áp dụng cho luồng nghiệp vụ (doanh nghiệp nhận tiền từ khách hàng cuối). PayPilot vẫn dùng **PayOS riêng** cho việc thu phí dịch vụ từ chính doanh nghiệp khi nâng cấp gói — xem mục Billing và `RBAC.md`.

### Authentication & Liên kết ngân hàng — 2 cơ chế tách biệt

> **Quan trọng:** Đây là 2 việc khác nhau, dùng 2 cơ chế khác nhau, không được nhầm lẫn:

| | Đăng nhập PayPilot | Liên kết ngân hàng |
|---|---|---|
| **Mục đích** | User (Admin/Accountant/Viewer) truy cập hệ thống | Lấy giao dịch ngân hàng về cho 1 tenant |
| **Cơ chế** | Email + mật khẩu (PayPilot tự quản lý) | Cas Grant/Link (Cas SDK thật) |
| **Khi nào dùng** | Mỗi lần truy cập | 1 lần lúc Onboarding (có thể liên kết thêm tài khoản sau) |
| **Có cần `x-client-id`/`x-secret-key`?** | Không | Có — bắt buộc |

**Lý do tách biệt:** Cas hiện **không cung cấp** cơ chế "Đăng nhập bằng Cas ID" cho ứng dụng bên thứ ba — tính năng đó thuộc sản phẩm **IDKit**, hiện vẫn ở trạng thái "coming soon", chưa có API công khai. Cái Cas cung cấp được ngay là **Cas Link** — giao diện cho người dùng đăng nhập Internet Banking để cấp quyền đọc giao dịch (Balance Hook), khác hoàn toàn với việc đăng nhập vào PayPilot.

#### 1. Đăng nhập PayPilot (email + mật khẩu)

```
POST /api/v1/auth/register   → tạo tenant mới + user đầu tiên (role: admin)
POST /api/v1/auth/login      → JWT Access Token + Refresh Token
```

Đây là cơ chế tiêu chuẩn, PayPilot tự quản lý, không phụ thuộc Cas.

#### 2. Liên kết ngân hàng qua Cas Link (trong bước Onboarding)

```
Bước 1 — PayPilot Backend tạo grantToken
POST https://sandbox.bankhub.dev/grant/token
headers: x-client-id, x-secret-key
body: { "scopes": "qrpay", "language": "vi", "redirectUri": "https://paypilot.ai/onboarding/callback" }
→ trả về grantToken (hết hạn sau 30 phút, dùng 1 lần)
        │
        ▼
Bước 2 — Mở Cas Link (iframe) cho người dùng
Người dùng đăng nhập Internet Banking ngay trong Cas Link
(môi trường test dùng tài khoản demo: bankusrdemo1 / soproud / OTP 123456)
        │
        ▼
Bước 3 — Cas Link redirect về redirectUri kèm publicToken
        │
        ▼
Bước 4 — PayPilot Backend đổi publicToken lấy accessToken + grantId
POST https://sandbox.bankhub.dev/grant/exchange
body: { "publicToken": "..." }
→ trả về accessToken (không hết hạn, trừ khi gọi /grant/invalidate) và grantId
        │
        ▼
Bước 5 — Gọi GET /identity (kèm accessToken) lấy thông tin tài khoản vừa liên kết
        │
        ▼
Bước 6 — Lưu vào bảng cas_grants: { tenant_id, grant_id, access_token, account_number, bank_name }
→ Đây là bước MẤU CHỐT để phân biệt tenant khi webhook về (xem giải thích bên dưới)
```

### Webhook URL — DÙNG CHUNG 1 URL cho toàn bộ App, không phải riêng từng tenant

> **Quan trọng — sửa lại hiểu nhầm trước đó:** Webhook trên Cas được cấu hình **ở cấp độ App** (`console.bankhub.dev` → Developer → Webhooks), gắn với 1 `client-id` duy nhất — **không có khái niệm 1 URL riêng cho mỗi tenant**. Toàn bộ doanh nghiệp đã liên kết ngân hàng qua app PayPilot đều gửi giao dịch về **chung 1 URL**.

**Vậy làm sao biết giao dịch thuộc tenant nào?** Câu trả lời nằm ở field `grantId` có sẵn trong mọi payload webhook của Cas:

```json
{
  "webhookType": "TRANSACTIONS",
  "grantId": "4c657924-13f3-11ee-a4bb-42010a40001b",
  "transaction": { "amount": 10000, "description": "test", ... }
}
```

```
Webhook đến URL chung: POST /api/v1/webhook/cas
        │
        ▼
Đọc grantId từ payload
        │
        ▼
Query bảng cas_grants: WHERE grant_id = ?
        │
        ▼
Tìm ra tenant_id tương ứng
        │
        ▼
Lưu transaction với đúng tenant_id, chạy tiếp AI Matching
```

**Cấu hình thực tế trên Cas Console (1 lần duy nhất, không lặp lại cho từng tenant):**
- Loại webhook: `TRANSACTIONS`
- URL: endpoint backend truy cập được từ internet — dev local dùng **ngrok** (`ngrok http 3000` → `https://<id>.ngrok-free.app/api/v1/webhook/cas`); production dùng URL HTTPS public

---

## 🎯 Project Goals

### Bối cảnh

Trong thực tế, doanh nghiệp nhận hàng trăm chuyển khoản mỗi ngày với nội dung hoàn toàn tự do:

```
"Thanh toan DH1025"
"Thanh toán đơn hàng 1025"
"TT HD1025"
"Nguyen Van A CK"
"CK don hang 1025 cho shop"
"tien hang thang 1"
```

Mỗi khách hàng có cách ghi nội dung khác nhau khiến việc đối soát trở nên phức tạp. Kế toán phải:

- Dò từng giao dịch trong sao kê ngân hàng
- Tìm hóa đơn tương ứng
- Đánh dấu thủ công trạng thái đã thanh toán
- Xử lý các trường hợp thanh toán thiếu, dư, gộp nhiều hóa đơn

Các hệ thống hiện tại dùng **Rule-based** (Regex, If-Else) để match nội dung — phức tạp để bảo trì và dễ bỏ sót khi khách ghi sai.

### Giải pháp

PayPilot AI sử dụng AI để **hiểu ngữ nghĩa** của giao dịch thay vì phụ thuộc vào Rule cố định:

- Tự động đối soát thanh toán — không cần thao tác thủ công
- Giảm sai sót trong quy trình kế toán
- Rút ngắn thời gian xử lý giao dịch
- Tăng hiệu quả vận hành cho bộ phận tài chính

---

## 🏗 System Architecture

Hệ thống được xây dựng theo kiến trúc **Monolithic Modular Architecture** bằng NestJS.

```
src/
├── modules/
│   ├── auth/
│   ├── banking/
│   ├── transaction/
│   ├── invoice/
│   ├── customer/
│   ├── ai/
│   ├── analytics/
│   ├── notification/
│   └── audit-log/
├── common/
├── shared/
├── infrastructure/
└── main.ts
```

Mỗi Domain được tổ chức thành một Module độc lập, bao gồm:

- Controller
- Service
- Repository
- DTO
- Entity
- Validation
- Business Logic

Các Module giao tiếp với nhau thông qua **Service Layer** nhằm giảm coupling và tăng khả năng bảo trì.

### Component Interaction

```
        Cas Balance Hook Webhook
           (1 URL chung cho App)
                       │
                       ▼
             NestJS Backend
             (Banking Module)
                       │
                       ▼
        Resolve tenant_id từ grantId
        (query bảng cas_grants
         WHERE grant_id = payload.grantId)
                       │
                       ▼
           Feature Extraction
           (amount, content, time,
            account, velocity...)
                       │
                       ▼
              AI Engine (NestJS)
         ┌─────────────────────────┐
         │  Semantic Matching      │
         │  + Rule-based Validation│
         │  → Confidence Score     │
         └─────────────────────────┘
                       │
          ┌────────────┴────────────┐
          │                         │
   Score ≥ 95%                Score < 95%
          │                         │
          ▼                         ▼
    Auto Matched               Human Review
          │                         │
          ▼                         ▼
   Invoice Updated            Case Management
          │
          ▼
Notification + Audit Log
```

---

## 🤖 AI-Assisted Development Workflow

Nhóm tập trung vào các công việc kỹ thuật trước khi sử dụng AI hỗ trợ lập trình:

- Phân tích yêu cầu nghiệp vụ
- Domain Modeling
- Database Design
- API Design
- System Architecture
- Technical Design Document (TDD)
- Sprint Planning
- Task Breakdown

Sau khi hoàn thành thiết kế, mỗi thành viên sử dụng **Claude Code Max 5x** như một AI Pair Programmer để hỗ trợ triển khai từng Module.

Developer vẫn chịu trách nhiệm:

- Code Review & Refactoring
- Unit Testing & Integration Testing
- Performance Optimization
- Debugging
- Đảm bảo Coding Convention
- Pull Request Review

### Development Workflow

```
Business Requirements
        │
        ▼
  Domain Analysis
        │
        ▼
Architecture Design
        │
        ▼
  Database Design
        │
        ▼
Technical Design Document
        │
        ▼
  Sprint Planning
        │
        ▼
  Task Breakdown
        │
        ▼
 Claude Code Max 5x
        │
        ▼
 Developer Review
        │
        ▼
      Testing
        │
        ▼
   Refactoring
        │
        ▼
Production Deployment
```

> **Triết lý:** AI hỗ trợ lập trình, nhưng con người chịu trách nhiệm về thiết kế hệ thống, chất lượng mã nguồn và các quyết định kỹ thuật.

---

## 🛠 Technology Stack

### Backend

- NestJS
- TypeScript
- Prisma ORM
- PostgreSQL
- Redis
- BullMQ
- JWT Authentication
- Swagger (OpenAPI)

### AI / LLM

> **Quan trọng:** PayPilot AI **không tự train model**. Toàn bộ AI chạy trên **OpenAI API do công ty cấp sẵn** — không cần GPU, không cần infrastructure ML riêng.

| Mục đích | Công nghệ | Ghi chú |
|---|---|---|
| Embedding (chuyển text → vector) | OpenAI Embedding API (`text-embedding-3-small`) | Dùng cho Transaction & Customer Matching |
| AI Matching, Explain, Copilot | OpenAI Chat API (`gpt-4o-mini`) | Function Calling cho AI Copilot, do công ty cấp |
| AI Pipeline Orchestration | LangChain | Kết nối các bước AI |
| Vector Similarity Search | pgvector (PostgreSQL extension) | Tìm hóa đơn/khách hàng gần nhất |
| RAG Knowledge Base | LangChain + pgvector + OpenAI | Đọc tài liệu nội bộ doanh nghiệp |

### Banking Integration

- **Cas SDK** — Grant/Link/Exchange flow để liên kết tài khoản ngân hàng
- **Cas Balance Hook** — nhận giao dịch chuyển khoản tự do theo thời gian thực

### Billing Integration

- **PayOS** — tạo Payment Link khi doanh nghiệp nâng cấp gói dịch vụ (PayPilot là bên nhận tiền, khác hẳn use case nhận tiền hộ doanh nghiệp đã loại bỏ — xem `RBAC.md` mục Pricing Model)
- **Trong phạm vi dự án:** mock callback qua Postman, chưa đăng ký tài khoản PayOS thật

### Frontend

- React
- Tailwind CSS
- ShadCN/UI (Component Library)
- TanStack Query (Server State Management)
- Recharts (Dashboard & Analytics Charts)

### Infrastructure

- Docker Compose
- Nginx
- GitHub Actions
- VPS Deployment
- HTTPS (Let's Encrypt)

---

## 🚀 Core Features

### 1. Banking Integration

> **Phạm vi dự án:** Cas Balance Hook dùng **sandbox thật** (đã có `x-client-id`/`x-secret-key`) — xem chi tiết flow tại [Authentication & Liên kết ngân hàng](#authentication--liên-kết-ngân-hàng--2-cơ-chế-tách-biệt).

**Cas Balance Hook** (sandbox thật)
- Nhận giao dịch chuyển khoản tự do theo thời gian thực
- Liên kết qua Cas Link (người dùng đăng nhập Internet Banking trong giao diện Cas cung cấp) — xem chi tiết flow Grant/Exchange ở trên
- Webhook payload đầy đủ: số tiền, nội dung, tài khoản, ngân hàng, thời gian giao dịch (`transactionDateTime`, `description`, `amount`, `counterAccountName`...)
- Hỗ trợ nhiều tài khoản ngân hàng trên cùng 1 tenant (mỗi lần liên kết thêm = 1 grant mới)
- Webhook cấu hình **1 lần duy nhất trên Cas Developer Console** ở cấp App, dùng chung cho mọi tenant, phân biệt qua `grantId` trong payload
- **Môi trường test:** dùng tài khoản demo Cas cung cấp sẵn (`bankusrdemo1` / `soproud` / OTP `123456`) để đăng nhập trong Cas Link khi liên kết ngân hàng thử nghiệm — không cần tài khoản ngân hàng thật
- Khách hàng thanh toán bằng cách quét **QR ngân hàng công khai** (VietQR) chứa số tài khoản đã liên kết — không cần Payment Gateway trung gian, xem chi tiết tại [Khách hàng thanh toán như thế nào?](#khách-hàng-thanh-toán-như-thế-nào)

---

### 2. AI Transaction Matching ⭐

Đây là tính năng cốt lõi của PayPilot AI. AI tự động ghép giao dịch với hóa đơn thông qua **AI Matching Pipeline**:

**Bản chất kỹ thuật:**

```
Lúc tạo hóa đơn / khách hàng (1 lần, lưu sẵn):
Hóa đơn "HD1025 - Nguyễn Văn A - 350,000đ"
        │
        ▼
Gọi OpenAI Embedding API
→ vector [0.23, 0.87, ...]
        │
        ▼
Lưu vào PostgreSQL + pgvector

Lúc có giao dịch mới (real-time):
"TT HD1025 Nguyen Van A"
        │
        ▼
Text Preprocessing
(chuẩn hóa nội dung tiếng Việt,
 xử lý viết tắt, không dấu)
        │
        ▼
Gọi OpenAI Embedding API → vector mới
        │
        ▼
Vector Similarity Search (pgvector)
(tìm hóa đơn gần nhất theo cosine similarity)
        │
        ▼
Rule-based Validation
(kiểm tra số tiền, ngày hạn,
 mã hóa đơn, khách hàng)
        │
        ▼
Confidence Scoring
        │
   ┌────┴────┐
   │         │
≥ 95%     < 95%
   │         │
   ▼         ▼
Auto      Human
Match     Review
```

**Ví dụ thực tế:**

| Nội dung chuyển khoản | Hóa đơn ghép được | Confidence |
|---|---|---|
| `Thanh toan DH1025` | Đơn hàng #1025 | 98% |
| `TT HD1025` | Đơn hàng #1025 | 96% |
| `Nguyen Van A CK don hang` | Đơn hàng #1025 (khách Nguyễn Văn A) | 91% |
| `tien hang` | — | 42% → Human Review |

> AI không tự động xử lý mọi giao dịch. Các giao dịch có Confidence Score thấp sẽ được chuyển tới **Human Review** trước khi cập nhật trạng thái thanh toán, nhằm giảm rủi ro sai sót.

---

### 3. AI Customer Matching

AI xác định khách hàng ngay cả khi nội dung chuyển khoản không đầy đủ hoặc sai chính tả:

- Matching theo tên (có dấu / không dấu / viết tắt)
- Matching theo số điện thoại, mã khách hàng
- Matching theo lịch sử giao dịch trước đó
- Embedding-based similarity search trên database khách hàng

---

### 4. AI Invoice Assistant

Xử lý các tình huống thanh toán phức tạp mà Rule-based không xử lý được:

| Tình huống | Mô tả | Xử lý |
|---|---|---|
| **Partial Payment** | Khách thanh toán thiếu | Ghi nhận thanh toán một phần, giữ hóa đơn trạng thái chưa đủ |
| **Over Payment** | Khách thanh toán dư | Ghi nhận, thông báo để hoàn tiền hoặc bù vào đơn tiếp theo |
| **Multiple Invoice** | Một lần thanh toán nhiều hóa đơn | AI tách và ghép từng phần vào đúng hóa đơn |
| **Split Payment** | Nhiều giao dịch cho một hóa đơn | AI gộp lại và đánh dấu đủ khi tổng khớp |

---

### 5. AI Copilot

Cho phép kế toán đặt câu hỏi bằng ngôn ngữ tự nhiên, không cần biết SQL hay dùng filter phức tạp.

**Bản chất kỹ thuật:** Gọi OpenAI Chat API với **Function Calling** — LLM tự quyết định gọi tool nào phù hợp, NestJS thực thi query, trả kết quả về LLM để format thành câu trả lời tự nhiên.

```
User: "Khách nào còn nợ trên 30 ngày?"
        │
        ▼
OpenAI gpt-4o-mini
(nhận danh sách tools có sẵn)
        │
        ▼
LLM tự gọi: get_overdue_customers({ days: 30 })
        │
        ▼
NestJS thực thi query PostgreSQL
        │
        ▼
Trả kết quả về LLM
        │
        ▼
LLM format: "Có 3 khách hàng công nợ quá hạn:
• Nguyễn Văn A — 2,400,000đ (45 ngày)..."
```

**Ví dụ câu hỏi:**
- *"Doanh thu hôm nay bao nhiêu?"*
- *"Có bao nhiêu hóa đơn chưa thanh toán?"*
- *"Top 5 khách hàng thanh toán nhiều nhất tháng này?"*
- *"Khách hàng nào có công nợ quá hạn trên 30 ngày?"*
- *"Tổng tiền chưa thu của khách Nguyễn Văn A?"*

---

### 6. AI Explain

Giải thích lý do AI ghép giao dịch với hóa đơn cụ thể, nhằm tăng tính minh bạch:

**Ví dụ output:**
> *"Giao dịch 'TT HD1025 - 350,000đ' được ghép với Hóa đơn #1025 (350,000đ - Nguyễn Văn A) với độ tin cậy 96%. Lý do: (1) Mã hóa đơn '1025' khớp trực tiếp, (2) Số tiền khớp chính xác, (3) Thời gian giao dịch trong hạn thanh toán."*

---

### 7. AI Knowledge Base (RAG)

Cho phép AI đọc tài liệu nội bộ của doanh nghiệp để trả lời đúng quy trình.

**Bản chất kỹ thuật:** Retrieval-Augmented Generation — không train model, chỉ embed tài liệu vào pgvector rồi tìm đoạn liên quan khi có câu hỏi:

```
Upload tài liệu (PDF, DOCX)
        │
        ▼
Chunk tài liệu thành đoạn nhỏ
        │
        ▼
Embedding từng đoạn → lưu pgvector
        │
        ▼
Khi user hỏi:
Embedding câu hỏi → tìm đoạn liên quan
→ Gửi context + câu hỏi vào OpenAI
→ LLM trả lời đúng theo tài liệu
```

**Tài liệu hỗ trợ:**
- SOP (Standard Operating Procedure)
- Quy trình kế toán nội bộ
- ERP Manual
- Internal Policy

---

### 8. Workflow Automation

Toàn bộ quy trình từ webhook đến thông báo chạy tự động:

```
Webhook (Cas Balance Hook)
        │
        ▼
Save Transaction
        │
        ▼
AI Matching Pipeline
        │
   ┌────┴────┐
   │         │
≥ 95%     < 95%
   │         │
   ▼         ▼
Invoice    Human
Updated    Review
   │
   ▼
Notification (Email/Slack/Webhook)
   │
   ▼
Audit Log
```

---

### 9. Analytics Dashboard

Hiển thị tổng quan tài chính theo thời gian thực:

- Doanh thu theo ngày / tuần / tháng
- Cash Flow
- Hóa đơn chưa thanh toán (Pending Invoice)
- Công nợ quá hạn
- Tỷ lệ thanh toán đúng hạn
- Top khách hàng
- AI Matching accuracy rate

---

### 10. Notification Center

Gửi thông báo tự động khi có giao dịch mới, hóa đơn được cập nhật hoặc cần review:

- Email
- Slack
- Discord
- Webhook (tích hợp hệ thống khác)

---

### 11. Human Review

Giao dịch có Confidence Score < 95% được chuyển sang analyst review:

- Queue giao dịch cần xác nhận
- Hiển thị đầy đủ context: giao dịch, hóa đơn gợi ý, AI explanation
- Quyết định: Confirm Match / Reassign / Skip
- Feedback loop — quyết định của người dùng giúp cải thiện AI theo thời gian

---

### 12. Audit Log

Lưu toàn bộ lịch sử thao tác của người dùng và hệ thống:

- Mọi quyết định của AI (auto match, confidence score)
- Mọi thao tác của kế toán (confirm, reassign, skip)
- Phục vụ compliance, kiểm toán và truy vết

---

### 13. Multi-Tenant

Nhiều doanh nghiệp sử dụng chung nền tảng, dữ liệu cô lập hoàn toàn theo tenant.

### 14. Partner Dashboard (Cas Partner)

Màn hình riêng dành cho đội ngũ Cas/CASSO — nhìn xuyên suốt toàn bộ tenant đang dùng PayPilot AI:

- Danh sách doanh nghiệp, trạng thái active/suspended, gói dịch vụ
- Tổng quan usage (số giao dịch, AI Matching calls) và doanh thu từng tenant
- Khóa/mở tài khoản doanh nghiệp vi phạm hoặc quá hạn thanh toán
- Audit Log toàn hệ thống để hỗ trợ kỹ thuật khi tenant báo lỗi

> Chi tiết đầy đủ về quyền hạn, API, database schema cho vai trò này — xem [`RBAC.md`](./RBAC.md#-cas-partner--vai-trò-cấp-hệ-thống).

### 15. Billing — Tính phí theo số giao dịch/tháng

PayPilot thu phí từng doanh nghiệp dựa trên số giao dịch xử lý mỗi tháng (tương tự cách Casso tính phí ở lớp hạ tầng bên dưới):

- 4 gói: Free / Starter / Pro / Enterprise — phân biệt theo quota giao dịch/tháng
- Vượt quota: gói Free bị khóa tạm đến chu kỳ sau, gói trả phí tính thêm phí/giao dịch vượt
- Admin xem được usage hiện tại + lịch sử hóa đơn, nâng cấp gói trực tiếp trong app
- **Nâng cấp gói qua PayOS:** Admin bấm nâng cấp → hệ thống tạo Payment Link/QR (PayOS account của chính PayPilot, không phải của doanh nghiệp) → thanh toán xong, webhook callback tự động kích hoạt gói mới

> Chi tiết đầy đủ bảng giá, cách đếm giao dịch, flow PayOS billing, API — xem [`RBAC.md`](./RBAC.md#-pricing-model--paypilot-tính-phí-doanh-nghiệp-như-thế-nào).

---

## 🔒 Security

### 1. Webhook Verification

Mỗi webhook từ Cas Balance Hook đều được xác thực trước khi xử lý:

```
Incoming Webhook (Cas Balance Hook)
        │
        ▼
Extract Signature Header
        │
        ▼
Verify Timestamp (chống Replay Attack)
        │
        ▼
Compute HMAC-SHA256(body, secret)
        │
        ▼
Compare Signatures
        │
Valid? → Process  |  Invalid? → 401
```

> **Lưu ý cần xác minh khi code thật:** Tài liệu Balance Hook chưa nêu rõ cơ chế ký webhook của Cas. Cần đọc kỹ `https://cas.so/general/api/webhook` trước khi code module này.
>
> **Đã xác nhận (khác với suy đoán ban đầu):** `grantId` trong payload **không phải** cơ chế bảo mật/xác thực — nó là cách để **định tuyến đúng tenant** trên 1 Webhook URL dùng chung cho toàn App (xem chi tiết tại mục Authentication & Liên kết ngân hàng). Việc verify tính toàn vẹn của webhook (chống giả mạo) và việc tra tenant_id (qua grantId) là 2 bước riêng biệt, cần làm cả hai.

### 2. Idempotency

Đảm bảo mỗi giao dịch chỉ được xử lý đúng một lần, tránh duplicate khi webhook retry:

```
Webhook arrives
        │
        ▼
Check transaction_id in Redis
        │
Exists? → Return 200 (skip)
        │
Not exists? → Process + Save to Redis (TTL: 24h)
```

### 3. Request Authentication

- **JWT Access Token** — short-lived (15 phút)
- **Refresh Token** — long-lived, lưu trong HttpOnly Cookie
- **Role-based Access Control (RBAC)** — 4 vai trò: **Cas Partner** (cấp hệ thống, xem toàn bộ tenant + doanh thu, khóa/mở tài khoản) / **Admin** (toàn quyền trong tenant) / **Accountant** (thao tác nghiệp vụ, không cấu hình hệ thống) / **Viewer** (chỉ xem)

> 📄 Chi tiết đầy đủ ma trận phân quyền theo từng tính năng, cách implement Guard/Decorator trong NestJS, và edge cases — xem file riêng [`RBAC.md`](./RBAC.md).

### 4. Rate Limiting

- Webhook endpoint: giới hạn theo IP
- Auth endpoint: giới hạn số lần đăng nhập sai
- Implement bằng **Redis + BullMQ**

### 5. Data Security

- Thông tin nhạy cảm (bank account, credentials) encrypt at rest
- Toàn bộ traffic qua HTTPS/TLS
- PII masking trong log
- Secret key quản lý qua environment variables, không hardcode

---

## 📐 Database Design

> 📄 Bản schema đầy đủ, đã gộp từ README này và `RBAC.md` (bảng `users`, `subscriptions`, `payment_orders`, `usage_logs`), kèm ERD quan hệ giữa các bảng — xem [`DATABASE_SCHEMA.md`](./DATABASE_SCHEMA.md). Phần dưới đây chỉ liệt kê các bảng nghiệp vụ cốt lõi để tham khảo nhanh.

### Core Tables

```
transactions
├── id
├── transaction_id (unique)    ← transaction.id từ payload Cas Balance Hook
├── grant_id                   ← copy từ webhook payload, dùng để trace lại tenant nào nhận
├── amount
├── sender_account
├── receiver_account
├── content                    ← nội dung chuyển khoản
├── transaction_date
├── status (pending / matched / review / skipped)
├── confidence_score
└── tenant_id                  ← tra ra từ grant_id lúc nhận webhook, lưu lại để query nhanh

invoices
├── id
├── invoice_code (unique)
├── customer_id (FK)
├── amount
├── paid_amount
├── status (unpaid / partial / paid / overpaid)
├── due_date
└── tenant_id

invoice_matches
├── id
├── transaction_id (FK)
├── invoice_id (FK)
├── matched_amount
├── confidence_score
├── match_type (auto / manual)
├── matched_by (ai / user_id)
└── created_at

customers
├── id
├── name
├── phone
├── email
├── account_numbers (array)    ← số tài khoản ngân hàng
├── embedding (vector)         ← pgvector cho AI matching
└── tenant_id

tenants
├── id
├── business_name              ← tự nhập khi đăng ký, không lấy từ Cas nữa
├── matching_threshold         ← mặc định 95
└── created_at

cas_grants
├── id
├── tenant_id (FK)
├── grant_id (unique, indexed)  ← trả về từ Cas khi exchange — DÙNG ĐỂ TRA TENANT khi webhook về
├── access_token (encrypted)    ← dùng để gọi các API Cas khác (vd: /identity)
├── account_number              ← số tài khoản ngân hàng đã liên kết
├── bank_name                   ← lấy từ GET /identity
├── status (active / invalidated)
└── linked_at

audit_logs
├── id
├── entity_type
├── entity_id
├── action
├── actor (user_id / system)
├── before_state (JSON)
├── after_state (JSON)
└── created_at
```

### Design Principles

- ACID Transaction
- Foreign Key Constraints
- Composite Index cho query phức tạp
- Soft Delete
- Optimistic Locking (tránh race condition khi nhiều webhook đến cùng lúc)
- pgvector Index cho embedding search

---

## 🌐 API Design

### REST API Endpoints

```
# ─────────────────────────────────────────
# AUTH — Email + mật khẩu (PayPilot tự quản lý)
# ─────────────────────────────────────────
POST   /api/v1/auth/register              # Đăng ký tenant mới + user đầu tiên (role: admin)
POST   /api/v1/auth/login                 # Đăng nhập, trả JWT Access Token + Refresh Token
POST   /api/v1/auth/logout                # Đăng xuất
POST   /api/v1/auth/refresh               # Refresh JWT token
GET    /api/v1/auth/me                    # Thông tin user hiện tại

# ─────────────────────────────────────────
# ONBOARDING — Liên kết ngân hàng qua Cas Link
# ─────────────────────────────────────────
POST   /api/v1/onboarding/banking/grant-token   # Backend gọi Cas /grant/token, trả grantToken cho FE mở Cas Link
POST   /api/v1/onboarding/banking/callback      # Nhận publicToken từ Cas Link redirect, gọi /grant/exchange lấy accessToken + grantId, lưu vào bảng cas_grants
GET    /api/v1/onboarding/status                # Trạng thái onboarding (bước mấy)

# ─────────────────────────────────────────
# WEBHOOK — Nhận giao dịch từ Cas Balance Hook
# ─────────────────────────────────────────
POST   /api/v1/webhook/cas                # Nhận webhook TRANSACTIONS từ Cas Balance Hook
                                          # MỘT URL DUY NHẤT cho toàn bộ App (cấu hình 1 lần
                                          # trên Cas Console), phân biệt tenant qua field
                                          # `grantId` có trong payload — query bảng cas_grants
                                          # WHERE grant_id = payload.grantId để tra tenant_id

# ─────────────────────────────────────────
# DASHBOARD — Tổng quan
# ─────────────────────────────────────────
GET    /api/v1/dashboard/overview         # Tổng doanh thu, giao dịch, công nợ
GET    /api/v1/dashboard/recent-transactions  # Feed giao dịch mới nhất
GET    /api/v1/dashboard/ai-stats         # AI matching accuracy rate

# ─────────────────────────────────────────
# TRANSACTIONS — Quản lý giao dịch
# ─────────────────────────────────────────
GET    /api/v1/transactions               # Danh sách giao dịch
                                          # ?status=pending|matched|review|skipped
                                          # ?from_date=&to_date=
                                          # ?page=&limit=
GET    /api/v1/transactions/:id           # Chi tiết giao dịch
GET    /api/v1/transactions/:id/matches   # Top 3 hóa đơn AI gợi ý + confidence
GET    /api/v1/transactions/:id/explanation  # AI explanation (lý do ghép)

# ─────────────────────────────────────────
# HUMAN REVIEW — Hàng chờ xét duyệt
# ─────────────────────────────────────────
GET    /api/v1/review/queue               # Danh sách giao dịch cần review
                                          # (confidence < 95%, chưa xử lý)
POST   /api/v1/review/:id/confirm         # Xác nhận ghép với hóa đơn AI gợi ý
POST   /api/v1/review/:id/reassign        # Ghép lại với hóa đơn khác
                                          # body: { invoice_id }
POST   /api/v1/review/:id/skip            # Bỏ qua giao dịch này

# ─────────────────────────────────────────
# INVOICES — Quản lý hóa đơn
# ─────────────────────────────────────────
GET    /api/v1/invoices                   # Danh sách hóa đơn
                                          # ?status=unpaid|partial|paid|overpaid
                                          # ?customer_id=
                                          # ?from_date=&to_date=
                                          # ?page=&limit=
POST   /api/v1/invoices                   # Tạo hóa đơn mới
GET    /api/v1/invoices/:id               # Chi tiết hóa đơn
PUT    /api/v1/invoices/:id               # Cập nhật hóa đơn
DELETE /api/v1/invoices/:id               # Xóa hóa đơn (soft delete)
GET    /api/v1/invoices/:id/qr            # Sinh QR ngân hàng công khai (VietQR) cho hóa đơn
                                          # (chứa số TK đã liên kết qua Cas Link, không qua Payment Gateway)
POST   /api/v1/invoices/import            # Import hóa đơn từ Excel/CSV
GET    /api/v1/invoices/export            # Export danh sách ra Excel

# ─────────────────────────────────────────
# CUSTOMERS — Quản lý khách hàng
# ─────────────────────────────────────────
GET    /api/v1/customers                  # Danh sách khách hàng
                                          # ?search= (tìm theo tên, SĐT, email)
                                          # ?page=&limit=
POST   /api/v1/customers                  # Tạo khách hàng mới
                                          # → tự động embedding + lưu pgvector
GET    /api/v1/customers/:id              # Chi tiết khách hàng
PUT    /api/v1/customers/:id              # Cập nhật thông tin
DELETE /api/v1/customers/:id              # Xóa (soft delete)
GET    /api/v1/customers/:id/invoices     # Danh sách hóa đơn của khách
GET    /api/v1/customers/:id/transactions # Lịch sử giao dịch của khách
POST   /api/v1/customers/import           # Import khách hàng từ Excel/CSV
                                          # → tự động embedding toàn bộ

# ─────────────────────────────────────────
# ANALYTICS — Báo cáo tài chính
# ─────────────────────────────────────────
GET    /api/v1/analytics/revenue          # Doanh thu theo ngày/tuần/tháng/quý
                                          # ?period=day|week|month|quarter
                                          # ?from_date=&to_date=
GET    /api/v1/analytics/cash-flow        # Cash flow (tiền vào / tiền ra)
GET    /api/v1/analytics/pending          # Công nợ chưa thu
                                          # ?overdue_days= (lọc quá hạn)
GET    /api/v1/analytics/top-customers    # Top khách hàng theo doanh thu
                                          # ?limit=10&period=month
GET    /api/v1/analytics/matching-stats   # AI matching stats
                                          # (auto/manual/skip rate)
GET    /api/v1/analytics/export           # Export báo cáo ra Excel

# ─────────────────────────────────────────
# AI — Copilot, Explain, Knowledge Base
# ─────────────────────────────────────────
POST   /api/v1/ai/copilot                 # Hỏi đáp ngôn ngữ tự nhiên
                                          # body: { message, history[] }
POST   /api/v1/ai/knowledge-base/upload   # Upload tài liệu nội bộ (PDF, DOCX)
GET    /api/v1/ai/knowledge-base          # Danh sách tài liệu đã upload
DELETE /api/v1/ai/knowledge-base/:id      # Xóa tài liệu

# ─────────────────────────────────────────
# SETTINGS — Cài đặt hệ thống
# ─────────────────────────────────────────
GET    /api/v1/settings/banking           # Danh sách tài khoản ngân hàng đã kết nối
DELETE /api/v1/settings/banking/:id       # Ngắt kết nối tài khoản
GET    /api/v1/settings/notifications     # Cấu hình notification
PUT    /api/v1/settings/notifications     # Cập nhật (Email/Slack/Discord webhook)
PUT    /api/v1/settings/matching-threshold # Chỉnh ngưỡng confidence (mặc định 95%)

# ─────────────────────────────────────────
# TEAM — Quản lý thành viên & phân quyền
# ─────────────────────────────────────────
GET    /api/v1/team/members               # Danh sách thành viên
POST   /api/v1/team/members/invite        # Mời thành viên mới (gửi email)
PUT    /api/v1/team/members/:id/role      # Đổi role (Admin/Accountant/Viewer)
DELETE /api/v1/team/members/:id           # Xóa thành viên

# ─────────────────────────────────────────
# AUDIT LOG — Lịch sử thao tác
# ─────────────────────────────────────────
GET    /api/v1/audit-logs                 # Toàn bộ audit log
                                          # ?entity_type=transaction|invoice|customer
                                          # ?actor=system|user_id
                                          # ?from_date=&to_date=
```

### Request / Response Examples

**Tạo hóa đơn:**
```json
// POST /api/v1/invoices
// Request
{
  "customer_id": "cus_abc123",
  "amount": 350000,
  "description": "Học phí tháng 1/2024",
  "due_date": "2024-01-31"
}

// Response
{
  "success": true,
  "data": {
    "id": "inv_xyz789",
    "invoice_code": "HD1025",
    "customer_id": "cus_abc123",
    "amount": 350000,
    "status": "unpaid",
    "due_date": "2024-01-31",
    "payment_link": null   // tạo riêng bằng POST /invoices/:id/payment-link
  }
}
```

**Webhook Cas Balance Hook đến — giao dịch mới:**
```json
// POST /api/v1/webhook/cas (URL CHUNG cho toàn bộ App, không phải riêng tenant)
{
  "webhookType": "TRANSACTIONS",
  "grantId": "4c657924-13f3-11ee-a4bb-42010a40001b",
  "transaction": {
    "id": "3cacecf693501",
    "amount": 350000,
    "description": "TT HD1025 Nguyen Van A",
    "transactionDateTime": "2024-01-15T09:30:00+07:00",
    "counterAccountName": "NGUYEN VAN A",
    "fiName": "Vietcombank"
  }
}

// Hệ thống xử lý tự động:
// → Query cas_grants WHERE grant_id = "4c657924-..." → tìm ra tenant_id
// → AI Matching → Confidence 96% → Auto match HD1025 → Notify kế toán
```

**AI Copilot:**
```json
// POST /api/v1/ai/copilot
// Request
{
  "message": "Khách nào còn nợ trên 30 ngày?",
  "history": []
}

// Response
{
  "success": true,
  "data": {
    "reply": "Có 3 khách hàng công nợ quá hạn trên 30 ngày:\n• Nguyễn Văn A — 2,400,000đ (45 ngày)\n• Trần Thị B — 1,200,000đ (38 ngày)\n• Lê Văn C — 800,000đ (32 ngày)",
    "tool_used": "get_overdue_customers",
    "data": [...]
  }
}
```

### API Best Practices

- RESTful API
- OpenAPI / Swagger Documentation
- DTO Validation (class-validator)
- Global Exception Filter
- API Versioning (`/api/v1/...`)
- Pagination mặc định (`page`, `limit`, `total`)
- Filter qua query params
- Consistent Response Format

```json
{
  "success": true,
  "data": {},
  "meta": {
    "timestamp": "2024-01-15T10:30:00Z",
    "request_id": "req_abc123",
    "page": 1,
    "limit": 20,
    "total": 150
  },
  "error": null
}
```

---

## 📡 Reliability & Observability

- **Structured Logging** — JSON log format với context đầy đủ
- **Request ID** — mỗi request có ID duy nhất
- **Correlation ID** — theo dõi request xuyên suốt hệ thống
- **Health Check** endpoint (`/health`)
- **Audit Log** — ghi lại toàn bộ quyết định AI và thao tác người dùng
- **Graceful Shutdown** — xử lý hết request đang chạy trước khi tắt
- **Circuit Breaker** — khi AI service chậm, fallback về rule-based matching

---

## ☁️ Deployment

### Infrastructure

- VPS do công ty cấp
- Domain do công ty cấp
- Docker Compose
- Nginx Reverse Proxy
- HTTPS (Let's Encrypt)
- GitHub Actions CI/CD

### Service Architecture

```
            Internet
                │
                ▼
         HTTPS (443)
                │
                ▼
             Nginx
                │
    ┌───────────┴───────────┐
    │                       │
    ▼                       ▼
React Frontend          NestJS Backend
Port 3001               Port 3000
                            │
            ┌───────────────┼───────────────┐
            ▼               ▼               ▼
       PostgreSQL          Redis          BullMQ
       + pgvector
```

### CI/CD Pipeline

```
GitHub Push
    │
    ▼
GitHub Actions
    │
    ├── Lint & Type Check
    ├── Unit Tests
    ├── Integration Tests
    ├── Build Docker Images
    │     ├── nestjs-backend
    │     └── react-frontend
    │
    ▼
SSH VPS
    │
    ▼
docker compose pull
    │
    ▼
docker compose up -d
    │
    ▼
Health Check
```

### HTTPS Configuration

- SSL/TLS Certificate bằng Let's Encrypt
- Certbot tự động gia hạn chứng chỉ
- HTTP Redirect sang HTTPS
- HSTS Header
- Reverse Proxy bằng Nginx

---

## 🖥 Frontend UI/UX

Giao diện được thiết kế cho **kế toán và quản lý tài chính** của doanh nghiệp — ưu tiên đơn giản, trực quan, thao tác nhanh.

### Onboarding Flow

Doanh nghiệp mới trải qua 4 bước, bắt đầu bằng đăng ký email/mật khẩu thông thường:

```
Bước 1: Đăng ký tài khoản
(tên doanh nghiệp, email, mật khẩu
 → tạo tenant mới, user đầu tiên có role admin)
        │
        ▼
Bước 2: Liên kết tài khoản ngân hàng qua Cas Link
(bấm "Liên kết ngân hàng" → mở Cas Link (iframe)
 → đăng nhập Internet Banking ngay trong đó
 → Cas trả về publicToken → PayPilot đổi lấy accessToken + grantId
 → lưu vào bảng cas_grants, hiện tên ngân hàng + số TK đã liên kết)
        │
        ▼
Bước 3: Import khách hàng
(nhập tay hoặc import từ Excel/CSV)
        │
        ▼
Bước 4: Tạo hóa đơn đầu tiên
(hoặc import từ Excel)
        │
        ▼
Hệ thống sẵn sàng nhận giao dịch
(giao dịch tự động về qua webhook chung của App,
 PayPilot tự nhận diện đúng tenant qua grantId)
```

**Lưu ý quan trọng:** Không có bước "nhận Webhook URL riêng" như thiết kế trước đó — Webhook chỉ cần cấu hình **1 lần duy nhất ở cấp App** trên Cas Developer Console (`console.bankhub.dev` → Developer → Webhooks), là thao tác kỹ thuật nội bộ của đội PayPilot khi setup, hoàn toàn không phải việc của từng doanh nghiệp khi Onboarding.

---

### Các màn hình chính

#### 1. Dashboard — Tổng quan

Màn hình đầu tiên khi đăng nhập, hiển thị:

- **Tổng doanh thu** hôm nay / tuần / tháng
- **Giao dịch mới** chưa xử lý
- **Hóa đơn chưa thanh toán** và tổng công nợ
- **AI Matching accuracy** — tỷ lệ ghép tự động
- **Biểu đồ** doanh thu theo thời gian (Recharts)
- **Feed giao dịch real-time** — giao dịch mới từ Cas Balance Hook hiện lên ngay

---

#### 2. Transactions — Quản lý giao dịch

Danh sách toàn bộ giao dịch nhận được từ Cas Balance Hook:

| Cột | Mô tả |
|---|---|
| Thời gian | Giờ phút giao dịch |
| Số tiền | Formatted VND |
| Nội dung | Nội dung chuyển khoản gốc |
| Khách hàng | AI xác định được hoặc "Chưa xác định" |
| Hóa đơn | Hóa đơn AI ghép được hoặc "Chưa ghép" |
| Confidence | Badge màu: xanh ≥95%, vàng 50-95%, đỏ <50% |
| Trạng thái | Matched / Review / Pending / Skipped |

**Filter:** theo trạng thái, thời gian, ngân hàng, số tiền

**Click vào giao dịch** → xem chi tiết:
- Thông tin đầy đủ giao dịch
- Hóa đơn AI gợi ý (top 3) với confidence score
- AI Explanation — lý do ghép
- Nút: Confirm / Reassign / Skip

---

#### 3. Human Review Queue — Hàng chờ xét duyệt

Danh sách giao dịch có Confidence Score < 95% cần kế toán xác nhận:

```
┌─────────────────────────────────────────────┐
│ 🔔 3 giao dịch cần xem xét                  │
├─────────────────────────────────────────────┤
│ TXN_001 | 350,000đ | "tien hang"            │
│ AI gợi ý: Hóa đơn #1025 (72%)              │
│ [✅ Xác nhận] [🔄 Chọn hóa đơn khác] [⏭ Bỏ qua] │
├─────────────────────────────────────────────┤
│ TXN_002 | 1,200,000đ | "CK thang 1"        │
│ AI gợi ý: Hóa đơn #1031 (68%)              │
│ [✅ Xác nhận] [🔄 Chọn hóa đơn khác] [⏭ Bỏ qua] │
└─────────────────────────────────────────────┘
```

---

#### 4. Invoices — Quản lý hóa đơn

Danh sách toàn bộ hóa đơn:

| Cột | Mô tả |
|---|---|
| Mã hóa đơn | #1025 |
| Khách hàng | Nguyễn Văn A |
| Số tiền | 350,000đ |
| Đã thanh toán | 350,000đ |
| Trạng thái | Unpaid / Partial / Paid / Overpaid |
| Hạn thanh toán | 15/01/2024 |

**Tạo hóa đơn mới:**
- Form nhập: khách hàng, số tiền, mô tả, hạn thanh toán
- Hiển thị QR ngân hàng công khai (VietQR) chứa số tài khoản đã liên kết → tải về hoặc gửi cho khách

**Import hóa đơn:**
- Upload file Excel/CSV
- Preview trước khi import
- Hệ thống tự embedding và lưu pgvector

---

#### 5. Customers — Quản lý khách hàng

Danh sách khách hàng:

| Cột | Mô tả |
|---|---|
| Tên | Nguyễn Văn A |
| Số điện thoại | 0901234567 |
| Email | a@gmail.com |
| Số tài khoản | 1234567890 (Vietcombank) |
| Tổng công nợ | 1,200,000đ |
| Lần thanh toán cuối | 15/01/2024 |

**Thêm khách hàng mới:**
- Form nhập thông tin
- Hệ thống tự embedding tên + thông tin → lưu pgvector

**Import khách hàng:**
- Upload Excel/CSV
- Map cột tự động

---

#### 6. Analytics — Báo cáo tài chính

- **Doanh thu** theo ngày / tuần / tháng / quý (biểu đồ line)
- **Cash Flow** — tiền vào / tiền ra (biểu đồ bar)
- **Công nợ** — tổng chưa thu, quá hạn, sắp đến hạn
- **Top khách hàng** theo doanh thu
- **AI Matching Stats** — tỷ lệ auto match, human review, skip
- **Export** báo cáo ra Excel

---

#### 7. AI Copilot — Chat tài chính

Giao diện chat đơn giản, kế toán gõ câu hỏi:

```
┌─────────────────────────────────────────────┐
│ 💬 AI Copilot                               │
├─────────────────────────────────────────────┤
│ 🤖 Xin chào! Tôi có thể giúp gì cho bạn?  │
│                                             │
│ 👤 Doanh thu tháng này bao nhiêu?          │
│                                             │
│ 🤖 Tháng 1/2024, tổng doanh thu đạt        │
│    125,500,000đ — tăng 12% so với          │
│    tháng trước.                             │
│                                             │
│ 👤 Khách nào còn nợ trên 30 ngày?         │
│                                             │
│ 🤖 Có 3 khách hàng công nợ quá hạn:       │
│    • Nguyễn Văn A — 2,400,000đ (45 ngày)  │
│    • Trần Thị B — 1,200,000đ (38 ngày)    │
│    • Lê Văn C — 800,000đ (32 ngày)        │
├─────────────────────────────────────────────┤
│ [Nhập câu hỏi...]              [Gửi ↵]    │
└─────────────────────────────────────────────┘
```

---

#### 8. Settings — Cài đặt

- **Banking** — nút "Liên kết tài khoản ngân hàng mới" (mở Cas Link), danh sách tài khoản đã liên kết (tên ngân hàng, số TK, ngày liên kết)
- **Notification** — cấu hình Email / Slack / Discord
- **Team** — quản lý thành viên và phân quyền (RBAC)
- **Knowledge Base** — upload tài liệu nội bộ cho RAG
- **Confidence Threshold** — chỉnh ngưỡng auto match (mặc định 95%)

---

### UX Principles

- **Realtime first** — giao dịch mới hiện lên ngay không cần refresh (WebSocket hoặc polling)
- **Action-oriented** — mỗi màn hình có một hành động chính rõ ràng
- **AI transparent** — luôn hiển thị confidence score và lý do AI quyết định
- **Mobile-friendly** — kế toán có thể review và approve trên điện thoại

---

## 👨‍💻 Team Responsibilities

### Lê Ngọc Anh — 23520048

**Backend & AI Integration**
- Business Analysis & Domain Modeling
- System Architecture Design
- Database Design
- NestJS Backend Core
- Webhook Integration (Cas Balance Hook — 1 URL chung, routing qua grantId)
- Authentication: Email/mật khẩu (JWT + Refresh Token, PayPilot tự quản lý)
- Cas Link Integration: Grant/Exchange flow để liên kết tài khoản ngân hàng (sandbox thật)
- RBAC: Guard/Decorator, 4 vai trò (Cas Partner / Admin / Accountant / Viewer) — chi tiết tại `RBAC.md`
- Partner module: API cho Partner Dashboard (`/partner/*`)
- Security (Webhook Verification, Idempotency)
- Observability & Logging

**AI / LLM**
- AI Transaction Matching Pipeline
- AI Customer Matching
- LangChain Pipeline
- RAG (AI Knowledge Base)
- LLM Explainer
- AI Copilot
- pgvector Embedding Search

### Lưu Nguyễn Thế Vinh — 22521653

**Frontend**
- React Development
- Analytics Dashboard UI
- Invoice Management UI
- Customer Management UI
- Transaction Monitor UI
- Human Review UI
- AI Copilot UI
- Partner Dashboard UI (layout riêng cho Cas Partner)

**Backend Modules**
- Invoice Module
- Customer Module
- Notification Module
- Alert Module
- Team Module (mời thành viên, quản lý role trong tenant)

**DevOps**
- Docker & Docker Compose
- GitHub Actions CI/CD
- VPS Deployment & Nginx
- HTTPS Configuration

**Testing & Documentation**
- Unit Testing & Integration Testing
- API Integration
- Project Documentation

---

## 🗺 Roadmap

### MVP

- Authentication: Email/mật khẩu (đăng ký + đăng nhập)
- Multi-Tenant cơ bản (1 Webhook URL chung, routing đúng doanh nghiệp qua grantId)
- Cas Balance Hook Integration (sandbox thật, qua Cas Link Grant/Exchange)
- Sinh QR ngân hàng công khai (VietQR) cho hóa đơn
- Customer Management
- Invoice Management
- Transaction Management
- AI Transaction Matching (basic)
- Human Review Queue
- Simple Dashboard

### Production

- AI Matching Pipeline đầy đủ (Semantic + Rule-based + Confidence Scoring)
- AI Customer Matching
- AI Invoice Assistant (Partial / Over / Multiple Payment)
- AI Explain
- AI Copilot
- Analytics Dashboard
- Notification Center (Email, Slack)
- Audit Log
- Observability
- RBAC 4 vai trò (Cas Partner / Admin / Accountant / Viewer) — xem [`RBAC.md`](./RBAC.md)
- Partner Dashboard cơ bản (xem danh sách tenant, khóa/mở tài khoản)
- Billing cơ bản: tracking usage theo gói, hiển thị quota đã dùng (chưa tính tiền thật)

### Enterprise

- AI Knowledge Base (RAG)
- Workflow Automation Builder
- RBAC nâng cao (custom role, fine-grained permission)
- Partner Dashboard đầy đủ (doanh thu, usage analytics chi tiết)
- Billing đầy đủ: tự động tính phí vượt quota, xuất hóa đơn, tích hợp cổng thanh toán cho việc gia hạn gói
- ERP Integration (MISA, KiotViet, Odoo)
- CRM Integration
- Audit & Compliance Report

### AI Platform

- Model Feedback Loop (quyết định Human Review → cải thiện AI)
- Predictive Cash Flow
- AI Financial Insights
- Public REST API
- Webhook SDK
- Plugin cho ERP/CRM

---

## 🔮 Future Enhancements

- **Payment Gateway cho nghiệp vụ (PayOS hoặc tương tự)** — khác với PayOS billing đã có (dùng để nâng cấp gói), đây là việc cho phép doanh nghiệp tạo payment link gửi online cho khách hàng cuối của họ (thay vì chỉ QR ngân hàng tĩnh), phù hợp khi cần workflow thanh toán từ xa chủ động hơn
- **PayOS production** — đăng ký tài khoản PayOS thật cho luồng billing, thay thế Postman mock
- **Production Cas keys** — xin `x-client-id`/`x-secret-key` môi trường production từ Cas (hiện tại đang dùng sandbox key)
- **OCR Invoice** — đọc hóa đơn scan, tự động tạo invoice trong hệ thống
- **ERP Connector** — SAP, Odoo, MISA, KiotViet
- **Open Banking Integration** — kết nối trực tiếp API ngân hàng
- **Predictive Cash Flow** — dự báo dòng tiền dựa trên lịch sử
- **AI Accounting Assistant** — hỗ trợ hạch toán, xuất báo cáo thuế
- **MCP Integration** — tích hợp với các công cụ AI khác
- **Mobile App** — kế toán review và approve trên điện thoại

---

## 📊 Project Highlights

- **Tích hợp Cas SDK sandbox thật** — Grant/Link/Exchange flow để liên kết ngân hàng, không chỉ mock
- AI-powered Transaction Matching (Semantic + Rule-based + Confidence Scoring)
- Multi-Tenant qua 1 Webhook URL chung — routing thông minh bằng `grantId`
- Explainable AI — giải thích lý do ghép giao dịch bằng tiếng Việt
- Human-in-the-loop — Human Review cho giao dịch confidence thấp
- AI Feedback Loop — cải thiện matching từ quyết định của người dùng
- AI Copilot — hỏi đáp tài chính bằng ngôn ngữ tự nhiên
- RAG Knowledge Base — AI đọc tài liệu nội bộ doanh nghiệp
- pgvector Embedding Search cho Customer & Invoice Matching
- Monolithic Modular Architecture (NestJS)
- Production Deployment on VPS
- HTTPS with SSL/TLS
- GitHub Actions CI/CD
- Docker Compose
- Redis Cache & BullMQ Background Jobs
- RESTful API with Swagger Documentation
- Webhook Verification (HMAC-SHA256 + Replay Attack Protection)
- Idempotency with Redis
- JWT Authentication & RBAC
- Circuit Breaker (AI fallback về rule-based)
- Structured Logging & Observability
- ACID Transactions & Optimistic Locking
- Multi-Tenant Support
- Audit Log & Compliance
