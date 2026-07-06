# 🧭 X-Cash AI — User Journey (Hành trình người dùng thực tế)

> Tài liệu này mô tả toàn bộ hành trình của một doanh nghiệp SME từ lúc đăng ký X-Cash AI cho đến khi sử dụng hàng ngày — giúp hình dung rõ vai trò của từng bên (X-Cash AI, Cas, kế toán SME) trong hệ thống.

**Khác biệt so với bản PayPilot (đối soát hóa đơn) cũ:** Giai đoạn 3 (Sử dụng hàng ngày) đã thay đổi hoàn toàn — AI không còn "ghép giao dịch với hóa đơn" mà thay bằng "định khoản tự động theo TT133". Kế toán không cần nhập hóa đơn, không quản lý khách hàng — chỉ cần xác nhận định khoản AI gợi ý và export Excel cuối tháng.

---

## 🗺️ Tổng quan 4 giai đoạn

```
Giai đoạn 1        Giai đoạn 2         Giai đoạn 3          Giai đoạn 4
Đăng ký        →   Onboarding     →   Sử dụng hàng ngày →  Nâng cấp gói
& Đăng nhập         (1 lần)            (AI xử lý tự động,    (khi hết quota
(X-Cash AI tự       (liên kết NH        kế toán review)       Free, qua
quản lý)            qua Cas Link)                             PayOS billing)
```

---

## Giai đoạn 1 — Đăng ký & Đăng nhập X-Cash AI

Đây là phần **X-Cash AI tự quản lý hoàn toàn**, không phụ thuộc Cas.

```
Anh A — chủ trung tâm Anh ngữ ABC, nghe nói đến X-Cash AI
        │
        ▼
Vào web X-Cash AI → bấm "Đăng ký"
        │
        ▼
Điền form: Tên doanh nghiệp, Email, Mật khẩu
        │
        ▼
POST /api/v1/auth/register
→ Backend tạo:
  - 1 tenant mới (trung tâm Anh ngữ ABC)
  - 1 user đầu tiên (anh A) với role = admin
        │
        ▼
Đăng nhập ngay (hoặc verify email tùy thiết kế)
        │
        ▼
POST /api/v1/auth/login → nhận JWT Access Token + Refresh Token
        │
        ▼
Vào thẳng màn hình Onboarding
```

Những lần sau, anh A chỉ cần gõ email + mật khẩu để vào — giống hệt bất kỳ web SaaS bình thường nào (Notion, Shopee Seller Center...). Không có khái niệm "đăng nhập bằng Cas ID" ở bước này.

---

## Giai đoạn 2 — Onboarding: liên kết ngân hàng thật

Đây là chỗ **Cas SDK** vào cuộc — chỉ xảy ra 1 lần (hoặc khi muốn liên kết thêm tài khoản ngân hàng khác).

```
Anh A ở màn hình Onboarding, bấm "Liên kết tài khoản ngân hàng"
        │
        ▼
X-Cash AI Backend gọi POST /grant/token
(dùng x-client-id / x-secret-key của X-Cash AI, lấy từ Cas Console)
        │
        ▼
Mở Cas Link (popup/iframe do Cas cung cấp)
        │
        ▼
Anh A đăng nhập Internet Banking NGAY TRONG ĐÓ
(môi trường sandbox dùng tài khoản demo:
 username: bankusrdemo1 / password: soproud / OTP: 123456)
        │
        ▼
Cas Link trả về publicToken qua redirectUri
        │
        ▼
X-Cash AI Backend gọi POST /grant/exchange
→ đổi publicToken lấy accessToken
        │
        ▼
Gọi GET /identity → lấy tên ngân hàng, số tài khoản
→ lưu vào bảng cas_grants
        │
        ▼
Hiển thị: "✅ Đã liên kết Vietcombank - STK 1234567890"
```

Sau bước này, kế toán **không cần làm gì thêm** ở phía Cas nữa. Webhook nhận giao dịch là **1 URL chung cho toàn bộ App X-Cash AI** (đã được team X-Cash AI cấu hình sẵn từ trước trên Cas Developer Console) — hệ thống tự nhận diện đúng doanh nghiệp nhờ `grantId` được lưu lại lúc liên kết ngân hàng.

**Thêm ở X-Cash AI:** Sau khi liên kết tài khoản ngân hàng, hệ thống **tự động seed danh mục tài khoản TT133** (~60 tài khoản) cho tenant. Kế toán có thể thêm tài khoản con ngay sau đó.

**Lần đầu vào Dashboard (sau onboarding):** `WelcomeTour` hiện dialog 4 bước (Liên kết NH → AI định khoản → Human Review → Báo cáo/Copilot) — chỉ 1 lần/user (`localStorage`).

**Chưa liên kết NH:** Dashboard hiện banner CTA “Liên kết ngân hàng ngay” → `/onboarding`; stat cards và charts chưa fetch dữ liệu.

---

## Giai đoạn 3 — Sử dụng hàng ngày

Đây là phần cốt lõi của X-Cash AI — AI định khoản tự động, kế toán chỉ cần xác nhận.

