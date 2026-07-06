# Giải thích nghiệp vụ — TT133, định khoản, Nợ/Có

> Tài liệu giải thích **dễ hiểu** các khái niệm kế toán trong X-Cash AI — dành cho product, QA, dev mới, và bất kỳ ai đọc UI mà thấy “khó hiểu”.  
> Phần cuối file giữ mục **tham chiếu kỹ thuật** (file code, luồng hệ thống).

---

## 1. X-Cash AI làm gì? (một câu)

Nhận **giao dịch ngân hàng thô** từ Cas → **AI gợi ý ghi sổ kế toán** (TK Nợ / TK Có theo TT133) → kế toán xác nhận nếu cần → **báo cáo thu/chi** tự tổng hợp.

Đây là đặc trưng **fintech + kế toán tự động**: không chỉ biết “tiền vào/ra bao nhiêu”, mà còn biết “khoản đó **là gì** trong sổ sách”.

| Lớp | Ví dụ | Ai xử lý |
|---|---|---|
| Dòng tiền | +5.000.000đ, nội dung "TT TIEN HANG" | Ngân hàng / Cas |
| Ý nghĩa kế toán | Nợ 112 / Có 511 (doanh thu) | AI + kế toán |
| Báo cáo | Tổng thu, tổng chi, lãi/lỗ tháng | X-Cash AI |

---

## 2. Định khoản là gì?

**Định khoản** = gắn **một giao dịch ngân hàng** vào **đúng cặp tài khoản kế toán** (ghi Nợ tài khoản nào, Có tài khoản nào, bao nhiêu tiền).

Ngân hàng chỉ cho bạn:
- Số tiền (+ hoặc −)
- Nội dung chuyển khoản (vd: `CHI PHI QUANG CAO FACEBOOK T7`)

Đó **chưa phải** sổ kế toán. Kế toán (hoặc AI) phải trả lời: *đây là doanh thu, chi phí, trả nợ, thu nợ khách…?*

**Ví dụ — khách chuyển 5.000.000đ thanh toán hàng:**

```
Nợ  112  (Tiền gửi ngân hàng)      5.000.000
Có  511  (Doanh thu bán hàng)      5.000.000
```

**Ví dụ — chi 2.800.000đ quảng cáo Facebook:**

```
Nợ  641  (Chi phí bán hàng)        2.800.000
Có  112  (Tiền gửi ngân hàng)      2.800.000
```

Hai dòng trên = **một bút toán định khoản**. Trên UI, cột **TK Nợ/Có** hiển thị dạng `641/112` hoặc `112/511`.

---

## 3. Thông tư 133 (TT133) là gì? Liên quan định khoản thế nào?

**Thông tư 133/2016/TT-BTC** = bộ quy tắc kế toán cho **doanh nghiệp nhỏ và vừa (SME)** ở Việt Nam.

TT133 quy định:
- **Danh mục tài khoản** dùng chung (~60–70 mã: 112, 511, 641…)
- Mỗi mã **nghĩa là gì**
- Ghi Nợ/Có thế nào cho đúng chuẩn **kế toán kép** (double-entry)

| Khái niệm | Vai trò |
|---|---|
| **TT133** | Bộ quy tắc + “từ điển” mã tài khoản |
| **Định khoản** | Áp quy tắc đó cho **từng giao dịch** cụ thể |

Trong app: màn **Danh mục TK** = bộ tài khoản TT133 (seed sẵn khi tenant đăng ký). AI và kế toán chỉ được chọn mã trong danh mục này (hoặc TK tự thêm).

> **TT133 vs TT200:** TT200 dành cho DN lớn, nhiều TK hơn. X-Cash AI **chỉ hỗ trợ TT133** (SME).

---

## 4. Nợ / Có — bản chất (tránh hiểu nhầm tiếng Việt)

⚠️ **Hay nhầm:** “Nợ” = nợ nần, “Có” = có tiền. **Trong kế toán không phải vậy.**

