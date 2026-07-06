# 🔐 X-Cash AI — RBAC (Role-Based Access Control)

> Tài liệu này định nghĩa đầy đủ vai trò người dùng, quyền hạn theo từng tính năng, và cách implement trong NestJS. Dùng làm tham chiếu khi viết Guard/Decorator cho từng API endpoint.

---

## 👤 4 Vai trò trong hệ thống

| Role | Mô tả | Ai thường giữ vai trò này |
|---|---|---|
| **Cas Partner** | Vai trò cấp hệ thống (system-level) — nhìn xuyên suốt mọi tenant, xem doanh thu, khóa/mở tài khoản, hỗ trợ kỹ thuật | Nhân sự Cas/CASSO, không thuộc về một doanh nghiệp cụ thể nào |
| **Admin** | Toàn quyền trong phạm vi tenant của mình — cấu hình hệ thống, quản lý nhân sự, thao tác nghiệp vụ | Chủ doanh nghiệp, người đăng ký tài khoản đầu tiên (tạo tenant) |
| **Accountant** | Đầy đủ quyền thao tác nghiệp vụ hàng ngày, không đụng vào cấu hình hệ thống | Kế toán, nhân viên tài chính |
| **Viewer** | Chỉ xem báo cáo, không thao tác chỉnh sửa gì | Giám đốc, kế toán trưởng theo dõi từ xa |

### Phân biệt quan trọng: Cas Partner vs Admin

```
Cas Partner                          Admin
─────────────                        ─────
Nhìn TẤT CẢ tenant                   Chỉ nhìn tenant CỦA MÌNH
Không thuộc doanh nghiệp nào         Thuộc về 1 doanh nghiệp cụ thể
Xem doanh thu X-Cash AI thu được      Không thấy dữ liệu của tenant khác
Khóa/mở tài khoản doanh nghiệp       Không có quyền này
KHÔNG thao tác nghiệp vụ             Thao tác đầy đủ trong tenant mình
(không tạo hóa đơn, sửa khách hàng)
```

> **Lưu ý quan trọng:** Cas Partner **không phải là Admin "cấp cao hơn" trong một tenant** — đây là vai trò hoàn toàn tách biệt, sống ở tầng hệ thống (system-level), không gắn với `tenant_id` nào cả. Cas Partner không tự ý sửa dữ liệu nghiệp vụ của doanh nghiệp (hóa đơn, khách hàng, giao dịch) để tránh xung đột trách nhiệm — chỉ có quyền quản trị vận hành và xem tổng quan.

### Nguyên tắc thiết kế

- **Cas Partner** được tạo thủ công bởi đội ngũ X-Cash AI (không tự đăng ký được qua form thông thường) — vì đây là tài khoản nội bộ đại diện cho đối tác Cas/CASSO.
- **Admin** là vai trò duy nhất được tạo tự động khi đăng ký tenant mới (`POST /auth/register`) — không ai khác có thể tự phong mình làm Admin.
- **Accountant** có quyền gần như Admin ở phần nghiệp vụ (giao dịch, hóa đơn, khách hàng) nhưng **không được** đổi cấu hình hệ thống (API key, threshold, webhook) hay quản lý nhân sự — tránh rủi ro vận hành do thao tác nhầm.
- **Viewer** tuyệt đối read-only — phù hợp cho người chỉ cần theo dõi số liệu mà không cần (và không nên) thao tác vào hệ thống.
- Một tenant có thể có **nhiều Admin** nếu Admin đầu tiên mời thêm — nhưng nên hạn chế số lượng Admin để giảm rủi ro.

---

## 🏢 Cas Partner — Vai trò cấp hệ thống

Đây là role đặc biệt, khác hẳn 3 role còn lại vì không gắn với một tenant cụ thể nào.

### Quyền hạn

| Tính năng | Mô tả |
|---|---|
| Xem danh sách toàn bộ doanh nghiệp (tenant) | Tên, ngày đăng ký, trạng thái (active/suspended), gói dịch vụ |
| Xem tổng quan usage | Tổng số giao dịch xử lý, AI Matching calls, số lượng user mỗi tenant |
| Xem doanh thu | Doanh thu X-Cash AI thu từ từng tenant theo gói cước, tổng doanh thu toàn hệ thống |
| Khóa / mở tài khoản doanh nghiệp | Tạm ngưng tenant vi phạm điều khoản hoặc quá hạn thanh toán |
| Hỗ trợ kỹ thuật | Xem log lỗi, webhook delivery status của từng tenant để debug hộ khi doanh nghiệp báo lỗi |
| Xem Audit Log toàn hệ thống | Khác với Audit Log của Admin (chỉ thấy tenant mình), Cas Partner thấy được audit log mọi tenant |

