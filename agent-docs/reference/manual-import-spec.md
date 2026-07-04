# Tính năng: Import Giao Dịch từ Excel

> **Trạng thái:** Spec — chưa implement  
> **Ưu tiên:** Sprint 5, sau khi hoàn thành deploy production (Sprint 4)  
> **Phụ trách:** TBD

---

## 1. Tại sao cần tính năng này

### Gap hiện tại

Luồng nhận giao dịch hiện tại của X-Cash AI **chỉ có một nguồn duy nhất:**

```
Ngân hàng → Cas Balance Hook → POST /webhook/cas → AI classify → Báo cáo
```

Điều này có nghĩa là **chỉ những giao dịch qua tài khoản ngân hàng liên kết mới vào được hệ thống.** Giao dịch tiền mặt, chi phí nội bộ, và giao dịch từ ngân hàng không tích hợp Casso đều bị bỏ qua hoàn toàn.

### Pain point với target hiện tại

`business-overview.md` xác định target là **quán cà phê, shop bán lẻ, công ty dịch vụ 5–50 người** — đây là nhóm SME truyền thống nơi tiền mặt chiếm tỷ trọng lớn:

| Loại giao dịch | Ví dụ | Định khoản TT133 |
|----------------|-------|-----------------|
| Chi tiền mặt mua hàng | Mua nguyên liệu buổi sáng | Nợ 156 / Có 111 |
| Chi tiền mặt vận hành | Mua văn phòng phẩm | Nợ 642 / Có 111 |
| Trả lương tiền mặt | Lương nhân viên thời vụ | Nợ 334 / Có 111 |
| Thu tiền mặt từ khách | Bán hàng không qua POS | Nợ 111 / Có 511 |
| Rút tiền NH ra quỹ | Rút tiền để trả lương | Nợ 111 / Có 112 |

Với F&B và bán lẻ, tiền mặt thường chiếm 30–50% tổng giao dịch. Kết quả:

- **Báo cáo X-Cash không phản ánh thực tế** — thiếu toàn bộ phần tiền mặt
- **Kế toán vẫn phải dùng Excel riêng** cho tiền mặt, sau đó ghép tay với báo cáo X-Cash
- **Pitch bị hỏng:** kế toán hỏi "tiền mặt thì sao?" → không có câu trả lời

Ngoài ra, nhiều doanh nghiệp dùng ngân hàng **không tích hợp Casso** (Vietcombank cá nhân, TPBank, một số ACB branch...). Họ có sao kê Excel từ internet banking nhưng không thể đưa vào X-Cash.

### Giải pháp

Cho phép kế toán **upload file Excel theo template** → X-Cash parse và đưa từng dòng qua đúng AI pipeline hiện có → kết quả tích hợp liền mạch với báo cáo.

```
Excel (ngày, mô tả, số tiền, thu/chi)
        │
        ▼
Parse + Validate (dry-run, báo lỗi trước khi import)
        │
        ▼
Tạo Transaction (source=import) cho từng dòng hợp lệ
        │
        ▼
Enqueue ai-classify (cùng job ai-classify như webhook Cas)
        │
        ▼
Human Review Queue → Báo cáo → Export Excel
```

---

## 2. Quyết định product đã chốt

| Câu hỏi | Quyết định | Lý do |
|---------|------------|-------|
| Quota có tính GD import không? | **Tính chung** với quota ngân hàng | Đơn giản hóa billing; chi phí OpenAI ~$0.0001/GD không đáng kể ở scale SME (quota Starter 500 GD = $0.05/tháng OpenAI) |
| Xử lý lỗi từng dòng thế nào? | **Báo toàn bộ lỗi, user sửa rồi upload lại** | Tránh import một phần — với kế toán, sai im lặng nguy hiểm hơn báo lỗi ồn ào |
| Định dạng file MVP | **Chỉ `.xlsx`** | Giảm edge case parser; CSV làm sau nếu có feedback |
| Badge UI cho GD import | **"Import Excel"** (amber) | Khác với GD ngân hàng; không dùng "Nhập tay" vì user upload file, không gõ form |
| Idempotency khi upload lại | **Hash theo nội dung dòng + số dòng Excel** | Tránh skip nhầm 2 GD hợp lệ giống nhau trong cùng file (vd: 5 ly cà phê cùng giá) |
| AI suy chiều thu/chi | **`direction` field** cho import; Cas giữ logic amount âm/dương | Import luôn lưu `amount` dương — AI **không được** suy direction từ dấu amount với `source=import` |

