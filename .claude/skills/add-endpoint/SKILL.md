---
name: add-endpoint
description: Checklist đầy đủ khi thêm 1 API endpoint mới vào backend X-Cash AI — tra RBAC matrix, gắn @Roles đúng, tenant scoping, cập nhật rbac.md, viết test liên quan. Dùng khi thêm route mới vào controller có sẵn hoặc khi user gõ "/add-endpoint".
---

# Add Endpoint — Checklist thêm API endpoint chuẩn X-Cash AI

Dùng skill này khi thêm 1 route mới vào controller **đã tồn tại** (nếu cần cả module mới, dùng skill `new-module` trước, rồi áp checklist này cho từng route bên trong).

## Bước 1 — Xác định endpoint thuộc nhóm quyền nào

Mở [`agent-docs/reference/rbac.md`](../../agent-docs/reference/rbac.md) mục "Ma trận phân quyền đầy đủ (cấp Tenant)", tìm đúng nhóm tính năng (Dashboard & Analytics / Transactions / Human Review / Invoices / Customers / AI Copilot / AI Knowledge Base / Settings / Billing / Team Management / Audit Log). Nếu endpoint thuộc `/partner/*`, dùng bảng "API riêng cho Cas Partner" thay vì bảng này.

Nếu tính năng hoàn toàn mới, chưa có dòng nào trong ma trận — dừng lại, hỏi user role nào được phép trước khi code, đừng tự đoán.

## Bước 2 — Đối chiếu path/method/query param chuẩn

Tra [`agent-docs/reference/business-overview.md`](../../agent-docs/reference/business-overview.md#-api-design) mục API Design để lấy đúng:
- Path (`/api/v1/...`, đã có version prefix)
- Query param filter chuẩn (vd `?status=&from_date=&to_date=&page=&limit=`)
- Response example format nếu tài liệu có sẵn (mục "Request / Response Examples")

Không tự đặt tên path/param khác đi nếu tài liệu đã định nghĩa sẵn — FE code mẫu trong `ui-design.md` gọi đúng theo path này.

## Bước 3 — Implement đúng guard + role

```typescript
@Get(':id/matches')                          // ví dụ GET /transactions/:id/matches
// Không @Roles() nếu Admin/Accountant/Viewer đều xem được (đối chiếu ma trận)
findMatches(@Req() req, @Param('id') id: string) {
  return this.transactionService.findMatches(req.user.tenantId, id);
}

@Post(':id/reassign')
@Roles(Role.ADMIN, Role.ACCOUNTANT)           // chỉ role được phép thao tác theo ma trận
reassign(@Req() req, @Param('id') id: string, @Body() dto: ReassignDto) {
  return this.reviewService.reassign(req.user.tenantId, id, dto);
}
```

Trường hợp đặc biệt cần nhớ:
- Route dưới `/partner/*` dùng `PartnerGuard`, không dùng `RolesGuard` — 2 guard không bao giờ chung 1 controller.
- Route `webhook/cas` và `webhook/payos-billing` **không** dùng `JwtAuthGuard`/`RolesGuard` (request đến từ bên ngoài, không có JWT user) — thay vào đó verify signature riêng (HMAC), xem `agent-docs/02-backend-conventions.md` mục Webhook.
- Team Management, Settings — Notification, Settings — AI Matching (đổi threshold), Billing (upgrade/invoices) chỉ `Role.ADMIN` — Accountant không được, dù có quyền xem (GET) nhiều chỗ khác.

## Bước 4 — Tenant scoping (bỏ qua nếu route là `/partner/*`)

`tenantId` luôn lấy từ `req.user.tenantId` (đã decode từ JWT), **không bao giờ** nhận `tenant_id` từ query/body client gửi lên rồi tin dùng thẳng — đây là lỗ hổng lộ dữ liệu tenant khác nếu client tự sửa param.

## Bước 5 — Response format

Trả data thô, để `ResponseInterceptor` toàn cục bọc thành `{ success, data, meta, error }` (type `ApiResponse<T>` từ `@xcash/shared-types`) — không tự bọc tay trong từng handler.

## Bước 6 — Cập nhật tài liệu

Sau khi code xong, thêm 1 dòng vào bảng ma trận phân quyền trong `agent-docs/reference/rbac.md` nếu endpoint chưa có sẵn dòng tương ứng — đây là checklist gốc yêu cầu ("Đã thêm dòng tương ứng vào bảng phân quyền trong file này chưa?"). **Xác nhận với user trước khi sửa file trong `reference/`** vì đây là tài liệu đồ án đã duyệt.

## Bước 7 — Test

- Viết test case: đúng role thao tác thành công, sai role trả `403 Forbidden` (đối chiếu edge case "Accountant cố gọi API chỉ dành cho Admin" trong `reference/rbac.md`).
- Nếu endpoint đụng vào webhook/quota/idempotency, viết integration test riêng — 3 nhánh này bắt buộc test tách biệt theo `agent-docs/02-backend-conventions.md`.
- Chạy `pnpm --filter @xcash/backend test` trước khi coi là xong.

## Checklist tóm tắt (đối chiếu trước khi merge)

- [ ] Endpoint đã có trong bảng phân quyền `rbac.md`
- [ ] `@UseGuards(JwtAuthGuard, RolesGuard)` (hoặc `PartnerGuard` nếu `/partner/*`)
- [ ] `@Roles(...)` đúng — hoặc cố ý không gắn nếu mọi role đã login đều được phép
- [ ] Tenant scoping từ `req.user.tenantId`, không tin param client
- [ ] Response qua `ApiResponse<T>`, không tự bọc tay
- [ ] Test 403 cho role sai + test happy path
- [ ] FE (nếu có) đã ẩn/disable UI tương ứng qua `usePermission()` — xem skill `new-page`