### Trường hợp 1 — Giao dịch rõ ràng (AI tự xử lý)

```
Nhân sự chuyển lương: "TRA LUONG NV NGUYEN VAN A THANG 6"
        │
        ▼
Cas phát hiện biến động số dư → POST webhook
về URL chung của App (kèm grantId)
        │
        ▼
X-Cash AI tra grantId → xác định đúng tenant
        │
        ▼
X-Cash AI chạy AI Classification Pipeline:
  → Text preprocessing
  → Tìm 5 phân loại cũ tương tự (pgvector)
  → OpenAI gpt-4o-mini phân loại
  → Confidence: 92%
        │
        ▼
≥ 85% → Auto classify:
  Nợ TK 334 (Phải trả người lao động)
  Có TK 112 (Tiền gửi ngân hàng)
        │
        ▼
Kế toán mở Dashboard
→ stat cards: "Định khoản hôm nay", "Chờ định khoản", "Chờ Human Review", "Độ chính xác AI" (tháng)
→ click card → điều hướng /transactions hoặc /review
→ thấy giao dịch đã "Định khoản: Nợ 334 / Có 112" trong feed gần đây ✅
→ không cần làm gì thêm
```

### Trường hợp 2 — Giao dịch không rõ ràng (cần xác nhận)

```
GD nội dung mơ hồ: "CK CONG TY ABC 123"
        │
        ▼
Confidence 65% < 85% threshold
        │
        ▼
Giao dịch vào "Hàng chờ xét duyệt" (Human Review Queue)
        │
        ▼
Kế toán mở Review Queue (sidebar badge đỏ, poll ~15–20s):
→ thấy: "AI gợi ý: Nợ 331 / Có 112 (Trả tiền mua hàng) — 65%"
→ lý do: "Nội dung 'CK CONG TY' gợi ý trả tiền nhà cung cấp"
        │
        ▼
3 lựa chọn:
  ✅ Xác nhận (nếu AI đúng) → classified
  ✏️ Sửa định khoản (chọn TK Nợ/Có khác) → classified (manual)
  ⏭️ Bỏ qua → skipped
        │
        ▼
AI học từ correction → lần sau GD tương tự sẽ chính xác hơn
```

### Trường hợp 3 — Hỏi AI Copilot (tùy chọn, gói Starter+)

```
Kế toán vào AI Copilot → hỏi "Tháng này chi phí lớn nhất là gì?"
        │
        ▼
Copilot gọi tools nội bộ (runTools): get_month_summary, get_top_accounts, …
        │
        ▼
Trả lời kèm chip nguồn (dữ liệu nội bộ / knowledge base / casso.vn nếu bật)
        │
        ▼
Streaming SSE hiện activity khi tool đang chạy; fallback JSON nếu stream lỗi
```

### Cuối tháng — Export Excel báo cáo

```
Kế toán vào Báo cáo → chọn tháng 6/2026
        │
        ▼
Xem bảng tổng hợp thu chi:
  Nợ 334 (Chi phí lương):    45,000,000đ
  Có 511 (Doanh thu bán hàng): 120,000,000đ
  Nợ 642 (Chi phí quản lý):   8,500,000đ
  ...
        │
        ▼
Bấm "Export Excel"
        │
        ▼
Tải file .xlsx — import thẳng vào MISA hoặc gửi cho kế toán trưởng
Không cần gõ tay 1 con số nào
```

### So sánh trước và sau khi dùng X-Cash AI

| | Trước (thủ công) | Sau (dùng X-Cash AI) |
|---|---|---|
| Định khoản 1 giao dịch rõ ràng | ~3 phút đọc + gõ vào MISA | Tức thời, AI tự định khoản |
| GD nội dung mơ hồ | Phải nghĩ, tra sổ, có thể sai | Xem gợi ý AI, xác nhận 2 giây |
| Tổng hợp cuối tháng | Vài giờ gom số liệu từ sao kê | Export Excel 1 click |
| Sai sót khi nhập liệu | Cao (manual = dễ nhầm số) | Thấp (AI + human verify) |

---

## Giai đoạn phụ — Cas Partner (vận hành hệ thống)

Nhân sự Cas/CASSO đăng nhập bằng tài khoản `cas_partner` (tenant_id = NULL) — **không** đi luồng onboarding Cas Link của SME.

```
Cas Partner đăng nhập → redirect `/partner/dashboard`
        │
        ▼
Xem tổng quan: tổng DN, active/suspended, MRR, thực thu PayOS, biểu đồ doanh thu theo gói
(lọc ngày ảnh hưởng GD/thực thu; MRR + pie gói = snapshot hiện tại)
        │
        ▼
Vào "Doanh nghiệp" (`/partner/tenants`) — bảng phân trang 20 DN/trang
→ tìm/lọc theo tên, trạng thái, gói
→ Xem chi tiết / Khóa / Mở khóa / Đổi gói (confirm 2 bước)
        │
        ▼
Khi cần: xem lịch sử thanh toán (`/partner/payments`), audit log (`/partner/audit-logs`),
chỉnh giá gói (`/partner/plans`)
```