**Bản chất:** Mỗi giao dịch tiền luôn ảnh hưởng **ít nhất 2 tài khoản**. Kế toán ghi **hai bên** của một bút toán:
- **Nợ** (Debit) — một bên
- **Có** (Credit) — bên kia

**Luật vàng:** Tổng Nợ = Tổng Có (luôn cân).

### Quy tắc nhớ nhanh (đủ dùng với X-Cash)

| Loại tài khoản | Khi **tăng** | Khi **giảm** |
|---|---|---|
| **Tài sản** (112 tiền NH, 131 phải thu…) | Ghi **Nợ** | Ghi **Có** |
| **Doanh thu** (511…) | Ghi **Có** | Ghi **Nợ** |
| **Chi phí** (641, 627…) | Ghi **Nợ** | Ghi **Có** |

### Cùng tài khoản 112, hai chiều khác nhau

- Tiền **vào** NH → thường **Nợ 112** (tài sản tăng)
- Tiền **ra** NH → thường **Có 112** (tài sản giảm)

Không phải “tiền vào = Có, tiền ra = Nợ” theo nghĩa đời thường — phụ thuộc **bên còn lại** của bút toán.

---

## 5. Vòng đời trạng thái giao dịch

```
Cas gửi webhook
       │
       ▼
  [Chờ xử lý]  pending — AI chưa chạy / đang chạy trong hàng đợi
       │
       ▼
  AI định khoản (OpenAI + few-shot pgvector)
       │
       ├── confidence ≥ ngưỡng (mặc định 85%) ──► [Đã định khoản]  classified
       │
       └── confidence < ngưỡng ──► [Cần review]  review
                │
                ├── Kế toán Xác nhận ──► classified
                ├── Kế toán Sửa TK Nợ/Có ──► classified
                └── Kế toán Bỏ qua ──► skipped
```

| Trạng thái (UI) | Ý nghĩa | Có TK Nợ/Có? | Vào báo cáo thu/chi? |
|---|---|:---:|:---:|
| **Chờ xử lý** | Mới nhận, chưa định khoản xong | — | Không |
| **Cần review** | AI đã gợi ý nhưng chưa đủ tin | Có (gợi ý) | Chưa |
| **Đã định khoản** | Bút toán chính thức | Có | **Có** |
| **Bỏ qua** | Kế toán chủ động không ghi sổ | — | Không |

**Ghi chú kỹ thuật:** Giao dịch seed demo ở trạng thái `pending` không đi qua webhook → cần bấm **“Cho AI định khoản lại”** (enqueue job `ai-classify`) hoặc định khoản thủ công.

---

## 6. Human Review — Xác nhận / Sửa / Bỏ qua ảnh hưởng gì?

| Hành động | Trạng thái sau | Ảnh hưởng số liệu |
|---|---|---|
| **Xác nhận** | `classified` | Giữ TK Nợ/Có AI gợi ý → **tính vào** thu/chi/báo cáo |
| **Sửa** | `classified` | Dùng TK mới → có thể **đổi** doanh thu ↔ chi phí (vd sửa từ 131 sang 511) |
| **Bỏ qua** | `skipped` | **Không** tính vào báo cáo |

**Cập nhật UI liên quan:**
- Badge đỏ **Human Review** trên sidebar (`/review/count`) giảm ngay sau xử lý.
- **Dashboard DN:** doanh thu hôm nay chỉ cộng GD `classified` có số tiền dương.
- **Báo cáo / Analytics / AI Copilot:** chỉ lấy `status = classified`.

**Không ảnh hưởng:** MRR, tiền PayOS gói dịch vụ (màn Partner) — đó là billing subscription, tách hẳn với định khoản giao dịch ngân hàng.

---

## 7. Trang “Báo cáo định khoản” (`/reports`) giải thích

**Mục đích:** Tổng hợp **thu / chi / lãi lỗ** trong tháng đã chọn, theo tài khoản TT133 — chỉ từ giao dịch **đã định khoản**.