### Giới hạn (KHÔNG có quyền)

- ❌ Không tạo/sửa/xóa hóa đơn, khách hàng, giao dịch của bất kỳ tenant nào
- ❌ Không đổi AI Matching Threshold của tenant
- ❌ Không xem nội dung chi tiết giao dịch nhạy cảm (chỉ xem số liệu tổng hợp, không xem từng giao dịch cụ thể trừ khi tenant chủ động yêu cầu hỗ trợ)
- ❌ Không mời/xóa thành viên trong nội bộ một tenant

### Màn hình riêng — Partner Dashboard

```
┌─────────────────────────────────────────────────────┐
│ Header: "Partner Dashboard" (route /partner riêng)   │
├─────────────────────────────────────────────────────┤
│ Stats Row (grid grid-cols-4 gap-4)                   │
│ ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐│
│ │Tổng DN   │ │DN active │ │Tổng GD    │ │Doanh thu ││
│ │  127     │ │  118     │ │xử lý tháng│ │tháng này ││
│ │↑8 mới    │ │9 suspended│ │ 1.2M giao │ │45.8M đ   ││
│ │tháng này │ │          │ │dịch       │ │↑15%      ││
│ └──────────┘ └──────────┘ └──────────┘ └──────────┘│
├─────────────────────────────────────────────────────┤
│ Table: Danh sách doanh nghiệp                        │
│ Tên DN | Gói | Trạng thái | GD/tháng | Doanh thu | Action│
│ TT Anh ngữ ABC│Pro│🟢 Active│2,400│2,500,000đ│[Xem][Khóa]│
│ Phòng khám XYZ│Free│🟢 Active│450│0đ│[Xem][Nâng cấp]│
│ Shop Online K │Pro│🔴 Suspended│0│0đ│[Xem][Mở khóa]│
├─────────────────────────────────────────────────────┤
│ Revenue Chart (LineChart) — Doanh thu theo tháng     │
└─────────────────────────────────────────────────────┘
```

### API riêng cho Cas Partner

```
# Tất cả endpoint dưới /api/v1/partner/* chỉ Cas Partner gọi được (PartnerGuard)
# ─── ĐÃ TRIỂN KHAI ───
GET    /api/v1/partner/tenants              # Danh sách DN — filter search/status/plan; ?page=&limit= → { items, page, limit, total, totalPages } (mặc định 20/trang trên FE Tenants); không truyền page/limit → trả full list (Partner Dashboard dùng cho MRR/plan breakdown)
GET    /api/v1/partner/tenants/:id          # Chi tiết 1 DN (plan, GD tháng, AI accuracy, members)
GET    /api/v1/partner/stats                # Tổng quan hệ thống (gộp usage-stats; ?fromDate=&toDate=)
GET    /api/v1/partner/revenue-trend        # Doanh thu theo tháng + breakdown theo gói (mặc định 6 tháng)
GET    /api/v1/partner/payments             # Lịch sử payment_orders toàn hệ thống (phân trang + summary)
PATCH  /api/v1/partner/tenants/:id/suspend  # Khóa tài khoản doanh nghiệp
PATCH  /api/v1/partner/tenants/:id/activate # Mở khóa tài khoản doanh nghiệp
PATCH  /api/v1/partner/tenants/:id/plan     # Đặt gói bất kỳ cho tenant (Partner, không chặn downgrade)
GET    /api/v1/partner/plan-pricing         # Xem giá/quota/phí vượt từng gói
PATCH  /api/v1/partner/plan-pricing/:plan   # Sửa giá/quota Starter+ (Free cố định)
GET    /api/v1/partner/audit-logs           # Audit log toàn hệ thống — phân trang, lọc tenantId/action

# ─── CHƯA LÀM (spec gốc, không chặn go-live) ───
GET    /api/v1/partner/revenue              # Tổng quan doanh thu (một phần đã có trong /stats và /revenue-trend)
GET    /api/v1/partner/revenue/:tenantId    # Doanh thu 1 tenant tách riêng
GET    /api/v1/partner/usage-stats          # Tách riêng (đã gộp vào GET /partner/stats)
GET    /api/v1/partner/system-health        # Health + webhook delivery status
```