> Partner **không** gọi API nghiệp vụ của tenant (`/transactions`, `/reports`, …) — chỉ `/partner/*`.

---

## Giai đoạn 4 — Nâng cấp gói (khi hết quota Free)

Sau vài tháng dùng thử, doanh nghiệp vượt quá 50 giao dịch/tháng của gói Free. Đây là lúc trả phí cho X-Cash AI — **khác hoàn toàn** với giao dịch nghiệp vụ của doanh nghiệp ở Giai đoạn 3.

```
Admin nhận thông báo: "Đã hết quota tháng này (50/50 giao dịch)"
        │
        ▼
Vào Settings → Billing → thấy bảng so sánh 4 gói
        │
        ▼
Bấm "Nâng cấp lên Pro — 799.000đ/tháng (2.000 giao dịch)"
        │
        ▼
X-Cash AI tạo Payment Link qua PayOS
(đây là PayOS account CỦA X-CASH AI, không phải của doanh nghiệp)
        │
        ▼
Hiện QR thanh toán ngay trong Dialog
        │
        ▼
Admin quét QR, chuyển 799.000đ
        │
        ▼
PayOS gửi webhook callback về X-Cash AI
        │
        ▼
X-Cash AI tự động kích hoạt gói Pro, reset quota
        │
        ▼
Admin thấy thông báo "Nâng cấp thành công!" — tiếp tục dùng bình thường
```

> **Phân biệt quan trọng:** Giai đoạn 3 — AI phân loại giao dịch ngân hàng của doanh nghiệp. Giai đoạn 4 — doanh nghiệp trả phí dịch vụ cho X-Cash AI qua PayOS. Hai luồng tiền hoàn toàn tách biệt.

---

## 👥 Vai trò từng bên trong hệ sinh thái

| Ai | Vai trò | Tần suất tương tác |
|---|---|---|
| **Chủ doanh nghiệp (Admin)** | Đăng ký, liên kết ngân hàng, mời thêm kế toán, xem báo cáo tổng quan, nâng cấp gói khi cần | 1 lần lúc đầu, sau đó thỉnh thoảng xem báo cáo + nâng cấp gói |
| **Kế toán (Accountant)** | Đăng nhập hàng ngày, xử lý Human Review queue, xem báo cáo, export Excel cuối tháng | Hàng ngày |
| **Cas** | Hạ tầng nền — đọc biến động số dư ngân hàng, tự động bắn webhook về X-Cash AI | Chạy ngầm, không ai thấy |
| **X-Cash AI** | Lớp ứng dụng trung gian — nhận giao dịch từ Cas, dùng AI định khoản TT133, hiển thị cho kế toán xác nhận | Real-time |
| **PayOS** | Cổng thanh toán cho riêng việc thu phí dịch vụ (X-Cash AI là bên bán, doanh nghiệp là bên mua gói) | Khi doanh nghiệp nâng cấp/gia hạn gói |
| **Cas Partner** (nhân sự Cas/CASSO) | Theo dõi tổng quan DN, MRR/thực thu, khóa/mở/đổi gói, audit log, chỉnh giá gói | Khi cần hỗ trợ hoặc theo dõi vận hành |

---

## 💡 Điểm mấu chốt cần nhớ

> Với khách hàng cuối (chủ doanh nghiệp, kế toán), **Cas gần như "vô hình"** sau bước Onboarding. Họ chỉ cảm nhận mình đang dùng X-Cash AI — không thấy được lớp hạ tầng Cas phía sau.

Kiến trúc tách bạch 2 cơ chế (đăng nhập X-Cash AI ≠ liên kết ngân hàng qua Cas) là đúng đắn — người dùng không cần hiểu hay quan tâm đến Cas, họ chỉ cần trải nghiệm mượt mà trên X-Cash AI.

> **Hai dòng tiền hoàn toàn tách biệt, đừng nhầm lẫn:**
> - **Dòng tiền nghiệp vụ** (Giai đoạn 3): giao dịch ngân hàng của doanh nghiệp → X-Cash AI đọc + định khoản TT133.
> - **Dòng tiền dịch vụ** (Giai đoạn 4): doanh nghiệp → X-Cash AI, qua PayOS, để trả phí sử dụng phần mềm.
>
> X-Cash AI không bao giờ "chạm" vào dòng tiền nghiệp vụ — chỉ đọc dữ liệu giao dịch qua Cas để định khoản, không giữ tiền hộ ai.

---

## 🔗 Tài liệu liên quan

- Chi tiết phân quyền Admin/Accountant/Viewer/Cas Partner — xem `rbac.md`
- Chi tiết bảng giá, cách tính phí, flow PayOS billing — xem `rbac.md` mục Pricing Model
- Chi tiết giao diện từng màn hình — xem `ui-design.md`
- Chuẩn kế toán TT133, AI Classification Pipeline — xem `business-overview.md`
- Kế hoạch triển khai theo sprint — xem [`sprint-plan.md`](./sprint-plan.md)
- Toàn bộ schema database, ERD — xem `DATABASE_SCHEMA.md`
