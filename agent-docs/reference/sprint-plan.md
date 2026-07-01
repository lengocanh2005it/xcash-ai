# 📅 PayPilot AI — Sprint Plan

**Tổng thời gian:** 8 tuần (4 sprints × 2 tuần)
**Mục tiêu cuối:** Hệ thống production-ready, có demo được với hội đồng

---

## 📊 Tổng quan 4 Sprints

| Sprint | Tuần | Mục tiêu | Kết quả có thể demo |
|---|---|---|---|
| Sprint 1 | 1–2 | Foundation + Core Backend + RBAC nền tảng | API chạy được, webhook nhận giao dịch, Guard phân quyền hoạt động |
| Sprint 2 | 3–4 | AI Engine + Invoice/Customer (có áp role) | AI matching hoạt động |
| Sprint 3 | 5–6 | Frontend + Cas Partner + Partner Dashboard | UI đầy đủ, kết nối BE, Partner xem được toàn bộ tenant |
| Sprint 4 | 7–8 | Polish + Deploy + Demo | Hệ thống chạy production |

---

## 🏃 Sprint 1 — Foundation & Core Backend

**Tuần 1–2**
**Mục tiêu:** Dựng skeleton hệ thống, kết nối Cas, nhận được giao dịch thật

---

### Lê Ngọc Anh (Backend + AI)

**Tuần 1:**

- [ ] Khởi tạo NestJS project với Monolithic Modular Architecture
- [ ] Cấu hình PostgreSQL + Prisma ORM + pgvector extension
- [ ] Cấu hình Redis + BullMQ
- [ ] Thiết kế và migrate database schema (tenants, transactions, invoices, customers, audit_logs)
- [ ] Auth module: Email + mật khẩu (PayPilot tự quản lý, không qua Cas)
  - `POST /api/v1/auth/register` — tạo tenant mới + user đầu tiên (role: admin)
  - `POST /api/v1/auth/login` — verify password (bcrypt), issue JWT Access Token + Refresh Token
  - `POST /api/v1/auth/refresh`, `POST /api/v1/auth/logout`
- [ ] Cas SDK setup (sandbox thật — đã có `x-client-id`/`x-secret-key` từ `sandbox.console.bankhub.dev`):
  - Wrap HTTP client gọi Cas API (`https://sandbox.bankhub.dev`), gắn sẵn header `x-client-id`, `x-secret-key`, `X-BankHub-Api-Version`
  - Test thử 1 request POST `/grant/token` bằng Postman để xác nhận key hoạt động trước khi code
- [ ] RBAC foundation (xem chi tiết tại `RBAC.md`):
  - Role enum: `cas_partner / admin / accountant / viewer`
  - `RolesGuard` + `@Roles()` decorator
  - `PartnerGuard` riêng cho route `/partner/*` (check `tenant_id === null`)
  - Migrate bảng `users` với cột `password_hash`, `role`, `tenant_id` (nullable cho Cas Partner)
  - User đầu tiên đăng ký tenant → tự gán role `admin`
- [ ] Swagger setup

**Tuần 2:**

- [ ] Cas Link module (Grant/Exchange — sandbox thật):
  - `POST /api/v1/onboarding/banking/grant-token` — gọi `POST /grant/token` (scope `qrpay` hoặc `virtual_account`), trả `grantToken` cho FE
  - `POST /api/v1/onboarding/banking/callback` — nhận `publicToken` từ Cas Link redirect, gọi `POST /grant/exchange` lấy `accessToken` + `grantId`, gọi `GET /identity` lấy thông tin tài khoản, lưu vào bảng `cas_grants` (kèm `tenant_id`, `grant_id` indexed)
  - Migrate bảng `cas_grants` (xem schema trong README)
  - Test thử bằng tài khoản demo Cas: `bankusrdemo1` / `soproud` / OTP `123456`
- [ ] Cấu hình Webhook trên Cas Console (thao tác thủ công 1 lần, KHÔNG phải code):
  - Vào `sandbox.console.bankhub.dev` → Developer → Webhooks → Thêm Webhooks
  - Loại: `TRANSACTIONS`, URL: `https://<ngrok-id>.ngrok-free.app/api/v1/webhook/cas` khi dev local (`ngrok http 3000`); production dùng URL public HTTPS
  - Đây là webhook DUY NHẤT cho toàn bộ App PayPilot — không lặp lại thao tác này cho từng tenant
