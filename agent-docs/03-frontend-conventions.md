# Frontend Conventions — `apps/frontend` (React + Vite)

## Stack

React 19 + Vite + TypeScript + Tailwind CSS + [ShadCN/UI](https://ui.shadcn.com/docs/components) + TanStack Query + React Router + Recharts + Sonner (toast) + Lucide React (icon). Chi tiết component mẫu cho từng màn hình đã có sẵn (JSX gần như copy-paste được) tại [`reference/ui-design.md`](./reference/ui-design.md) — **đọc file đó trước khi tự viết component mới**, đa số màn hình đã có spec + code mẫu.

## ShadCN/UI — ưu tiên dùng component có sẵn, không tự viết lại

**Nguyên tắc:** UI primitives lấy từ `@/components/ui/*` (ShadCN). **Không** tự tạo `<button>`, `<table>`, input, card, badge... bằng Tailwind thuần khi ShadCN đã có component tương ứng. **Catalog chính thức:** [ui.shadcn.com/docs/components](https://ui.shadcn.com/docs/components) — tra API, variant, ví dụ trước khi code hoặc `shadcn add`.

| Cần | Dùng ShadCN | Không làm |
|---|---|---|
| Nút / icon button | `Button` | `<button className="...">` tự style |
| Ô nhập / form | `Input`, `Label` | `<input>` + `<label>` raw |
| Khối nội dung | `Card`, `CardHeader`, `CardContent` | `<div className="rounded-lg border...">` |
| Bảng | `Table`, `TableRow`, `TableCell`... | `<table>` HTML thuần |
| Trạng thái | `Badge`, `Skeleton` | span/div tự chế |
| Toast | `sonner` (`toast.success/error`) | `alert()` hoặc div toast custom |
| Dialog / drawer mobile | `Dialog`, `Sheet` (thêm qua CLI khi cần) | overlay + div tự viết |

**Khi thiếu component:** thêm bằng CLI từ `apps/frontend`:

```bash
pnpm dlx shadcn@latest add table label select dialog sheet separator tabs alert
```

Chỉ compose wrapper mỏng ở `components/layout/` (app shell) hoặc `components/shared/` (vd `ThemeToggle` bọc `Button`) — logic/style lõi vẫn từ ShadCN.

**Đã cài trong repo (`components/ui/`):** `button`, `card`, `badge`, `input`, `skeleton`, `table`, `label`, `dialog`. Các màn Sprint 2+ (invoice, review, settings...) thêm `select`, `sheet`, `tabs`... qua CLI trước khi code.

**Dashboard charts (Recharts):** aggregate client-side từ `GET /transactions?limit=100` (max BE cho phép) — `TransactionTrendChart` (AreaChart 7 ngày), `TransactionStatusChart` (Donut trạng thái), helper tại `lib/dashboard-transactions.ts`. Màu chart dùng CSS variables `--chart-1`…`--chart-5` trong `index.css` (hỗ trợ dark mode). Sprint 2+ sẽ chuyển doanh thu / AI stats sang `/analytics/*` khi backend có endpoint.

## Dark / Light mode

- Dùng class `.dark` trên `document.documentElement` (token màu đã khai báo trong `apps/frontend/src/index.css`).
- `ThemeProvider` (`contexts/theme-context.tsx`) + `ThemeToggle` (`components/shared/ThemeToggle.tsx`) — lưu preference vào `localStorage` key `paypilot-theme`.
- Lần đầu vào app: nếu chưa có key, fallback theo `prefers-color-scheme`; `index.html` có inline script nhỏ để tránh flash theme sai lúc load.
- **Vị trí toggle trên UI:** Sidebar (tenant layout), Header (onboarding/partner), góc phải trên (auth layout). Mọi layout mới phải có chỗ toggle theme, không tạo logic riêng lẻ.

## Màu sắc & phong cách UI

Tham chiếu giao diện **Casso** (`casso.vn`) và **payOS** (`payos.vn`) — nền trắng sạch + xanh fintech:

| Token | Giá trị | Ghi chú |
|---|---|---|
| Primary | `#16AB64` | Finverse Green — nút CTA, link, nav active (lấy mẫu từ payOS/Casso) |
| Background | `#FFFFFF` | Nền trang chính |
| Surface | `#F8FAFB` | Vùng content app (dashboard, list) |
| Text | `#1E2022` | Tiêu đề / body chính |
| Tint | `primary/10` | Nền active nav, badge nhẹ |

- Implement qua CSS variables trong `apps/frontend/src/index.css` (oklch).
- Nút primary / link / trạng thái thành công dùng `text-primary` / `bg-primary`, không hard-code `green-600` rời.
- Auth: card trắng trên nền trắng + gradient xanh nhẹ phía trên (giống hero Casso/payOS).

## Responsive

- Breakpoint chính: `lg` (1024px) — sidebar cố định desktop, drawer + top bar mobile (`TenantLayout`).
- Padding trang: `p-4 sm:p-6`; header `px-4 sm:px-6`.
- Bảng dữ liệu: card list trên `<md`, table + `overflow-x-auto` từ `md` trở lên.
- Grid dashboard: `sm:grid-cols-2 xl:grid-cols-3`.

## Cấu trúc thư mục mục tiêu

```
apps/frontend/src/
├── main.tsx
├── App.tsx                        # Router setup
├── pages/
│   ├── auth/                      # Register, Login
│   ├── onboarding/                 # 4 bước onboarding
│   ├── dashboard/
│   ├── transactions/
│   ├── review/                     # Human Review Queue
│   ├── invoices/
│   ├── customers/
│   ├── analytics/
│   ├── copilot/                    # AI Copilot chat
│   ├── settings/                   # tabs: Banking/Billing/Notification/Team/KB/Threshold
│   └── partner/                    # Partner Dashboard — layout RIÊNG, xem bên dưới
├── components/
│   ├── ui/                         # ShadCN — button, card, badge, input, skeleton, table, label (+ thêm qua CLI)
│   ├── layout/                     # Sidebar, Header, TenantLayout, PartnerLayout
│   └── shared/                     # ConfidenceBadge, StatusBadge, EmptyState, TableSkeleton, ThemeToggle...
├── contexts/
│   ├── auth-context.tsx
│   └── theme-context.tsx           # dark/light mode (localStorage paypilot-theme)
├── hooks/
│   ├── useAuth.ts
│   ├── usePermission.ts             # xem reference/rbac.md mục Frontend — Ẩn/hiện UI theo role
│   └── use<Domain>.ts               # TanStack Query hook theo domain, vd useTransactions.ts
├── lib/
│   ├── api.ts                       # Axios instance — base URL, interceptor refresh token
│   ├── formatVND.ts
│   └── utils.ts                     # cn() cho ShadCN, v.v.
└── routes/
    ├── ProtectedRoute.tsx            # check auth + role
    └── PartnerRoute.tsx               # riêng cho /partner, redirect role khác về /dashboard
```

## Hai layout tách biệt hoàn toàn — không dùng chung

| | Tenant Layout | Partner Layout |
|---|---|---|
| Role | Admin / Accountant / Viewer | Cas Partner |
| Route | `/dashboard`, `/transactions`, `/invoices`... (8 màn hình) | `/partner` |
| Sidebar | Có, 8 mục | Không, chỉ top nav |

Chi tiết đầy đủ 2 layout tại [`reference/ui-design.md`](./reference/ui-design.md#-global-layout-tenant--mục-18) mục Global Layout và mục 9 Partner Dashboard. **Không import component/API nghiệp vụ (`/transactions`, `/invoices`, `/customers`) vào bất kỳ đâu trong `pages/partner/`** — đây là dấu hiệu thiết kế sai đã được cảnh báo rõ trong tài liệu gốc.

## RBAC trên frontend — không tin FE ẩn nút là đủ

Backend luôn validate lại role ở mọi endpoint (xem `agent-docs/02-backend-conventions.md`). FE chỉ ẩn/disable UI để trải nghiệm tốt hơn, dùng hook `usePermission()`:

```tsx
const { can } = usePermission();
{can('invoice:create') && <Button onClick={openCreateDialog}>+ Tạo hóa đơn</Button>}
```

Bảng permission đầy đủ để implement `usePermission` lấy từ [`reference/rbac.md`](./reference/rbac.md#5-frontend--ẩnhiện-ui-theo-role).

## Data fetching — TanStack Query pattern chuẩn

```tsx
// Query — polling 10s cho data cần real-time (transactions, dashboard)
const { data, isLoading, error } = useQuery({
  queryKey: ['transactions', filters],
  queryFn: () => api.get('/transactions', { params: filters }),
  refetchInterval: 10_000,
});

// Mutation — luôn invalidate query liên quan + toast
const { mutate: confirm, isPending } = useMutation({
  mutationFn: (id: string) => api.post(`/review/${id}/confirm`),
  onSuccess: () => {
    toast.success('Đã xác nhận ghép hóa đơn');
    queryClient.invalidateQueries({ queryKey: ['review'] });
    queryClient.invalidateQueries({ queryKey: ['transactions'] });
  },
  onError: () => toast.error('Có lỗi xảy ra, vui lòng thử lại'),
});
```

## Component dùng chung bắt buộc tái sử dụng (không viết lại)

Định nghĩa mẫu đầy đủ tại `reference/ui-design.md` mục "Shared Components": `formatVND`, `StatusBadge`, `ConfidenceBadge`, `TableSkeleton`, `EmptyState`. Mọi màn hình hiển thị tiền/trạng thái/confidence phải dùng lại các component này, không tự format riêng lẻ từng nơi.

## Convention màu theo confidence/status (đồng bộ toàn app)

Dùng semantic tokens — success/matched = `text-primary` hoặc `bg-primary/10`, không hard-code hex ngoài design system.

```
Confidence ≥ 95%   → Badge variant="success" hoặc text-primary
Confidence 50–95%  → Badge variant="warning" (vàng)
Confidence < 50%    → Badge variant="destructive" (đỏ)

Status Matched  → primary | Status Review → vàng
Status Pending  → muted/xám | Status Skipped → outline
```

Nguồn sự thật palette brand: mục **Brand palette** trong `reference/ui-design.md` và bảng token ở đầu file này.

## Types dùng chung với backend

Import enum/type từ `@paypilot/shared-types` thay vì tự định nghĩa lại (vd: `Role`, `TransactionStatus`, `InvoiceStatus`, `SubscriptionPlan`). Nếu BE trả thêm field mới, cập nhật type ở `packages/shared-types/src/index.ts` trước, rồi dùng lại ở FE — không duplicate định nghĩa.

## States bắt buộc cho mọi màn hình danh sách/bảng

Loading (Skeleton) / Empty (icon + message tiếng Việt rõ ràng) / Error (toast + nút retry) — xem pattern mẫu trong `reference/ui-design.md` cuối mỗi mục màn hình.

## Setup ShadCN/UI

Thêm component mới **luôn qua CLI** (không copy HTML từ trang khác rồi tự style):

```bash
cd apps/frontend
pnpm dlx shadcn@latest add button card badge table input label select dialog sheet separator skeleton switch slider tabs progress alert-dialog collapsible
```

Cấu hình: `apps/frontend/components.json` (style `new-york`). Alias `@/` → `apps/frontend/src`. **Không sửa logic bên trong file `components/ui/*.tsx`** trừ khi sync lại từ ShadCN — chỉ compose từ bên ngoài. Docs: [https://ui.shadcn.com/docs/components](https://ui.shadcn.com/docs/components).