### 4 card tổng

| Card | Cách tính (backend `report.service`) |
|---|---|
| **Tổng thu** | Tổng phát sinh **Có** trên TK loại `revenue` (5xx, vd 511) |
| **Tổng chi** | Tổng phát sinh **Nợ** trên TK loại `expense` (6xx, vd 641, 627) |
| **Lãi/Lỗ** | Tổng thu − Tổng chi |
| **Độ chính xác AI** | `classifiedCount / totalCount` giao dịch trong tháng (vd 6/8 = 75%) |

### Bảng “Chi tiết theo tài khoản”

Mỗi dòng = một mã TK (112, 511, 641…):
- **Phát sinh Nợ / Có** — tổng tiền qua TK đó trong tháng
- **Số dư** — chênh lệch theo quy tắc kế toán
- **Số GD** — số giao dịch đã định khoản có chạm TK đó

### Xuất Excel

- Yêu cầu gói **Pro+** (`PlanGuard` / `hasPlanAccess(..., PRO)`).
- Gói thấp hơn: nút disabled + tooltip hướng nâng cấp.

---

## 8. Dashboard doanh nghiệp vs Báo cáo — khác gì?

| | Dashboard (`/dashboard`) | Báo cáo (`/reports`) |
|---|---|---|
| **Nguồn stat cards** | `/reports/summary` (AI accuracy), `/review/count`, count API `transactions` theo status/ngày | Backend aggregate theo TK (`/reports/summary`, `/reports/account-breakdown`, …) |
| **Nguồn charts / feed** | `GET /transactions?limit=100` — client aggregate (`lib/dashboard-transactions.ts`) | Không dùng cho dashboard |
| **“Định khoản hôm nay”** | Đếm GD `classified` trong ngày (count API) | Không có card tương đương trên Reports |
| **Chuẩn kế toán** | Tiện xem nhanh vận hành AI + review | Đúng TT133 (5xx / 6xx) cho cuối tháng |

Dashboard tiện xem nhanh; **Báo cáo** là số liệu kế toán chính thức hơn cho cuối tháng.

---

## 9. Partner Dashboard — MRR vs tiền thực thu (PayOS)

*Phần này chỉ trên giao diện **Cas Partner**, không liên quan định khoản giao dịch NH của tenant.*

| Chỉ số | Nghĩa | Nguồn |
|---|---|---|
| **MRR (doanh thu định kỳ)** | “Nếu giữ nguyên gói hiện tại, tháng sau thu bao nhiêu?” — **dự kiến** | Tổng `pricePerMonth` subscription DN đang `active` |
| **Thực thu (PayOS)** | Tiền **đã vào** từ đơn nâng cấp/gia hạn gói | `payment_orders` status `paid` |

Hai số **có thể lệch** (DN chưa thanh toán tháng này, nâng cấp giữa tháng, DN bị khóa…).

**Lọc ngày trên Partner Dashboard:** GD tháng / thực thu PayOS theo `fromDate`–`toDate`; **MRR** và pie **phân bố gói** luôn là snapshot hiện tại — UI hiện hint “không theo kỳ lọc ngày” khi đang lọc.

**Danh sách DN (`/partner/tenants`):** phân trang server-side 20/trang (`GET /partner/tenants?page=&limit=`). Dashboard gọi cùng endpoint **không** paginate để tính MRR/plan breakdown.

## 10. Hệ thống tài khoản TT133 — các nhóm chính

| Nhóm | Loại | Ví dụ |
|---|---|---|
| `1xx` | Tài sản ngắn hạn | `111` Tiền mặt, `112` Tiền gửi NH, `131` Phải thu KH |
| `2xx` | Tài sản dài hạn | `211` TSCĐ, `242` Chi phí trả trước |
| `3xx` | Nợ phải trả | `331` Phải trả NCC, `334` Phải trả NV, `333` Thuế |
| `4xx` | Vốn chủ sở hữu | `411` Vốn đầu tư, `421` LNST chưa phân phối |
| `5xx` | Doanh thu | `511` Doanh thu bán hàng/dịch vụ |
| `6xx` | Chi phí | `632` Giá vốn, `641` Chi phí bán hàng, `642` Chi phí QL DN |
| `7xx` | Thu nhập khác | `711` Thu nhập khác |
| `8xx` | Chi phí khác / thuế | `811`, `821` |
| `9xx` | Xác định KQKD | `911` |