- [ ] Banking module: nhận webhook Balance Hook
  - Webhook endpoint `POST /api/v1/webhook/cas` — **1 URL DUY NHẤT, không có `:tenantId` trong path**
  - Đọc field `grantId` từ payload → query bảng `cas_grants WHERE grant_id = ?` → tra ra `tenant_id`
  - Verify request — **cần đọc kỹ `https://cas.so/general/api/webhook` trước khi code phần này**, xem ghi chú trong README phần Security
  - Idempotency với Redis (TTL 24h), dùng `transaction.id` từ payload Cas làm key
  - Save transaction vào DB kèm `tenant_id` (tra được từ `grantId`) và `grant_id` (để trace lại sau)
- [ ] Transaction module: CRUD cơ bản
  - `GET /api/v1/transactions` với filter + pagination
  - `GET /api/v1/transactions/:id`
- [ ] Onboarding endpoints:
  - `GET /api/v1/onboarding/status`

---

### Lưu Nguyễn Thế Vinh (Frontend + DevOps)

**Tuần 1:**

- [ ] Khởi tạo React project (Vite + TypeScript)
- [ ] Cấu hình Tailwind CSS + ShadCN/UI
- [ ] Cài TanStack Query + Axios instance (base URL, interceptors, token refresh)
- [ ] Setup Docker Compose (nestjs + postgres + redis + react)
- [ ] Setup GitHub Actions CI/CD pipeline cơ bản
- [ ] Deploy lên VPS, cấu hình Nginx + HTTPS

**Tuần 2:**

