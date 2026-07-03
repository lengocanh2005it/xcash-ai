---
name: new-page
description: Scaffold một page/màn hình React mới trong apps/frontend/src/pages/ đúng chuẩn X-Cash AI (route, layout đúng, TanStack Query hook, RBAC ẩn/hiện UI, loading/empty/error state). Dùng khi cần thêm màn hình mới hoặc khi user gõ "/new-page <tên>".
---

# New Page — Scaffold màn hình React chuẩn X-Cash AI

## Trước khi chạy

Đọc trước:
- [`agent-docs/03-frontend-conventions.md`](../../agent-docs/03-frontend-conventions.md) — cấu trúc thư mục, 2 layout tách biệt, TanStack Query, **palette Casso/payOS, responsive, dark mode**
- [`agent-docs/reference/ui-design.md`](../../agent-docs/reference/ui-design.md) — **đa số màn hình đã có spec + code JSX mẫu**; đọc mục **Brand palette (Casso/payOS)** trước khi chọn màu/layout. Nếu màn hình cần tạo đã có trong đây (Dashboard, Transactions, Human Review, Invoices, Customers, Analytics, AI Copilot, Settings, Partner Dashboard) — copy sát code mẫu, không tự sáng tác lại UI.
- [`agent-docs/reference/rbac.md`](../../agent-docs/reference/rbac.md) mục "Frontend — Ẩn/hiện UI theo role" — xác định hành động nào trên trang cần bọc `usePermission()`.

Xác định trang mới thuộc **Tenant Layout** (8 màn hình nghiệp vụ, có Sidebar) hay **Partner Layout** (`/partner`, chỉ Cas Partner, không Sidebar). Hai layout không dùng chung — hỏi lại user nếu không rõ trang mới thuộc phía nào.

## Việc cần làm

Cho page tên `<page>` (kebab-case, vd `invoices`, `human-review`):

1. Tạo `apps/frontend/src/pages/<page>/` gồm:
   - `<Page>Page.tsx` — component chính, export default
   - `hooks.ts` hoặc dùng chung `apps/frontend/src/hooks/use<Domain>.ts` nếu domain đã có hook (không tạo hook trùng)
   - Nếu trang có Detail Sheet/Dialog riêng biệt, tách thành component con trong cùng thư mục (`<Page>DetailSheet.tsx`...), không nhồi hết vào 1 file quá dài

2. Đăng ký route trong `apps/frontend/src/App.tsx`:
   - Trang nghiệp vụ thường: bọc trong `<ProtectedRoute>` + layout Sidebar (`TenantLayout`)
   - Trang `/partner`: bọc trong `<PartnerRoute>` riêng, layout `PartnerLayout`, **không** import bất kỳ API/component nào từ các trang nghiệp vụ khác

3. Data fetching dùng đúng pattern TanStack Query đã chuẩn hóa trong `03-frontend-conventions.md` — polling `refetchInterval: 10_000` cho data cần real-time (transactions, dashboard, review queue); mutation luôn kèm `onSuccess` (toast + invalidate query liên quan) và `onError` (toast lỗi).

4. Dùng lại component chung, không viết lại: `formatVND`, `StatusBadge`, `ConfidenceBadge`, `TableSkeleton`, `EmptyState` (từ `apps/frontend/src/components/shared/`). Nếu component đó chưa tồn tại và trang cần, tạo nó ở `components/shared/` theo đúng spec mẫu trong `reference/ui-design.md` mục "Shared Components" — không định nghĩa cục bộ trong page.

5. Ẩn/disable action theo role bằng `usePermission()`:
   ```tsx
   const { can } = usePermission();
   {can('invoice:create') && <Button onClick={openCreateDialog}>+ Tạo hóa đơn</Button>}
   ```
   Nhớ: đây chỉ là UX, backend vẫn phải tự validate role — không bỏ qua bước gắn `@Roles()` ở BE vì nghĩ FE đã ẩn nút là đủ.

6. Bắt buộc có đủ 3 state cho mọi danh sách/bảng: Loading (Skeleton), Empty (icon + message tiếng Việt), Error (toast + nút retry) — theo pattern cuối mỗi mục màn hình trong `reference/ui-design.md`.

7. Toàn bộ text hiển thị (label, placeholder, message) viết tiếng Việt, đúng văn phong đã dùng trong `reference/ui-design.md` (không tự dịch khác đi).

8. **Phong cách UI (bắt buộc):**
   - Màu: dùng Tailwind token `primary`, `background`, `muted` từ `index.css` — primary `#16AB64` (Casso/payOS). Không dùng `green-600`, `blue-500`... trừ khi spec confidence/status trong `ui-design.md`.
   - **ShadCN trước:** dùng `@/components/ui/*` (Button, Card, Table, Input, Label, Badge...). Thiếu component → `pnpm dlx shadcn@latest add <tên>` trong `apps/frontend`, không tự viết HTML+Tailwind thay thế. Tra docs: [ui.shadcn.com/docs/components](https://ui.shadcn.com/docs/components).
   - Layout tenant: bọc trong `Header` + content `p-4 sm:p-6`, nền surface `#F8FAFB`.
   - Bảng: ShadCN `Table` trên desktop; mobile có thể dùng `Card` list (xem `TransactionsPage`).
   - CTA chính: `<Button>` default variant; link phụ: `text-primary hover:underline` hoặc `Button variant="link"`.
   - Mọi layout phải có `ThemeToggle` (đã có trong `Header` / `Sidebar` / `AuthLayout`).

## Sau khi scaffold xong

- Chạy `pnpm --filter @xcash/frontend type-check` và `pnpm --filter @xcash/frontend lint`.
- Nếu page gọi API chưa tồn tại ở backend, note rõ cho user — không tự bịa response shape, tra `agent-docs/reference/business-overview.md` mục API Design để lấy đúng path + query param.
- Nếu cần type mới dùng chung với backend, thêm vào `packages/shared-types/src/index.ts` trước khi dùng trong page.

## Ví dụ khung tối thiểu

```tsx
// apps/frontend/src/pages/invoices/InvoicesPage.tsx
import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { usePermission } from '@/hooks/usePermission';
import { Button } from '@/components/ui/button';
import { EmptyState } from '@/components/shared/EmptyState';
import { TableSkeleton } from '@/components/shared/TableSkeleton';

export default function InvoicesPage() {
  const { can } = usePermission();
  const { data, isLoading, error } = useQuery({
    queryKey: ['invoices', filters],
    queryFn: () => api.get('/invoices', { params: filters }),
  });

  if (isLoading) return <TableSkeleton rows={5} />;
  if (error) return <EmptyState icon={AlertCircle} title="Có lỗi xảy ra" description="Vui lòng thử lại" />;
  if (!data?.length) return <EmptyState icon={FileText} title="Chưa có hóa đơn nào" description="Tạo hóa đơn đầu tiên để bắt đầu" />;

  return (
    <div>
      <div className="flex justify-between items-center mb-4">
        <h1 className="text-xl font-semibold">Hóa đơn</h1>
        {can('invoice:create') && <Button>+ Tạo hóa đơn</Button>}
      </div>
      {/* Table */}
    </div>
  );
}
```