> Ghi chú trạng thái: danh sách **đã triển khai** khớp `partner.controller.ts` — xem bảng API đầy đủ trong `agent-docs/00-current-state.md`. FE Partner: `/partner/dashboard`, `/partner/tenants` (paginate 20/trang), `/partner/payments`, `/partner/audit-logs`, `/partner/plans` — layout **sidebar riêng** (`PartnerLayout`), không dùng sidebar 8 mục tenant.

### Database Schema bổ sung

> 📄 Bản schema đã gộp đầy đủ (không còn 2 định nghĩa `users` khác nhau như trước) — xem [`DATABASE_SCHEMA.md`](./DATABASE_SCHEMA.md). Bảng dưới đây giữ lại để tham khảo nhanh trong ngữ cảnh Cas Partner.

```
users
├── id
├── tenant_id (FK, nullable)   ← NULL nếu là Cas Partner (không thuộc tenant nào)
├── name
├── email
├── password_hash              ← bcrypt, đăng nhập email/password thuần
├── role (cas_partner / admin / accountant / viewer)
├── invited_by (FK → users.id, null nếu là Admin đầu tiên)
├── invited_at
└── created_at

subscriptions
├── id
├── tenant_id (FK)
├── plan (free / starter / pro / enterprise)
├── price_per_month
├── transaction_quota         ← số giao dịch tối đa/tháng theo gói
├── transaction_used_this_cycle  ← reset về 0 đầu mỗi chu kỳ
├── overage_price_per_transaction  ← phí mỗi giao dịch vượt quota (null nếu Enterprise không giới hạn)
├── status (active / suspended / cancelled)
├── started_at
├── current_cycle_start
└── current_cycle_end

payment_orders                ← lịch sử thanh toán nâng cấp gói qua PayOS
├── id
├── tenant_id (FK)
├── order_code (unique)       ← dạng "UPG-{tenant_id}-{timestamp}", dùng để định tuyến khi PayOS callback
├── target_plan (starter / pro / enterprise)
├── amount
├── status (pending / paid / expired / failed)
├── paid_at
└── created_at

usage_logs
├── id
├── tenant_id (FK)
├── metric (transaction_count / ai_matching_calls / storage_mb)
├── value
└── recorded_at
```

### Implementation Guard

```typescript
// Cas Partner check tenant_id = null, khác hoàn toàn check role thông thường
@Injectable()
export class PartnerGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const { user } = context.switchToHttp().getRequest();
    return user.role === Role.CAS_PARTNER && user.tenantId === null;
  }
}

// Áp dụng
@Controller('partner')
@UseGuards(JwtAuthGuard, PartnerGuard)
export class PartnerController {
  @Get('tenants')
  findAllTenants() { ... }

  @Patch('tenants/:id/suspend')
  suspendTenant() { ... }
}
```

> **Lưu ý bảo mật quan trọng:** Mọi controller nghiệp vụ khác (Invoice, Customer, Transaction...) phải dùng `RolesGuard` thông thường — **tuyệt đối không cho Cas Partner đi qua các Guard đó**, kể cả khi họ có JWT hợp lệ. Cas Partner chỉ được phép gọi các endpoint dưới `/partner/*`. Việc tách route namespace rõ ràng giúp tránh lỗi cấu hình nhầm khiến Cas Partner vô tình truy cập được dữ liệu nghiệp vụ chi tiết của doanh nghiệp.

---

## 💰 Pricing Model — X-Cash AI tính phí doanh nghiệp như thế nào

### Hai lớp chi phí cần phân biệt

```
Lớp 1: X-Cash AI trả phí cho Casso
       (1 App, tính theo TỔNG giao dịch của TẤT CẢ tenant cộng lại)
                     │
                     ▼
Lớp 2: X-Cash AI thu phí TỪNG doanh nghiệp
       (theo số giao dịch RIÊNG của doanh nghiệp đó/tháng)
```

Doanh nghiệp khách hàng **không** trả tiền trực tiếp cho Casso — họ chỉ liên kết ngân hàng qua Cas Link và trả phí dịch vụ cho X-Cash AI. X-Cash AI là bên đứng giữa, gộp chi phí hạ tầng (trả cho Casso) vào giá bán cho khách hàng cuối.

### Bảng giá theo số giao dịch/tháng