Seed đầy đủ: `apps/backend/src/modules/chart-of-accounts/tt133-seed.ts`

---

## 11. Luồng kỹ thuật trong X-Cash AI

```
Giao dịch NH (webhook Cas)
        ↓
  Lưu transaction (status: pending)
        ↓
  BullMQ job "ai-classify"
        ↓
  OpenAI gpt-4o-mini + few-shot (pgvector)
  → { debitAccount, creditAccount, confidence }
        ↓
  confidence ≥ threshold (mặc định 85%)?
  ├── Có → status = classified
  └── Không → status = review  →  Human Review queue
        ↓
  Kế toán confirm / correct / skip
        ↓
  Báo cáo, Copilot, Analytics (chỉ classified)
```

---

## 12. File code quan trọng

| File | Vai trò |
|---|---|
| `apps/backend/src/modules/chart-of-accounts/tt133-seed.ts` | ~60 TK TT133, seed khi tenant đăng ký |
| `apps/backend/src/modules/ai/classification.service.ts` | Gọi OpenAI, rule-based fallback, ghi `transaction_classifications` |
| `apps/backend/src/modules/ai/embedding.service.ts` | pgvector few-shot (lưu ý: `id`/`tenant_id` là `text`, không cast `::uuid` trong raw SQL) |
| `apps/backend/src/modules/classification/classification.service.ts` | Human Review: confirm / correct / skip |
| `apps/backend/src/modules/report/report.service.ts` | Tổng thu/chi theo `accountType` + chỉ `classified` |
| `apps/frontend/src/pages/reports/ReportsPage.tsx` | UI Báo cáo định khoản |
| `apps/frontend/src/pages/review/ReviewPage.tsx` | UI Human Review |

---

## 13. Câu hỏi thường gặp

**Q: AI sai thì sao?**  
A: Confidence < ngưỡng → Human Review. Kế toán sửa → lưu DB → embedding làm few-shot cho lần sau (theo tenant).

**Q: Tenant có thể thêm TK tùy chỉnh không?**  
A: Có — `POST /accounts`. TK tự thêm vẫn dùng được khi định khoản.

**Q: Tại sao báo cáo chỉ 6/8 giao dịch?**  
A: 2 giao dịch còn lại đang `pending`, `review`, hoặc `skipped` — chưa hoặc không được tính vào báo cáo.

**Q: “Cho AI định khoản lại” làm gì?**  
A: `POST /transactions/:id/reclassify` — enqueue lại job AI cho GD `pending`. Cần Redis + worker chạy. UI sheet tự poll mỗi 2.5s đến khi xong.

**Q: Dev có cần học kế toán không?**  
A: Không cần thiết — hiểu file này + `tt133-seed.ts` là đủ để code đúng luồng. Chi tiết nghiệp vụ từng TK hỏi kế toán / product owner.

**Q: X-Cash có làm bảng cân đối kế toán đầy đủ không?**  
A: Không — focus **phân loại GD real-time + báo cáo thu/chi theo tháng + export Excel**, không thay MISA/FAST.

---

## 14. Tài liệu liên quan

- [`business-overview.md`](./business-overview.md) — tổng quan sản phẩm, AI pipeline, webhook
- [`user-journey.md`](./user-journey.md) — hành trình onboarding → review → báo cáo
- [`database-schema.md`](./database-schema.md) — bảng `transactions`, `transaction_classifications`, `chart_of_accounts`
- [`rbac.md`](./rbac.md) — ai được confirm review, ai được export Excel