- [x] Layout chính: Sidebar + Header + Main content (`TenantLayout`)
- [x] Routing setup (React Router) + `ProtectedRoute` / `GuestRoute`
- [x] Màn hình Auth: form Register (tên DN, email, mật khẩu) + Login
- [x] Màn hình Onboarding bước 2: nút "Liên kết ngân hàng" → mở Cas Link popup, xử lý redirect callback
- [x] API client cho Auth (email/password) + Onboarding (Cas Link flow)
- [x] Toggle dark/light mode (`ThemeProvider`, `ThemeToggle`, `localStorage` key `paypilot-theme`)
- [x] Responsive: sidebar drawer mobile (`lg`), card list giao dịch `<md`
- [x] **Design system Casso/payOS:** nền trắng `#FFFFFF`, primary `#16AB64`, surface `#F8FAFB`, text `#1E2022` — xem `03-frontend-conventions.md` + `ui-design.md` mục Brand palette
- [x] **ShadCN/UI first:** primitives từ `@/components/ui` (button, card, table, label...); thêm component qua `shadcn add`, không tự viết HTML thuần — docs: [ui.shadcn.com/docs/components](https://ui.shadcn.com/docs/components)

**Ghi chú design (bắt buộc cho mọi màn Sprint 2+):** Mọi page mới phải dùng token `primary`/`background` từ `index.css` và component ShadCN (`Button`, `Card`, `Table`...). Tham chiếu: [casso.vn](https://casso.vn), [payos.vn](https://payos.vn), [ShadCN components](https://ui.shadcn.com/docs/components), `03-frontend-conventions.md` mục ShadCN/UI.

---

### Sprint 1 — Definition of Done

- [ ] NestJS server chạy được, Swagger accessible
- [ ] Đăng ký/đăng nhập email + mật khẩu hoạt động
- [ ] RolesGuard + @Roles() decorator hoạt động, test thử với 1 endpoint mẫu
- [ ] User đầu tiên của tenant tự động có role `admin`
- [ ] Đã cấu hình 1 Webhook URL chung trên Cas Console (qua ngrok khi dev local), test "Gọi thử" thành công
- [ ] Gọi thử thành công `/grant/token` → mở Cas Link → đăng nhập bằng tài khoản demo (`bankusrdemo1`) → nhận `publicToken` → đổi `accessToken` + `grantId` thành công, lưu vào `cas_grants`
- [ ] Cas webhook gửi giao dịch test về đúng URL chung → backend tra đúng `tenant_id` qua `grantId`
- [ ] Transaction được lưu vào DB kèm đúng tenant_id
- [ ] JWT issue sau khi login thành công, refresh + logout hoạt động
- [ ] Docker Compose chạy local
- [ ] CI/CD deploy lên VPS thành công
- [ ] UI Đăng ký/Đăng nhập + Onboarding (liên kết ngân hàng thật qua Cas Link) hoạt động
- [ ] UI responsive + theme Casso/payOS (`#16AB64` / nền trắng) trên auth, dashboard, transactions

---

## 🤖 Sprint 2 — AI Engine + Business Logic

**Tuần 3–4**
**Mục tiêu:** AI Transaction Matching hoạt động, quản lý Invoice + Customer đầy đủ

---

### Lê Ngọc Anh (Backend + AI)

**Tuần 3:**

- [ ] AI Module — Transaction Matching Pipeline:
  - Gọi OpenAI Embedding API cho nội dung giao dịch
  - pgvector similarity search tìm invoice gần nhất
  - Rule-based validation (số tiền, ngày hạn)
  - Confidence Score calculation
  - Auto match nếu score ≥ 95%, queue Human Review nếu < 95%
- [ ] AI Module — Customer Matching:
  - Embedding khách hàng khi tạo mới
  - Match tên/SĐT từ nội dung giao dịch
- [ ] Invoice module:
  - CRUD đầy đủ
  - `POST /api/v1/invoices`
  - `GET /api/v1/invoices` với filter
  - `GET /api/v1/invoices/:id`
  - `PUT /api/v1/invoices/:id`
  - `DELETE /api/v1/invoices/:id` (soft delete)
  - `GET /api/v1/invoices/:id/qr` (sinh QR ngân hàng công khai — VietQR — chứa số TK đã liên kết qua Cas Link)
  - `POST /api/v1/invoices/import` (parse Excel/CSV)
  - Tự động embedding khi tạo invoice → lưu pgvector
  - Áp `@Roles(Admin, Accountant)` cho create/update/delete/import theo bảng `RBAC.md`; xem (GET) cho phép cả Viewer

**Tuần 4:**

- [ ] Customer module:
  - CRUD đầy đủ
  - `POST /api/v1/customers/import` (parse Excel/CSV)
  - Tự động embedding khi tạo → lưu pgvector
  - `GET /api/v1/customers/:id/invoices`
  - `GET /api/v1/customers/:id/transactions`
  - Áp `@Roles(Admin, Accountant)` cho create/update/delete/import; xem (GET) cho phép cả Viewer
- [ ] Human Review module:
  - `GET /api/v1/review/queue`
  - `POST /api/v1/review/:id/confirm`
  - `POST /api/v1/review/:id/reassign`
  - `POST /api/v1/review/:id/skip`
  - Áp `@Roles(Admin, Accountant)` cho confirm/reassign/skip — Viewer chỉ xem queue, không thao tác
- [ ] AI Explain endpoint:
  - `GET /api/v1/transactions/:id/explanation`
  - Gọi OpenAI để generate explanation tiếng Việt
- [ ] Workflow Automation:
  - BullMQ job: sau khi nhận webhook → trigger AI matching pipeline
  - Notification job: gửi email/slack sau khi match
- [ ] Audit Log: ghi lại mọi action

---

### Lưu Nguyễn Thế Vinh (Frontend + DevOps)

**Tuần 3:**

- [ ] Màn hình Dashboard:
  - Stats cards (doanh thu, giao dịch, review count, AI accuracy)
  - Revenue LineChart (Recharts)
  - Recent Transactions feed (polling 10s)
- [ ] Màn hình Transactions:
  - Table với filter (status, source, date)
  - Confidence Badge (xanh/vàng/đỏ)
  - Transaction Detail Sheet (từ phải)
  - AI Suggestion top 3 trong Sheet

**Tuần 4:**

- [ ] Màn hình Human Review Queue:
  - Review Card với AI suggestion + explanation collapsible
  - 3 action buttons: Confirm / Reassign / Skip
  - Reassign Dialog: tìm kiếm hóa đơn
  - Toast success + card disappear animation
- [ ] Màn hình Invoices:
  - Table với filter
  - Tạo hóa đơn Dialog
  - Invoice Detail Sheet với lịch sử thanh toán
  - Import Excel Dialog (drag & drop)
- [ ] Update CI/CD: thêm test step

---

### Sprint 2 — Definition of Done

- [ ] AI Matching pipeline chạy end-to-end: webhook → embedding → match → update invoice
- [ ] Confidence Score hiển thị đúng, auto match ≥ 95%
- [ ] Human Review queue có giao dịch, confirm/reassign/skip hoạt động
- [ ] Invoice CRUD + import Excel hoạt động
- [ ] Customer CRUD + embedding hoạt động
- [ ] Dashboard hiển thị data thật
- [ ] AI Explanation generate được bằng tiếng Việt

---

## 🎨 Sprint 3 — Frontend Complete + Cas Partner + AI Copilot + Analytics

**Tuần 5–6**
**Mục tiêu:** UI đầy đủ 8 màn hình nghiệp vụ + Partner Dashboard, AI Copilot hoạt động, Analytics có data, RBAC áp dụng đầy đủ

---

### Lê Ngọc Anh (Backend + AI)

**Tuần 5:**

- [ ] AI Copilot module:
  - `POST /api/v1/ai/copilot`
  - Định nghĩa Function Calling tools cho OpenAI:
    - `get_revenue(from_date, to_date)`
    - `get_pending_invoices(customer_id, overdue_days)`
    - `get_top_customers(limit, period)`
    - `get_overdue_customers(days)`
    - `get_cash_flow(period)`
  - LangChain pipeline: user message → OpenAI function calling → NestJS execute → format response
- [ ] Analytics module:
  - `GET /api/v1/analytics/revenue?period=`
  - `GET /api/v1/analytics/cash-flow`
  - `GET /api/v1/analytics/pending?overdue_days=`
  - `GET /api/v1/analytics/top-customers?limit=`
  - `GET /api/v1/analytics/matching-stats`
  - `GET /api/v1/analytics/export` (xuất Excel)

**Tuần 6:**

- [ ] RAG Knowledge Base module:
  - `POST /api/v1/ai/knowledge-base/upload` (PDF, DOCX)
  - Parse + chunk tài liệu
  - Embedding từng chunk → lưu pgvector
  - `GET /api/v1/ai/knowledge-base`
  - `DELETE /api/v1/ai/knowledge-base/:id`
  - Tích hợp RAG vào AI Copilot: tìm đoạn liên quan trước khi gọi OpenAI
- [ ] Settings module:
  - `GET/PUT /api/v1/settings/notifications`
  - `GET/PUT /api/v1/settings/matching-threshold`
  - `GET/DELETE /api/v1/settings/banking`
- [ ] Team module:
  - `GET /api/v1/team/members`
  - `POST /api/v1/team/members/invite`
  - `PUT /api/v1/team/members/:id/role`
  - `DELETE /api/v1/team/members/:id`
  - Toàn bộ endpoint chỉ `@Roles(Admin)` — Accountant/Viewer không truy cập được (xem `RBAC.md`)
  - Validate: không cho xóa/đổi role nếu đó là Admin cuối cùng của tenant
- [ ] Dashboard endpoint bổ sung:
  - `GET /api/v1/dashboard/overview`
  - `GET /api/v1/dashboard/ai-stats`
- [ ] **Partner module** (route `/partner/*`, chỉ `cas_partner` qua `PartnerGuard`):
  - Migrate bảng `subscriptions`, `usage_logs`
  - `GET /api/v1/partner/tenants` — danh sách toàn bộ tenant, kèm plan/status/usage tóm tắt
  - `GET /api/v1/partner/tenants/:id` — chi tiết usage + revenue, KHÔNG trả dữ liệu nghiệp vụ (tên khách hàng, nội dung giao dịch)
  - `PATCH /api/v1/partner/tenants/:id/suspend` — khóa tenant (chặn login toàn bộ user trong tenant đó)
  - `PATCH /api/v1/partner/tenants/:id/activate` — mở khóa
  - `GET /api/v1/partner/revenue` — tổng doanh thu toàn hệ thống
  - `GET /api/v1/partner/usage-stats` — số giao dịch, AI calls theo tenant
  - `GET /api/v1/partner/audit-logs` — audit log toàn hệ thống (mọi tenant)
  - Seed thử 1 tài khoản `cas_partner` thủ công (tạo trực tiếp trong DB, không qua form đăng ký thông thường) để dev/demo
- [ ] **Billing module** (xem chi tiết model giá + flow đếm quota tại `RBAC.md` mục Pricing Model):
  - Mỗi tenant mới đăng ký tự động tạo `subscriptions` với `plan = 'free'`, `transaction_quota = 50`
  - Hook vào Banking module — thứ tự xử lý đúng: idempotency check (tránh đếm trùng khi Cas retry webhook) → check quota → lưu transaction → `transaction_used_this_cycle += 1` ngay lập tức (KHÔNG đợi AI Matching chạy xong, vì 1 giao dịch tính phí ngay khi nhận webhook, bất kể kết quả Auto Match/Review/Skip)
  - Gói Free vượt quota → từ chối lưu transaction, trả lỗi "đã hết quota tháng này", không chạy AI Matching cho giao dịch đó
  - Gói trả phí (Starter/Pro) vượt quota → vẫn lưu + xử lý bình thường, ghi `usage_logs` với `metric = 'overage_transaction'` để tính phí cuối kỳ — không từ chối
  - `GET /api/v1/billing/current-plan` — gói hiện tại + usage
  - BullMQ cron job hàng ngày: kiểm tra tenant nào hết `current_cycle_end` → reset `transaction_used_this_cycle` về 0
  - Migrate bảng `payment_orders` (xem schema trong `RBAC.md`)
  - `POST /api/v1/billing/upgrade` — tạo `payment_orders` record (`order_code = "UPG-{tenant_id}-{timestamp}"`), gọi PayOS API tạo Payment Link, trả QR + URL về cho FE
  - `POST /api/v1/webhook/payos-billing` — nhận callback PayOS, parse `order_code` để lấy `tenant_id`, verify HMAC, update `subscriptions` sang `target_plan` mới
  - **Lưu ý:** PayOS account này thuộc về PayPilot (1 account chung), KHÔNG liên quan đến PayOS đã loại bỏ ở luồng nghiệp vụ — test bằng Postman mock vì chưa có tài khoản PayOS thật

---

### Lưu Nguyễn Thế Vinh (Frontend + DevOps)

**Tuần 5:**

- [ ] Màn hình Customers:
  - Table + search
  - Customer Detail Sheet với Tabs (Hóa đơn / Giao dịch)
  - Import Excel Dialog
- [ ] Màn hình Analytics:
  - Stats row (3 cards)
  - Revenue LineChart
  - Cash Flow BarChart
  - Top customers list
  - AI Matching Stats PieChart
  - Export Excel button
- [ ] Màn hình AI Copilot:
  - Chat UI (bubble left/right)
  - Typing indicator animation
  - Suggested questions chips
  - Conversation history

**Tuần 6:**

- [ ] Màn hình Settings (tabs):
  - Tab Banking: nút "Liên kết thêm tài khoản ngân hàng" (mở Cas Link) + danh sách tài khoản đã liên kết (từ bảng `cas_grants`)
  - Tab Billing: hiển thị gói hiện tại + progress bar usage/quota, nút "Nâng cấp" mở Dialog hiện QR PayOS + polling trạng thái thanh toán
  - Tab Notification: Email/Slack/Discord toggle + input
  - Tab Team: invite + role management (ẩn hoàn toàn tab này nếu user không phải Admin)
  - Tab AI Knowledge Base: upload + list docs
  - Tab Threshold: Slider chỉnh ngưỡng confidence (chỉ Admin chỉnh được, Accountant xem read-only)
- [ ] **Partner Dashboard UI** (route `/partner`, layout riêng KHÔNG dùng chung Sidebar 8 mục — xem `UI_DESIGN.md` mục 9):
  - Top nav đơn giản, không sidebar nghiệp vụ
  - Stats row: tổng DN, DN active, tổng GD, doanh thu
  - Revenue LineChart
  - Tenant Table với action Khóa/Mở khóa + AlertDialog confirm trước khi khóa
  - Tenant Detail Sheet: chỉ hiện usage + revenue, không hiện dữ liệu nghiệp vụ chi tiết
  - `ProtectedRoute` check role `cas_partner`, redirect role khác về `/dashboard`
- [ ] Polish toàn bộ UI:
  - Loading skeleton cho tất cả màn hình
  - Empty state có illustration
  - Error state + retry
  - Toast notifications (Sonner)
  - Mobile responsive cơ bản
  - Ẩn/disable nút theo role bằng hook `usePermission()` (xem `RBAC.md`)
- [ ] Update Docker Compose production config

---

### Sprint 3 — Definition of Done

- [ ] 8 màn hình FE nghiệp vụ hoàn chỉnh, kết nối BE thật
- [ ] Partner Dashboard hoạt động: xem danh sách tenant, khóa/mở tài khoản, thấy doanh thu
- [ ] RBAC áp dụng đầy đủ — thử login bằng 3 role khác nhau, kiểm tra đúng nút/tab bị ẩn theo `RBAC.md`
- [ ] AI Copilot trả lời được ít nhất 5 loại câu hỏi
- [ ] RAG Knowledge Base upload + query hoạt động
- [ ] Analytics hiển thị đầy đủ biểu đồ với data thật
- [ ] Settings lưu được cấu hình
- [ ] Toàn bộ UI có loading + empty + error state

---

## 🚀 Sprint 4 — Polish + Testing + Deploy + Demo Prep

**Tuần 7–8**
**Mục tiêu:** Hệ thống production-ready, có demo script, sẵn sàng báo cáo hội đồng

---

### Lê Ngọc Anh (Backend + AI)

**Tuần 7:**

- [ ] Security hardening:
  - Rate limiting cho tất cả endpoint
  - Input validation toàn bộ DTO
  - PII masking trong log
  - Environment variables check khi startup
- [ ] Observability:
  - Structured logging (JSON format)
  - Request ID + Correlation ID
  - Health check endpoint `/health`
  - Circuit Breaker khi OpenAI API chậm (fallback rule-based)
- [ ] Performance:
  - Index PostgreSQL cho các query thường dùng
  - Redis cache cho analytics queries
  - BullMQ retry logic khi AI call fail
- [ ] Fix bugs từ Sprint 3

**Tuần 8:**

- [ ] Viết Unit Test cho AI Matching pipeline
- [ ] Viết Integration Test cho webhook flow
- [ ] Seed data demo:
  - 10 khách hàng mẫu
  - 20 hóa đơn mẫu
  - Script gửi mock webhook (normal + fraud-like + borderline)
- [ ] Chuẩn bị demo environment riêng (không dùng production data)
- [ ] Viết API documentation đầy đủ trên Swagger

---

### Lưu Nguyễn Thế Vinh (Frontend + DevOps)

**Tuần 7:**

- [ ] Production Docker Compose:
  - Multi-stage build (nhỏ image size)
  - Health check cho từng service
  - Restart policy
- [ ] CI/CD hoàn chỉnh:
  - Lint + Type check
  - Unit test
  - Build Docker image
  - Push to registry
  - SSH deploy VPS
  - Health check sau deploy
- [ ] Nginx production config:
  - Gzip compression
  - Cache static assets
  - Security headers
- [ ] Frontend performance:
  - Code splitting (lazy load từng route)
  - Optimize bundle size

**Tuần 8:**

- [ ] End-to-end testing: test toàn bộ flow từ FE
- [ ] Fix bugs từ testing
- [ ] Chuẩn bị demo:
  - Seed data demo lên production
  - Test kịch bản demo 3 lần
  - Chuẩn bị Postman collection mock webhook
- [ ] Quay video demo (~5 phút)
- [ ] Cập nhật README final

---

### Sprint 4 — Definition of Done

- [ ] Hệ thống chạy stable trên VPS production
- [ ] HTTPS hoạt động
- [ ] CI/CD deploy tự động khi push main
- [ ] Demo script chạy trơn tru end-to-end
- [ ] Video demo quay xong
- [ ] README + tài liệu hoàn chỉnh
- [ ] Không có bug nghiêm trọng

---

## 📋 Task Priority Legend

| Ký hiệu | Nghĩa |
|---|---|
| 🔴 Must have | Bắt buộc phải có, không có không demo được |
| 🟡 Should have | Quan trọng, cố gắng hoàn thành trong sprint |
| 🟢 Nice to have | Nếu còn thời gian thì làm |

### Phân loại theo priority

**🔴 Must have (không có không demo được):**
- Authentication (email/password) + RBAC Guard cơ bản (Admin/Accountant/Viewer)
- Cas Balance Hook webhook + AI Matching pipeline
- Invoice + Customer CRUD
- Human Review queue
- Dashboard + Transactions UI
- Deploy lên VPS + HTTPS

**🟡 Should have:**
- AI Copilot
- Analytics Dashboard
- Partner Dashboard (Cas Partner xem tenant + doanh thu)
- Billing module (tracking quota theo gói + nâng cấp gói qua PayOS mock)
- QR ngân hàng công khai cho hóa đơn
- Import Excel
- Notification (Email)

**🟢 Nice to have:**
- RAG Knowledge Base
- Slack/Discord notification
- AI Explain chi tiết
- Export Excel
- Mobile responsive
- Partner Dashboard nâng cao (khóa/mở tài khoản, billing chi tiết)

---

## ⚠️ Rủi ro và cách xử lý

| Rủi ro | Khả năng | Cách xử lý |
|---|---|---|
| OpenAI API rate limit | Trung bình | Cache embedding, batch request, dùng model nhỏ hơn |
| Cas sandbox không ổn định hoặc thay đổi cơ chế webhook bất ngờ | Thấp | Đã có Postman mock dự phòng theo đúng payload mẫu (`transactions_sample.xlsx`), chuyển qua dùng tạm nếu sandbox lỗi |
| `grantToken` hết hạn (30 phút) trước khi user kịp đăng nhập Cas Link | Trung bình | FE xử lý timeout rõ ràng, cho phép tạo lại grantToken mới dễ dàng |
| Webhook chung 1 URL cho App nhưng cấu hình sai trên Cas Console (do thao tác thủ công, không qua API) | Trung bình | Note rõ trong docs nội bộ, có nút "Gọi thử" để verify ngay sau khi cấu hình |
| Cơ chế xác thực tính toàn vẹn của Balance Hook webhook chưa rõ ràng  | Trung bình | Đọc kỹ `cas.so/general/api/webhook` trước khi code Sprint 1 tuần 2. Lưu ý: `grantId` chỉ dùng để routing đúng tenant, không thay thế việc verify webhook có đến từ Cas thật hay không |
| AI Matching accuracy thấp | Trung bình | Tăng cường Rule-based validation, hạ threshold |
| Hết thời gian | Cao | Cắt Nice-to-have, tập trung Must-have |
| Bug production | Trung bình | Có demo environment riêng tách khỏi production |
| RBAC cấu hình sai khiến lộ dữ liệu giữa các tenant | Trung bình | Test kỹ Sprint 1 ngay khi có RolesGuard, không để dồn đến Sprint 4 mới kiểm tra |
| Cas Partner vô tình gọi được API nghiệp vụ của tenant | Thấp nhưng nghiêm trọng nếu xảy ra | Tách route `/partner/*` hoàn toàn riêng, review kỹ Guard trước khi merge (xem lưu ý bảo mật trong `RBAC.md`) |

---

## 📅 Timeline tổng hợp

```
Tuần 1  ████████ Foundation: NestJS, DB, Auth (email/password), RBAC Guard, Docker, CI/CD
Tuần 2  ████████ Cas Link Grant/Exchange, Balance Hook webhook, Transaction BE, Layout FE, Onboarding UI
Tuần 3  ████████ AI Matching, Invoice BE (+role), Dashboard + Transactions UI
Tuần 4  ████████ Customer BE (+role), Human Review BE+UI, Invoice UI
Tuần 5  ████████ AI Copilot, Analytics BE, Customers + Analytics UI
Tuần 6  ████████ RAG, Settings BE+UI, Partner module BE+UI, AI Copilot UI, Polish
Tuần 7  ████████ Security, Observability, Performance, DevOps production
Tuần 8  ████████ Testing, Seed data, Demo prep, Video, Final docs
        │       │       │       │       │
      W1      W3      W5      W7      W8
              ↑               ↑       ↑
           MVP done     Feature    Demo
                        complete   ready
```

---

## 🤝 Git Workflow

```
main          ← production, chỉ merge từ develop
develop       ← integration branch
  ├── feature/ngocAnh/cas-link-grant
  ├── feature/ngocAnh/cas-webhook
  ├── feature/ngocAnh/ai-matching
  ├── feature/ngocAnh/rbac-guard
  ├── feature/ngocAnh/partner-module
  ├── feature/theVinh/dashboard-ui
  ├── feature/theVinh/invoice-ui
  └── feature/theVinh/partner-dashboard-ui
```

- Mỗi feature → branch riêng
- Pull Request → review → merge vào develop
- Cuối sprint → merge develop vào main → CI/CD deploy
- Commit message: `feat:`, `fix:`, `chore:`, `refactor:`