| Gói | Giá/tháng | Số giao dịch bao gồm | Phí vượt quota | Số tài khoản NH | Tính năng |
|---|---|---|---|---|---|
| **Free** | 0đ | 50 giao dịch | Không cho vượt — khóa tạm đến chu kỳ sau | 1 | AI Matching cơ bản, Dashboard, Human Review |
| **Starter** | 299.000đ | 500 giao dịch | 800đ/giao dịch | 2 | + AI Copilot, Analytics, Notification Email |
| **Pro** | 799.000đ | 2.000 giao dịch | 600đ/giao dịch | 5 | + RAG Knowledge Base, Slack/Discord, Export Excel |
| **Enterprise** | Liên hệ | Không giới hạn | — | Không giới hạn | + Partner support riêng, SLA, Custom Integration |

> Đây là bảng giá minh họa cho mục đích đồ án — số liệu có thể điều chỉnh khi triển khai thật, nhưng cấu trúc theo bậc (tier) dựa trên số giao dịch là mô hình phù hợp vì bám sát đúng cách Casso tính phí ở lớp hạ tầng phía dưới.

### Cách đếm "giao dịch" để tính phí

> **Định nghĩa nhất quán với Casso:** 1 giao dịch = 1 lần Cas Balance Hook bắn webhook về (1 lần biến động số dư), bất kể AI Matching kết quả là Auto Match, Human Review, hay Skip — vì X-Cash AI vẫn phải trả phí cho Casso ngay khi nhận webhook đó, không phụ thuộc kết quả xử lý sau này.

**Vì sao tính ngay lúc nhận webhook, không phải lúc AI xử lý xong?** Vì chi phí X-Cash AI trả cho Casso (lớp hạ tầng phía dưới) cũng tính theo số webhook nhận được, không phải theo việc AI ghép đúng hay sai. Dù giao dịch sau đó Auto Match, vào Human Review, hay bị Skip — cả 3 trường hợp đều đã tốn 1 lượt quota, vì backend đã phải nhận và xử lý webhook đó rồi.

```
Cas Balance Hook gửi webhook về
        │
        ▼
Backend nhận, tra tenant_id qua cas_grants.grant_id
        │
        ▼
Check quota TRƯỚC khi lưu transaction (xem flow dưới)
        │
        ▼
Lưu vào bảng transactions
        │
        ▼
ĐỒNG THỜI: subscriptions.transaction_used_this_cycle += 1
(cộng 1 lượt ngay tại đây, KHÔNG đợi AI Matching chạy xong)
        │
        ▼
Tiếp tục chạy AI Matching Pipeline như bình thường
```

**Flow check quota đầy đủ:**

```
Webhook về
        │
        ▼
Query subscriptions của tenant này (theo tenant_id vừa tra ra)
        │
        ▼
transaction_used_this_cycle >= transaction_quota?
        │
   ┌────┴────┐
   │         │
 Chưa đầy   Đã đầy
   │         │
   ▼         ▼
Lưu transaction,    Gói Free → từ chối lưu, trả response báo lỗi
+= 1 lượt,          "Đã hết quota tháng này", KHÔNG chạy AI Matching
chạy AI Matching    (giao dịch coi như chưa được xử lý, mất luôn —
bình thường         vì đây là gói miễn phí, không nợ)
                         │
                    Gói trả phí (Starter/Pro) → VẪN lưu + xử lý bình
                    thường, nhưng cộng dồn overage_price_per_transaction
                    vào hóa đơn cuối kỳ (không từ chối khách hàng trả tiền)
                         │
                    Gói Enterprise → không bao giờ rơi vào nhánh này
                    vì transaction_quota = NULL (không giới hạn)
```

**Implementation mẫu (NestJS):**

```typescript
// src/modules/banking/banking.service.ts
async handleWebhook(payload: CasWebhookPayload) {
  const grant = await this.casGrantRepo.findOne({
    where: { grantId: payload.grantId },
  });
  if (!grant) throw new NotFoundException('Unknown grant');

  const tenantId = grant.tenantId;
  const subscription = await this.subscriptionRepo.findOne({
    where: { tenantId, status: 'active' },
  });

  const isOverQuota =
    subscription.transactionQuota !== null &&
    subscription.transactionUsedThisCycle >= subscription.transactionQuota;

  if (isOverQuota && subscription.plan === 'free') {
    // Free hết quota → từ chối, không lưu transaction
    throw new ForbiddenException('Đã hết quota tháng này. Vui lòng nâng cấp gói.');
  }

  // Lưu transaction (luôn chạy nếu không bị từ chối ở trên)
  await this.transactionRepo.save({
    tenantId,
    grantId: payload.grantId,
    transactionId: payload.transaction.id,
    amount: payload.transaction.amount,
    content: payload.transaction.description,
    // ...
  });

  // Tăng usage NGAY, không đợi AI Matching
  await this.subscriptionRepo.increment(
    { tenantId },
    'transactionUsedThisCycle',
    1,
  );

  // Nếu vượt quota nhưng là gói trả phí → ghi nhận overage (không chặn)
  if (isOverQuota && subscription.plan !== 'free') {
    await this.usageLogRepo.save({
      tenantId,
      metric: 'overage_transaction',
      value: 1,
    });
  }

  // Tiếp tục chạy AI Matching Pipeline như bình thường
  await this.aiMatchingService.process(transaction);
}
```