---

## 3. Thay đổi schema

### 3.1 Enum mới

```prisma
enum TransactionSource {
  cas     // Nhận từ Cas Balance Hook (mặc định hiện tại)
  import  // Upload từ Excel
}

enum TransactionDirection {
  in   // Thu (tiền vào)
  out  // Chi (tiền ra)
}
```

### 3.2 Thêm field vào model Transaction

```prisma
model Transaction {
  // ... các field hiện có giữ nguyên ...

  source           TransactionSource    @default(cas)
  direction        TransactionDirection @default(in)
  importBatchId    String?              @map("import_batch_id")  // null với GD Cas

  importBatch      TransactionImportBatch? @relation(fields: [importBatchId], references: [id])

  // Cas: direction = amount >= 0 ? in : out (set lúc lưu webhook)
  // Import: amount luôn dương; direction từ cột Thu/Chi trong Excel
}

model TransactionImportBatch {
  id            String   @id @default(uuid())
  tenantId      String   @map("tenant_id")
  fileName      String   @map("file_name")
  totalRows     Int      @map("total_rows")
  importedCount Int      @map("imported_count")
  skippedCount  Int      @map("skipped_count")
  importedBy    String   @map("imported_by")   // userId
  createdAt     DateTime @default(now()) @map("created_at")

  tenant       Tenant        @relation(fields: [tenantId], references: [id], onDelete: Cascade)
  transactions Transaction[]

  @@index([tenantId, createdAt])
  @@map("transaction_import_batches")
}
```

**Lưu ý quan trọng:**

- `transactionId` (unique constraint) hiện dùng ID từ Cas. Với GD import, tự gen theo mục 5.3
- `grantId` để null với GD import (đã nullable sẵn)
- `senderAccount` / `receiverAccount` để null với GD import — không có thông tin đối tác
- `classification_type: manual` trên bảng `transaction_classifications` vẫn có nghĩa **kế toán sửa định khoản AI** — không nhầm với `source=import`

### 3.3 Migration

```sql
-- Thêm enum
CREATE TYPE "TransactionSource" AS ENUM ('cas', 'import');
CREATE TYPE "TransactionDirection" AS ENUM ('in', 'out');

-- Thêm column với default để không break data cũ
ALTER TABLE "transactions"
  ADD COLUMN "source" "TransactionSource" NOT NULL DEFAULT 'cas',
  ADD COLUMN "direction" "TransactionDirection" NOT NULL DEFAULT 'in',
  ADD COLUMN "import_batch_id" UUID;

-- Backfill direction cho GD Cas hiện có (amount âm = chi, dương = thu)
UPDATE "transactions"
SET "direction" = CASE WHEN amount >= 0 THEN 'in'::"TransactionDirection" ELSE 'out'::"TransactionDirection" END
WHERE "source" = 'cas';

-- Bảng lịch sử import
CREATE TABLE "transaction_import_batches" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "tenant_id" UUID NOT NULL REFERENCES "tenants"("id") ON DELETE CASCADE,
  "file_name" TEXT NOT NULL,
  "total_rows" INTEGER NOT NULL,
  "imported_count" INTEGER NOT NULL,
  "skipped_count" INTEGER NOT NULL,
  "imported_by" UUID NOT NULL,
  "created_at" TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX "transaction_import_batches_tenant_id_created_at_idx"
  ON "transaction_import_batches" ("tenant_id", "created_at");

ALTER TABLE "transactions"
  ADD CONSTRAINT "transactions_import_batch_id_fkey"
  FOREIGN KEY ("import_batch_id") REFERENCES "transaction_import_batches"("id") ON DELETE SET NULL;
```

---

## 4. AI classification — thay đổi bắt buộc

`apps/backend/src/modules/ai/classification.service.ts` hiện suy direction từ **dấu `amount`**:

