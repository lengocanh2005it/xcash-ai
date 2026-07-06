# Copilot Quota — Spec triển khai

> **Mục tiêu:** giới hạn số lượt chat Copilot mỗi chu kỳ billing theo gói dịch vụ, kiểm soát chi phí OpenAI API và tạo incentive nâng cấp Starter → Pro.

---

## 1. Thiết kế nghiệp vụ

### Quota theo gói

| Gói        | `copilotQuota` | Ghi chú                                        |
|------------|---------------|------------------------------------------------|
| Free       | 0             | Vẫn bị block bởi `PlanGuard` (Starter+), quota không cần check |
| Starter    | 200           | Đủ cho dùng thông thường (~7 lượt/ngày)        |
| Pro        | 1000          | Heavy user                                     |
| Enterprise | -1            | Convention: `-1` = unlimited, skip quota check |

**Quy tắc:**
- Quota được đếm per-tenant per-chu-kỳ billing (tháng), reset cùng lúc với `transactionUsedThisCycle`.
- Một lượt = một request thành công đến `POST /ai/copilot` hoặc `POST /ai/copilot/stream` (stream tính sau khi `done` event emit).
- Khi vượt quota: trả `429 Too Many Requests` với message tiếng Việt rõ ràng.
- Không tính overage (khác với transaction) — không có phí vượt Copilot quota, chỉ block.
- Partner có thể chỉnh `copilotQuota` trên bảng `plan_pricing` (UI Partner Plans đã có sẵn pattern).

### Hiển thị cho user
- `GET /billing/current-plan` trả thêm `copilotUsed` và `copilotQuota` để FE hiển thị mức sử dụng trong Settings > Billing.
- Khi gần hết quota (≥80%), trigger in-app notification `copilot_quota_warning` (tương tự `quota_warning` hiện có).
- Khi vượt quota, trigger `copilot_quota_exceeded`.

---

## 2. Thay đổi schema (Prisma)

### `Subscription` — thêm 1 cột runtime

```prisma
model Subscription {
  // ... fields hiện có ...
  transactionQuota           Int      @default(50)  @map("transaction_quota")
  transactionUsedThisCycle   Int      @default(0)   @map("transaction_used_this_cycle")
  // THÊM MỚI:
  copilotUsedThisCycle       Int      @default(0)   @map("copilot_used_this_cycle")
}
```

### `PlanPricing` — thêm 1 cột template

```prisma
model PlanPricing {
  // ... fields hiện có ...
  transactionQuota           Int
  // THÊM MỚI:
  copilotQuota               Int      @default(-1)  @map("copilot_quota")
}
```

### Migration seed

Sau migration, cập nhật `plan_pricing` seed:

| plan       | copilotQuota |
|------------|-------------|
| free       | 0            |
| starter    | 200          |
| pro        | 1000         |
| enterprise | -1           |

---

## 3. Thay đổi `NotificationType` enum

Thêm 2 giá trị mới vào enum Prisma và `audit-log.labels.ts`:

```prisma
enum NotificationType {
  // ... hiện có ...
  copilot_quota_warning   // mới
  copilot_quota_exceeded  // mới
}
```

---

## 4. Backend — các file cần sửa/tạo

### Phase 1 — Schema + Migration

**Files:**
- `prisma/schema.prisma` — thêm 2 cột như trên
- `prisma/migrations/<timestamp>_add_copilot_quota/migration.sql` — tạo qua `pnpm prisma migrate dev`
- Seed script hoặc câu `UPDATE` thủ công để set `copilot_quota` trên `plan_pricing`

**Không cần shared-types thay đổi** — `Subscription` Prisma type tự update.

---

### Phase 2 — Guard + increment logic

#### Tạo mới: `src/common/guards/copilot-quota.guard.ts`

```typescript
// Logic:
// 1. Lấy subscription active của tenantId từ DB (không cache — cần số chính xác)
// 2. Lấy copilotQuota từ plan_pricing theo plan của subscription
// 3. Nếu copilotQuota === -1 → pass (unlimited)
// 4. Nếu copilotUsedThisCycle >= copilotQuota → throw 429 TooManyRequestsException
//    message: `Bạn đã dùng hết ${quota} lượt chat Copilot trong tháng này. Nâng cấp gói để tiếp tục.`
// 5. Nếu pass → lưu subscription vào request metadata để increment sau
```

**Inject:** `PrismaService` (đọc subscription + plan_pricing).

**Guard đặt sau `PlanGuard`** trong chain — PlanGuard chặn Free trước, quota guard chỉ chạy với Starter+.

#### Sửa: `src/modules/ai/copilot.controller.ts`

- Thêm `CopilotQuotaGuard` vào `@UseGuards(...)` chain của cả 2 endpoint.
- Inject `PrismaService` vào controller để increment sau mỗi lượt thành công.
- `POST /ai/copilot`: increment sau `return { reply, ... }` (dùng `finally` hoặc sau await).
- `POST /ai/copilot/stream`: increment bên trong `try` block **sau** khi `writeEvent('done', ...)` thành công — không increment nếu lỗi trước khi có reply.

```typescript
// Pattern increment:
await this.prisma.subscription.updateMany({
  where: { tenantId, status: 'active' },
  data: { copilotUsedThisCycle: { increment: 1 } },
});
```

#### Trigger notification nếu cần

Sau increment, check ngưỡng:
- `copilotUsedThisCycle / copilotQuota >= 0.8` và chưa có notification `copilot_quota_warning` trong cycle → tạo notification (dedup theo `currentCycleStart` như quota_warning hiện tại).
- `copilotUsedThisCycle >= copilotQuota` ngay sau increment → tạo `copilot_quota_exceeded`.