**Edge case cần lưu ý:** Idempotency (đã có ở Security mục Webhook Verification) phải chạy **trước** bước đếm quota — nếu Cas gửi trùng 1 webhook (do retry), không được đếm 2 lần cho cùng 1 `transaction_id`.

### Reset chu kỳ & nâng cấp gói

- `current_cycle_start` / `current_cycle_end` xác định khung 30 ngày của subscription, `transaction_used_this_cycle` reset về 0 khi sang chu kỳ mới (chạy bằng BullMQ cron job hàng ngày kiểm tra tenant nào hết chu kỳ)
- Doanh nghiệp có thể nâng cấp gói giữa chu kỳ — tính phí theo tỷ lệ ngày còn lại (proration), tương tự cách Casso xử lý khi đổi gói
- **Cas Partner** (xem mục dưới) là người duy nhất có quyền xem được tổng doanh thu X-Cash AI thu từ tất cả tenant, và doanh thu theo từng tenant cụ thể

### Nâng cấp gói qua PayOS — PayOS billing dành riêng cho X-Cash AI

> **Phân biệt quan trọng:** Đây là **PayOS account của chính X-Cash AI** (1 account duy nhất), khác hẳn với việc dùng PayOS để doanh nghiệp nhận tiền từ khách hàng cuối (đã quyết định bỏ, dùng QR ngân hàng công khai thay thế — xem README mục System Context). Ở đây, **X-Cash AI là bên bán**, doanh nghiệp là bên mua gói dịch vụ.

```
Admin vào Settings → Billing
        │
        ▼
Thấy gói hiện tại (vd: Free, 32/50 giao dịch đã dùng)
        │
        ▼
Bấm "Nâng cấp lên Pro — 799.000đ/tháng"
        │
        ▼
X-Cash AI Backend gọi PayOS API tạo Payment Link
body: {
  orderCode: "UPG-{tenant_id}-{timestamp}",
  amount: 799000,
  description: "X-Cash AI Pro - {tenant_id}",
  returnUrl, cancelUrl
}
        │
        ▼
Hiện QR + link thanh toán (giao diện PayOS) cho Admin
        │
        ▼
Admin quét QR, chuyển khoản
(trong phạm vi dự án: mock callback qua Postman, xem README)
        │
        ▼
PayOS gửi webhook callback về X-Cash AI
POST /api/v1/webhook/payos-billing
        │
        ▼
X-Cash AI verify, đọc orderCode → tách ra tenant_id
        │
        ▼
Update subscriptions: plan = 'pro', transaction_quota = 2000,
reset current_cycle_start/end
        │
        ▼
Admin thấy gói đã đổi ngay trên UI (TanStack Query invalidate)
```

**Lưu ý triển khai thực tế:** SDK `@payos/node` yêu cầu `orderCode` là **số nguyên** — không dùng chuỗi `UPG-{tenant_id}-...`. `tenantId` được tra qua bảng `PaymentOrder` khi webhook callback, không parse từ `orderCode`.

### API liên quan đến Pricing & Billing

```
# ─── ĐÃ TRIỂN KHAI ───
GET    /api/v1/billing/plans                        # Danh sách gói + giá/quota (plan_pricing)
GET    /api/v1/billing/current-plan                 # Gói hiện tại + quota đã dùng
GET    /api/v1/billing/usage-history                # Lịch sử usage theo tháng (Admin)
POST   /api/v1/billing/upgrade                      # Tạo PaymentOrder + PayOS link (Admin)
POST   /api/v1/billing/upgrade/:orderCode/mock-confirm  # Dev-only — giả lập thanh toán upgrade
GET    /api/v1/billing/overage-orders             # Đơn phí vượt quota đang chờ (Admin)
POST   /api/v1/billing/overage-order                # Tạo đơn overage + PayOS link (Admin)
POST   /api/v1/billing/overage-order/:orderCode/mock-confirm  # Dev-only — giả lập overage
POST   /api/v1/webhook/payos-billing               # Public — callback PayOS (upgrade + overage)

# ─── CHƯA LÀM ───
GET    /api/v1/billing/invoices                     # Lịch sử hóa đơn PDF (không có trong scope hiện tại)
```