```typescript
const direction: 'in' | 'out' = amount >= 0 ? 'in' : 'out';
```

Với GD import, `amount` luôn dương → logic cũ coi mọi GD import là **Thu**, AI gợi ý sai.

**Quy tắc mới (áp dụng trong `processTransaction`):**

```typescript
function resolveDirection(transaction: Transaction): 'in' | 'out' {
  if (transaction.source === 'import') {
    return transaction.direction; // đã validate từ cột Thu/Chi
  }
  // Cas + data cũ: giữ tương thích amount âm/dương
  return Number(transaction.amount) >= 0 ? 'in' : 'out';
}
```

**Đồng bộ khi lưu webhook Cas** (`banking.service.ts`): set thêm `source: cas` và `direction` từ dấu `txn.amount` lúc `create`, để field `direction` nhất quán trên mọi GD mới.

`classification.processor.ts` không đổi — chỉ delegate sang `classification.service.ts`.

---

## 5. Template Excel

Kế toán tải về file `.xlsx` mẫu, điền rồi upload lại. Template có đúng 4 cột:

| Ngày | Mô tả | Số tiền | Loại |
|------|-------|---------|------|
| 01/07/2026 | Mua nguyên liệu cafe | 2500000 | Chi |
| 01/07/2026 | Thu tiền bán hàng buổi sáng | 8000000 | Thu |
| 02/07/2026 | Trả lương nhân viên | 5000000 | Chi |

**Quy tắc:**

- **Ngày:** `dd/MM/yyyy` (chuẩn VN). Chấp nhận thêm `dd-MM-yyyy` và `yyyy-MM-dd`
- **Mô tả:** chuỗi bất kỳ, tối đa 500 ký tự, không được rỗng
- **Số tiền:** số nguyên dương (VNĐ). Parser chấp nhận:
  - `2500000` (khuyến nghị trong template)
  - `2.500.000`, `2,500,000` (strip `.` và `,` rồi parse)
  - `2500000đ`, `2.500.000 VNĐ` (strip ký tự không phải số trước khi parse)
  - Từ chối nếu sau normalize ≤ 0 hoặc không parse được
- **Loại:** chính xác là `Thu` hoặc `Chi` (không phân biệt hoa thường: `thu`, `THU`, `chi`, `CHI` đều chấp nhận)

**Sheet chứa data:** Sheet đầu tiên. Dòng 1 là header (bỏ qua), data bắt đầu từ dòng 2.

**Giới hạn:** Tối đa 500 dòng/lần upload (bằng quota tháng cao nhất của Starter plan). Chỉ chấp nhận `.xlsx`, tối đa 2MB.

---

## 6. API Backend

### 6.1 Endpoints mới

```
GET  /api/v1/transactions/import/template    # Tải file Excel mẫu (.xlsx)
POST /api/v1/transactions/import/validate    # Dry-run: validate file, trả lỗi, KHÔNG import
POST /api/v1/transactions/import             # Import thật sau khi validate OK
GET  /api/v1/transactions/import/history     # Lịch sử các lần import của tenant (phân trang)
```

**RBAC:** `Admin`, `Accountant` — cập nhật bảng phân quyền trong `agent-docs/reference/rbac.md` khi implement.

### 6.2 Flow validate (dry-run)

`POST /api/v1/transactions/import/validate` nhận `multipart/form-data` với field `file` (chỉ `.xlsx`).

**Response thành công (không có lỗi):**

```json
{
  "success": true,
  "data": {
    "valid": true,
    "totalRows": 47,
    "quotaImpact": {
      "willUse": 47,
      "remaining": 453,
      "willExceedQuota": false
    },
    "preview": [
      {
        "row": 2,
        "date": "2026-07-01",
        "description": "Mua nguyên liệu cafe",
        "amount": 2500000,
        "direction": "out"
      }
    ],
    "warnings": [
      { "row": 5, "message": "Ngày hơn 2 năm trước — vui lòng kiểm tra lại" }
    ]
  }
}
```

**Response có lỗi:**