Logic này đặt trong `NotificationService` (method mới `checkCopilotQuotaNotifications`), controller gọi fire-and-forget (không await, không block response).

---

### Phase 3 — Reset cron + billing endpoint

#### Sửa: `src/modules/billing/billing-cycle.service.ts`

Trong `processCycleEnd()`, thêm `copilotUsedThisCycle: 0` vào data reset:

```typescript
await this.prisma.subscription.update({
  where: { id: sub.id },
  data: {
    transactionUsedThisCycle: 0,
    copilotUsedThisCycle: 0,   // THÊM
    currentCycleStart: now,
    currentCycleEnd: newCycleEnd,
  },
});
```

#### Sửa: `src/modules/billing/billing.service.ts`

Method `getCurrentPlan()` trả thêm 2 fields mới trong response:

```typescript
// Trong return object:
copilotQuota: planPricing.copilotQuota,
copilotUsed: subscription.copilotUsedThisCycle,
```

#### Sửa: `src/modules/partner/partner.service.ts` (nếu có Partner chỉnh quota)

`PATCH /partner/plan-pricing/:plan` — `PlanPricingDto` thêm optional field `copilotQuota?: number`.

---

### Phase 4 — Frontend

#### Sửa: `SettingsPage` → tab **Billing**

Nơi hiện đang hiển thị `transactionUsed / transactionQuota`, thêm row tương tự cho Copilot:

```
Lượt chat Copilot:  [███████░░░] 147 / 200 lượt
```

Dùng ShadCN `<Progress>` (đã có `progress.tsx`). Data từ `GET /billing/current-plan`.

Màu progress bar:
- < 80%: mặc định (primary)
- ≥ 80%: `bg-orange-500` (warning)
- ≥ 100%: `bg-red-500` (exceeded) — trạng thái này thực ra không hiển thị được vì đã bị block, nhưng nếu dữ liệu bằng đúng quota thì dùng màu đỏ.

#### Sửa: `PartnerPlansPage` (dialog chỉnh gói)

Thêm field `copilotQuota` vào form dialog "Cài đặt giá gói dịch vụ":

```
Quota Copilot/tháng: [____] lượt  (nhập -1 = không giới hạn)
```

Helper text: "Nhập -1 để không giới hạn lượt chat (dành cho Enterprise)."

---

## 5. Thứ tự triển khai (phases)

```
Phase 1 — Schema          ~30 phút
  ├── Sửa schema.prisma (2 cột)
  ├── prisma migrate dev
  └── UPDATE plan_pricing SET copilot_quota = ...

Phase 2 — Guard + logic   ~1 giờ
  ├── Tạo CopilotQuotaGuard
  ├── Sửa CopilotController (apply guard + increment)
  └── Thêm NotificationType enum + checkCopilotQuotaNotifications

Phase 3 — Reset + API     ~30 phút
  ├── Sửa BillingCycleService (thêm copilotUsedThisCycle: 0)
  ├── Sửa billing.service getCurrentPlan (trả copilotQuota/copilotUsed)
  └── Sửa PlanPricingDto (thêm copilotQuota optional)

Phase 4 — Frontend        ~45 phút
  ├── BillingTab: progress bar Copilot
  └── PartnerPlansPage: field copilotQuota trong dialog

Phase 5 — Verify + docs
  ├── pnpm verify
  └── /sync-agent-docs
```

---

## 6. Các điểm cần chú ý khi implement

1. **Không dùng cache cho quota check** — phải đọc DB thật để tránh race condition (2 request đồng thời có thể vượt quota nếu cache).
2. **Increment fire-and-forget với stream** — `streamChat` không được block SSE stream để chờ DB update. Gọi increment sau `writeEvent('done')` nhưng trước `res.end()` — dùng `await` bình thường vì lúc đó reply đã được stream hết rồi.
3. **Enterprise sentinel `-1`** — mọi chỗ check quota phải xử lý case `copilotQuota === -1` trước tiên.
4. **Guard order trong `@UseGuards`** — thứ tự: `JwtAuthGuard` → `RolesGuard` → `PlanGuard` → `CopilotQuotaGuard`. Guard sau chỉ chạy khi guard trước pass.
5. **Dedup notification** — `copilot_quota_warning` chỉ trigger 1 lần/cycle. Dùng cùng pattern dedup của `quota_warning` hiện có trong `notification.service.ts`.
6. **Migration idempotent** — `ALTER TABLE` thêm column với DEFAULT, không cần backfill vì default=0 và -1 là hợp lệ cho tất cả record cũ.
7. **Không có overage Copilot** — chỉ block, không tính phí thêm. `createOverageOrder` không cần sửa.

---

## 7. Testing checklist

- [ ] Starter user chat đến lượt 200 → lượt 201 trả 429 với message tiếng Việt
- [ ] Enterprise user chat không bị giới hạn (`copilotQuota = -1`)
- [ ] Free user vẫn bị block bởi PlanGuard (403), không bao giờ đến CopilotQuotaGuard
- [ ] Stream endpoint: increment chỉ chạy sau `done` event, không increment khi lỗi
- [ ] BillingCycleService reset `copilotUsedThisCycle = 0` khi hết cycle
- [ ] `GET /billing/current-plan` trả `copilotQuota` và `copilotUsed` đúng
- [ ] Notification `copilot_quota_warning` trigger khi ≥80%, không trigger lại trong cùng cycle
- [ ] Notification `copilot_quota_exceeded` trigger khi đạt quota
- [ ] Partner chỉnh `copilotQuota` qua UI → áp dụng cho lần nâng cấp tiếp theo (giống `transactionQuota`)