---

## 📋 Ma trận phân quyền đầy đủ (cấp Tenant)

> Bảng dưới đây áp dụng cho 3 role trong phạm vi 1 tenant: Admin / Accountant / Viewer. Cas Partner không nằm trong bảng này vì hoạt động ở route riêng `/partner/*` đã mô tả ở trên.

| Nhóm | Tính năng | Admin | Accountant | Viewer |
|---|---|:---:|:---:|:---:|
| **Dashboard & Analytics** | Xem Dashboard tổng quan | ✅ | ✅ | ✅ |
| | Xem Analytics chi tiết | ✅ | ✅ | ✅ |
| | Xuất báo cáo Excel | ✅ | ✅ | ✅ |
| **Transactions** | Xem danh sách giao dịch | ✅ | ✅ | ✅ |
| | Xem chi tiết giao dịch | ✅ | ✅ | ✅ |
| | Xem AI Explanation | ✅ | ✅ | ✅ |
| **Human Review** | Xem queue cần review | ✅ | ✅ | ✅ |
| | Xác nhận định khoản AI gợi ý | ✅ | ✅ | ❌ |
| **Thông báo in-app** | Xem danh sách thông báo | ✅ | ✅ | ✅ |
| | Đánh dấu đã đọc / đọc tất cả | ✅ | ✅ | ✅ |
| | Xóa thông báo (1 / nhiều / tất cả) | ✅ | ✅ | ✅ |
| | Sửa định khoản (chọn TK Nợ/Có khác) | ✅ | ✅ | ❌ |
| | Skip giao dịch | ✅ | ✅ | ❌ |
| | Yêu cầu AI định khoản lại (giao dịch pending) | ✅ | ✅ | ❌ |
| **Định khoản** | Xem định khoản giao dịch | ✅ | ✅ | ✅ |
| | Ghi đè định khoản thủ công | ✅ | ✅ | ❌ |
| **Danh mục TK (TT133)** | Xem danh mục tài khoản | ✅ | ✅ | ✅ |
| | Thêm tài khoản con | ✅ | ✅ | ❌ |
| | Sửa tài khoản | ✅ | ✅ | ❌ |
| | Ẩn/xóa tài khoản | ✅ | ❌ | ❌ |
| **AI Copilot** | Đặt câu hỏi cho AI Copilot | ✅ | ✅ | ✅ |
| **AI Knowledge Base (RAG)** | Xem danh sách tài liệu | ✅ | ✅ | ❌ |
| | Upload tài liệu mới | ✅ | ❌ | ❌ |
| | Xóa tài liệu | ✅ | ❌ | ❌ |
| **Settings — Banking** | Xem danh sách tài khoản ngân hàng đã liên kết | ✅ | ✅ | ❌ |
| | Liên kết tài khoản ngân hàng mới (mở Cas Link) | ✅ | ✅ | ❌ |
| **Settings — Notification** | Xem cấu hình notification | ✅ | ❌ | ❌ |
| | Cập nhật Email/Slack/Discord webhook | ✅ | ❌ | ❌ |
| **Settings — AI Classification** | Xem ngưỡng confidence hiện tại (mặc định 85%) | ✅ | ✅ | ❌ |
| | Đổi ngưỡng confidence (threshold) | ✅ | ❌ | ❌ |
| **Billing** | Xem gói hiện tại + usage | ✅ | ✅ | ❌ |
| | Nâng cấp gói / xem hóa đơn | ✅ | ❌ | ❌ |
| **Team Management** | Xem danh sách thành viên | ✅ | ❌ | ❌ |
| | Mời thành viên mới | ✅ | ❌ | ❌ |
| | Đổi role của thành viên | ✅ | ❌ | ❌ |
| | Xóa thành viên | ✅ | ❌ | ❌ |
| **Audit Log** | Xem audit log | ✅ | ✅ | ❌ |

---

## 🛠 Implementation trong NestJS

### 1. Định nghĩa Role Enum

```typescript
// src/common/enums/role.enum.ts
export enum Role {
  ADMIN = 'admin',
  ACCOUNTANT = 'accountant',
  VIEWER = 'viewer',
}
```

### 2. Roles Decorator