```json
{
  "success": true,
  "data": {
    "valid": false,
    "totalRows": 47,
    "errorCount": 3,
    "errors": [
      { "row": 12, "column": "Ngày", "value": "32/07/2026", "message": "Ngày không hợp lệ" },
      { "row": 45, "column": "Số tiền", "message": "Số tiền không được để trống" },
      { "row": 47, "column": "Loại", "value": "Nhập", "message": "Loại phải là 'Thu' hoặc 'Chi'" }
    ]
  }
}
```

Frontend hiển thị bảng lỗi chi tiết, user sửa file rồi upload lại. **Không import khi có lỗi.**

### 6.3 Flow import thật

`POST /api/v1/transactions/import` nhận cùng file (frontend validate trước, backend validate lại để an toàn).

**Bước 0:** Tạo `TransactionImportBatch` (fileName, totalRows, importedBy).

**Idempotency — `transactionId` cho mỗi dòng:**

```
import_{tenantId}_{sha256(isoDate + '|' + rowIndex + '|' + description.trim().toLowerCase() + '|' + amount + '|' + direction)}
```

- `rowIndex` = số dòng trong sheet Excel (bắt đầu từ 2)
- Upload **cùng file** lần 2 → mọi dòng trùng hash → skip (không duplicate)
- **Hai dòng khác row** nhưng cùng nội dung trong một file → vẫn import được (hash khác vì `rowIndex` khác)

**Xử lý trong transaction Prisma:**

```
1. validateRows() — throw nếu còn lỗi
2. assertQuotaForBatch(totalRows) — dùng TransactionQuotaService (xem 6.5)
3. Tạo TransactionImportBatch
4. Với mỗi dòng hợp lệ:
   a. Tính transactionId từ hash (mục trên)
   b. findUnique(transactionId) — nếu đã có → skip, ghi skippedReasons
   c. Tạo Transaction (source=import, direction, amount dương, importBatchId)
   d. incrementUsage(tenantId) — chung quota với webhook
   e. Enqueue ai-classify job
5. Cập nhật batch importedCount / skippedCount
6. AuditLog batch-level: action = 'transaction_import', entityType = 'transaction_import_batch'
```

**Response:**

```json
{
  "success": true,
  "data": {
    "batchId": "uuid",
    "imported": 45,
    "skipped": 2,
    "skippedReasons": [
      { "row": 23, "reason": "Giao dịch đã tồn tại (upload trùng)" }
    ],
    "quotaWarning": "Import vượt quota — phí vượt sẽ tính vào chu kỳ hiện tại"
  }
}
```

### 6.4 Lịch sử import

`GET /api/v1/transactions/import/history?page=1&limit=20`

```json
{
  "success": true,
  "data": {
    "items": [
      {
        "id": "uuid",
        "fileName": "quy-tien-mat-thang-7.xlsx",
        "totalRows": 47,
        "importedCount": 45,
        "skippedCount": 2,
        "importedByName": "Nguyễn Văn A",
        "createdAt": "2026-07-04T10:00:00.000Z"
      }
    ],
    "total": 3,
    "page": 1,
    "limit": 20
  }
}
```

### 6.5 Quota enforcement — `TransactionQuotaService`

Tách logic quota/overage từ `banking.service.ts` sang service dùng chung để **webhook Cas và import không lệch behavior**:

```typescript
// apps/backend/src/modules/billing/transaction-quota.service.ts (hoặc tương đương)

assertCanAcceptBatch(tenantId, rowCount): void
  // Free: throw ForbiddenException nếu rowCount > remaining
  // Starter/Pro: cho phép, trả warning nếu vượt quota
  // Enterprise: luôn cho phép

incrementUsage(tenantId, count = 1): Promise<void>
  // transactionUsedThisCycle += count
  // ghi usageLog overage nếu Starter/Pro và đã vượt quota
  // trigger notification quota_warning / quota_exceeded (giữ dedup hiện có)
```

`banking.service.ts` refactor gọi `TransactionQuotaService` thay vì inline logic — behavior giữ nguyên, chỉ extract.

---

## 7. Frontend

### 7.1 Entry point

Trên `TransactionsPage`, thêm button **"Nhập từ Excel"** cạnh filter bar (chỉ hiện với Admin/Accountant).