```typescript
// src/common/decorators/roles.decorator.ts
import { SetMetadata } from '@nestjs/common';
import { Role } from '../enums/role.enum';

export const ROLES_KEY = 'roles';
export const Roles = (...roles: Role[]) => SetMetadata(ROLES_KEY, roles);
```

### 3. Roles Guard

```typescript
// src/common/guards/roles.guard.ts
import { Injectable, CanActivate, ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { ROLES_KEY } from '../decorators/roles.decorator';
import { Role } from '../enums/role.enum';

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const requiredRoles = this.reflector.getAllAndOverride<Role[]>(ROLES_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (!requiredRoles) return true; // Không gắn @Roles() = ai cũng vào được (đã qua JwtAuthGuard)

    const { user } = context.switchToHttp().getRequest();
    return requiredRoles.includes(user.role);
  }
}
```

### 4. Áp dụng vào Controller

```typescript
// src/modules/invoice/invoice.controller.ts
import { Controller, Get, Post, Put, Delete, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { Role } from '../../common/enums/role.enum';

@Controller('invoices')
@UseGuards(JwtAuthGuard, RolesGuard) // Áp dụng cho toàn bộ controller
export class InvoiceController {

  @Get()
  // Không gắn @Roles() → Admin, Accountant, Viewer đều xem được
  findAll() { ... }

  @Post()
  @Roles(Role.ADMIN, Role.ACCOUNTANT) // Chỉ Admin và Accountant tạo được
  create() { ... }

  @Delete(':id')
  @Roles(Role.ADMIN, Role.ACCOUNTANT)
  remove() { ... }
}
```

```typescript
// src/modules/team/team.controller.ts
@Controller('team')
@UseGuards(JwtAuthGuard, RolesGuard)
export class TeamController {

  @Get('members')
  @Roles(Role.ADMIN) // Chỉ Admin xem được danh sách thành viên
  findAll() { ... }

  @Post('members/invite')
  @Roles(Role.ADMIN)
  invite() { ... }
}
```

```typescript
// src/modules/settings/settings.controller.ts
@Controller('settings')
@UseGuards(JwtAuthGuard, RolesGuard)
export class SettingsController {

  @Get('banking')
  @Roles(Role.ADMIN, Role.ACCOUNTANT) // Cả 2 xem được danh sách tài khoản đã liên kết
  getBankingSettings() { ... }

  @Post('banking/link')
  @Roles(Role.ADMIN, Role.ACCOUNTANT) // Cả 2 đều liên kết thêm tài khoản ngân hàng được
  linkBankAccount() { ... }

  @Put('matching-threshold')
  @Roles(Role.ADMIN) // Chỉ Admin đổi được threshold
  updateThreshold() { ... }
}
```

### 5. Frontend — Ẩn/hiện UI theo role

```jsx
// hooks/usePermission.js
export function usePermission() {
  const { user } = useAuth();

  const can = (action) => {
    const permissions = {
      'invoice:create': ['admin', 'accountant'],
      'invoice:delete': ['admin', 'accountant'],
      'team:manage': ['admin'],
      'banking:link': ['admin', 'accountant'],
      'settings:threshold': ['admin'],
      'review:confirm': ['admin', 'accountant'],
    };
    return permissions[action]?.includes(user.role) ?? false;
  };

  return { can, role: user.role };
}
```

```jsx
// Sử dụng trong component
function InvoiceListPage() {
  const { can } = usePermission();

  return (
    <div>
      {can('invoice:create') && (
        <Button onClick={openCreateDialog}>+ Tạo hóa đơn</Button>
      )}
      <InvoiceTable />
    </div>
  );
}
```

```jsx
// Settings page — disable hẳn tab nếu không đủ quyền
function SettingsPage() {
  const { role } = usePermission();

  return (
    <Tabs>
      <TabsList>
        <TabsTrigger value="banking">Banking</TabsTrigger>
        <TabsTrigger value="threshold" disabled={role !== 'admin'}>
          Threshold {role !== 'admin' && <Lock className="w-3 h-3 ml-1" />}
        </TabsTrigger>
        <TabsTrigger value="team" disabled={role !== 'admin'}>
          Team {role !== 'admin' && <Lock className="w-3 h-3 ml-1" />}
        </TabsTrigger>
      </TabsList>
    </Tabs>
  );
}
```

---

## 🗄 Database Schema liên quan

> 📄 Đây là cùng 1 bảng `users` đã mô tả ở mục Cas Partner phía trên — lặp lại ở đây để tiện đọc trong ngữ cảnh quy tắc tạo user cấp tenant. Bản schema chuẩn duy nhất (không trùng lặp) — xem [`DATABASE_SCHEMA.md`](./DATABASE_SCHEMA.md).

```
users
├── id
├── tenant_id (FK, nullable)   ← NULL nếu là Cas Partner, xem mục Cas Partner phía trên
├── name
├── email
├── password_hash            ← bcrypt
├── role (cas_partner / admin / accountant / viewer)
├── invited_by (FK → users.id, null nếu là Admin đầu tiên)
├── invited_at
└── created_at
```

### Quy tắc tạo user

```
Doanh nghiệp mới đăng ký (POST /auth/register — confirmPassword bắt buộc)
        │
        ▼
Tạo tenant + tạo user với role = 'admin' (email_verified_at = null) + gửi OTP email
        │
        ▼
Xác thực email (POST /auth/verify-email) → mới cấp JWT; login trước khi verify → 403 EMAIL_NOT_VERIFIED
        │
        ▼
Admin vào Team → Mời thành viên (nhập email)
        │
        ▼
Hệ thống gửi email mời kèm link kích hoạt + chọn role (accountant / viewer)
        │
        ▼
Thành viên click link → đặt mật khẩu → tài khoản kích hoạt
        │
        ▼
User mới được tạo với role đã chọn, invited_by = admin's user_id
```

> **Lưu ý:** Việc liên kết tài khoản ngân hàng (qua Cas Link) là thao tác **cấp tenant**, không gắn với user cụ thể nào — bất kỳ Admin hoặc Accountant nào trong tenant cũng có thể thực hiện liên kết thêm tài khoản ngân hàng mới, miễn có quyền truy cập Settings → Banking (xem ma trận phân quyền).

---

## ⚠️ Edge Cases cần xử lý

| Tình huống | Xử lý |
|---|---|
| Admin duy nhất bị xóa khỏi hệ thống | Không cho phép — tenant phải có ít nhất 1 Admin |
| Accountant cố gọi API chỉ dành cho Admin | Trả về `403 Forbidden`, ghi vào Audit Log |
| Login khi email chưa xác thực | Trả về `403` với `code: EMAIL_NOT_VERIFIED` — FE redirect `/verify-email?autosend=1` |
| Quên mật khẩu | `POST /auth/forgot-password` → OTP email → `POST /auth/reset-password`; không tiết lộ email có tồn tại hay không |
| Ghi nhớ đăng nhập (`rememberMe`) | `true` → refresh cookie Max-Age 7 ngày; `false` → session cookie + Redis TTL `JWT_REFRESH_SESSION_EXPIRES_IN` (mặc định 12h) |
| Token hết hạn giữa lúc thao tác | Frontend tự refresh token, nếu refresh cũng fail → redirect về login |
| Viewer cố thao tác qua API trực tiếp (không qua UI) | Backend luôn validate lại role ở mọi endpoint, không tin tưởng FE đã ẩn nút |
| Admin tự đổi role của chính mình xuống Accountant | Cho phép nhưng cảnh báo, và phải còn ít nhất 1 Admin khác trong tenant |
| Cas Partner cố gọi endpoint nghiệp vụ (`/invoices`, `/customers`...) | Trả về `403 Forbidden` — Cas Partner chỉ được phép gọi `/partner/*`, dù JWT hợp lệ |
| Tenant bị Cas Partner khóa (`suspend`) | Toàn bộ user trong tenant đó (Admin/Accountant/Viewer) không đăng nhập được, hiển thị thông báo liên hệ hỗ trợ. Webhook vẫn nhận nhưng giao dịch xếp hàng chờ, không xử lý cho đến khi mở khóa |
| Cas Partner xem chi tiết tenant nhưng tenant đó xóa tài khoản | Giữ lại dữ liệu lịch sử usage/revenue (soft delete), Cas Partner vẫn xem được báo cáo cũ |

---

## ✅ Checklist khi thêm API endpoint mới

Mỗi khi tạo endpoint mới, kiểm tra:

- [ ] Đã xác định endpoint này thuộc nhóm nào trong bảng phân quyền ở trên chưa?
- [ ] Đã gắn `@UseGuards(JwtAuthGuard, RolesGuard)` chưa?
- [ ] Đã gắn `@Roles(...)` đúng với role được phép chưa? (Nếu không gắn = mọi role đã đăng nhập đều vào được)
- [ ] Đã thêm dòng tương ứng vào bảng phân quyền trong file này chưa?
- [ ] Frontend đã ẩn/disable UI tương ứng cho role không đủ quyền chưa?