### 7.2 Import Dialog — 3 bước

**Bước 1: Upload file**

- Drag & drop hoặc click chọn file **`.xlsx` only**
- Link "Tải template Excel mẫu" ngay trong dialog
- Cảnh báo: *"Không nhập các giao dịch đã có trong sao kê ngân hàng liên kết để tránh tính trùng"*

**Bước 2: Preview & validate**

- Tự động gọi `/validate` khi user chọn file
- Nếu OK: preview 5 dòng đầu + tổng số dòng + `quotaImpact`
- Hiển thị `warnings` (ngày quá cũ…) nếu có — không block
- Nếu có lỗi: bảng lỗi (row, cột, giá trị, lý do). Không cho tiếp tục

**Bước 3: Kết quả**

- "Đã nhập X giao dịch, bỏ qua Y trùng lặp"
- Invalidate query `transactions` và `review-queue` tự động
- Đóng dialog, TransactionsPage refresh

### 7.3 Badge phân biệt nguồn

Trên `TransactionsPage` và `TransactionDetailSheet`, GD `source=import` hiển thị badge **"Import Excel"** (màu amber) cạnh ngày. GD từ ngân hàng (`source=cas`) không có badge.

### 7.4 Filter thêm

`TransactionsPage` thêm filter `source`: **Tất cả / Ngân hàng / Import Excel**.

Query param gợi ý: `?source=cas` | `?source=import`.

---

## 8. Shared Types

```typescript
// packages/shared-types/src/index.ts

export enum TransactionSource {
  CAS = 'cas',
  IMPORT = 'import',
}

export enum TransactionDirection {
  IN = 'in',
  OUT = 'out',
}

export interface ImportValidateResult {
  valid: boolean;
  totalRows: number;
  errorCount?: number;
  errors?: Array<{
    row: number;
    column?: string;
    value?: string;
    message: string;
  }>;
  warnings?: Array<{ row: number; message: string }>;
  quotaImpact?: {
    willUse: number;
    remaining: number;
    willExceedQuota: boolean;
  };
  preview?: Array<{
    row: number;
    date: string;
    description: string;
    amount: number;
    direction: TransactionDirection;
  }>;
}

export interface ImportResult {
  batchId: string;
  imported: number;
  skipped: number;
  skippedReasons?: Array<{ row: number; reason: string }>;
  quotaWarning?: string;
}

export interface ImportHistoryItem {
  id: string;
  fileName: string;
  totalRows: number;
  importedCount: number;
  skippedCount: number;
  importedByName: string;
  createdAt: string;
}
```

---

## 9. Các edge case cần xử lý

| Edge case | Cách xử lý |
|-----------|------------|
| Upload cùng file 2 lần | Cùng `transactionId` hash → skip từng dòng, báo trong `skippedReasons` |
| Nhiều dòng giống nhau trong 1 file | Hash khác nhau vì `rowIndex` khác → import hết |
| Rút tiền NH → quỹ đã có webhook Cas | Cảnh báo trong UI; không auto-detect |
| Dòng có số tiền = 0 | Lỗi validation: "Số tiền phải lớn hơn 0" |
| Số tiền `2.500.000` / `2,500,000` | Normalize rồi parse — chấp nhận |
| File có sheet ẩn / nhiều sheet | Chỉ đọc sheet đầu tiên |
| File Excel password protect | Lỗi: "Không thể đọc file. Vui lòng bỏ bảo vệ file trước khi upload" |
| File `.csv` / sai định dạng | Từ chối: "Chỉ hỗ trợ file Excel (.xlsx)" |
| File quá lớn (> 2MB) | Từ chối ở middleware |
| Mô tả quá dài (> 500 ký tự) | Cắt tự động, ghi log warning |
| Ngày trong tương lai | Cho phép |
| Ngày quá cũ (> 2 năm) | Warning trong preview, không block |
| Upload khi hết quota (Free plan) | Block trước import; message rõ còn bao nhiêu slot |
| Starter/Pro vượt quota | Cho import; warning + overage như webhook |

---

## 10. Tích hợp với báo cáo

Không cần thay đổi logic tổng hợp ở `report.service.ts`. Vì:

- Query báo cáo filter theo `tenantId` + classification `status`
- GD import sau AI classify có `status = classified` hoặc `review`
- Tự động vào báo cáo như GD ngân hàng

**Cần thêm:** `GET /billing/usage-history` phân biệt GD theo `source`:

```json
{
  "thisMonth": {
    "total": 287,
    "fromBank": 230,
    "fromImport": 57,
    "quota": 500
  }
}
```

---

## 11. Phases implement

### Phase 1 — Schema + Backend core (~1.5 ngày)

- [ ] Migration: enum `source`/`direction`, bảng `transaction_import_batches`, FK `import_batch_id`
- [ ] Backfill `direction` cho GD Cas cũ (SQL trong migration)
- [ ] Cập nhật `shared-types` (enum + interface mục 8)
- [ ] Tách `TransactionQuotaService` từ `banking.service.ts`; refactor webhook dùng service chung
- [ ] `banking.service.ts`: set `source=cas` + `direction` khi tạo GD mới
- [ ] `classification.service.ts`: `resolveDirection()` theo mục 4
- [ ] `ImportService`: `parseExcel`, `normalizeAmount`, `validateRows`, `importRows`, `generateTransactionId`
- [ ] `ImportController`: template, validate, import, history
- [ ] `ImportModule` + đăng ký `app.module.ts`
- [ ] `audit-log.labels.ts`: thêm `transaction_import: 'Import giao dịch từ Excel'`
- [ ] Unit test: `validateRows`, `normalizeAmount`, `resolveDirection`, quota batch

### Phase 2 — Frontend Dialog (~1 ngày)

- [ ] `ImportTransactionsDialog` (3 bước)
- [ ] Nút "Nhập từ Excel" trên `TransactionsPage`
- [ ] Badge "Import Excel" + filter `source`
- [ ] Invalidate queries sau import

### Phase 3 — Polish (~0.5 ngày)

- [ ] `usage-history` breakdown `fromBank` / `fromImport`
- [ ] `SettingsPage` BillingTab hiển thị breakdown
- [ ] Quota warning trong preview import
- [ ] E2E: upload → validate → import → review → confirm → báo cáo đúng (kể cả GD Chi tiền mặt)

### Phase 4 — Template Excel (~0.5 ngày)

- [ ] Template `.xlsx`: header, 3 dòng ví dụ xám, sheet "Hướng dẫn"
- [ ] Dropdown `Thu`/`Chi` trên cột Loại (Excel data validation)
- [ ] `GET /import/template` gen dynamic từ `xlsx` lib

**Tổng ước tính: ~3.5 ngày**

---

## 12. Không làm trong scope này

- Form nhập tay từng giao dịch (làm sau nếu feedback)
- Import CSV / MISA / Fast Accounting
- Detect tự động trùng với GD ngân hàng
- Sửa/xóa GD import riêng — dùng flow Transaction hiện có
- Plan gating riêng cho import — mọi gói đều dùng được, chỉ chịu quota chung

---

## 13. Tác động lên code hiện có

| File/Module | Thay đổi |
|-------------|---------|
| `prisma/schema.prisma` | 2 enum, 3 field `Transaction`, model `TransactionImportBatch` |
| `packages/shared-types/src/index.ts` | Enum + interface import |
| `banking.service.ts` | Set `source`/`direction`; gọi `TransactionQuotaService` |
| `billing/transaction-quota.service.ts` | **Mới** — logic quota/overage dùng chung |
| `ai/classification.service.ts` | **`resolveDirection()`** — bắt buộc |
| `classification.processor.ts` | Không đổi |
| `transaction.service.ts` | Select/filter `source`, `direction`; query param `source` |
| `report.service.ts` | Không đổi |
| `billing.service.ts` | `fromImport` trong usage history |
| `audit-log.labels.ts` | Label `transaction_import` |
| `agent-docs/reference/rbac.md` | Thêm 4 endpoint import |
| `app.module.ts` | `ImportModule` |
| `TransactionsPage.tsx` | Button, dialog, filter, badge |
| `TransactionDetailSheet.tsx` | Badge "Import Excel" |
