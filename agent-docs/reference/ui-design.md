# 🎨 X-Cash AI — UI Design Specification

> Tài liệu này mô tả chi tiết từng màn hình để AI generate code React (JSX + Tailwind CSS + ShadCN/UI + TanStack Query).

---

## ⚠️ Hai layout hoàn toàn tách biệt

Hệ thống có **2 layout độc lập**, không dùng chung component Sidebar:

| | Tenant Layout (mục 1–8) | Partner Layout (mục 9) |
|---|---|---|
| Dùng cho role | Admin / Accountant / Viewer | Cas Partner |
| Route | `/dashboard`, `/transactions`... | `/partner` |
| Sidebar | Có, 8 mục nghiệp vụ | Không, chỉ top nav |
| Dữ liệu thấy được | Chỉ trong 1 tenant | Tổng hợp toàn bộ tenant |

Routing phải check role ngay từ entry point — Admin/Accountant/Viewer không bao giờ thấy `/partner`, và Cas Partner không bao giờ thấy 8 màn hình nghiệp vụ ở dưới.

---

## 📐 Global Layout (Tenant — mục 1–8)

Toàn bộ app dùng layout 2 cột: **Sidebar cố định bên trái + Main content bên phải**.

```
┌─────────────────────────────────────────────────────┐
│  Sidebar (w-64, fixed)  │  Main Content (flex-1)    │
│                         │                            │
│  Logo X-Cash AI         │  Header (sticky top)      │

│                         │  ├── Page title            │
│  Navigation:            │  └── Action buttons        │
│  • Dashboard            │                            │
│  • Transactions         │  Content Area              │
│  • Human Review 🔴3     │  (overflow-y-auto)         │
│  • Báo cáo              │                            │
│  • Danh mục TK          │                            │
│  • AI Copilot           │                            │
│  • Settings             │                            │
│                         │                            │
│  User info (bottom)     │                            │
└─────────────────────────────────────────────────────┘
```

### Tech stack áp dụng

```
- Layout: Tailwind CSS (flex, grid) — layout shell only; UI primitives = ShadCN
- Components: [ShadCN/UI](https://ui.shadcn.com/docs/components) (`@/components/ui`) — Button, Card, Table, Badge, Input, Label, Dialog, Sheet...
  → Thêm thiếu gì bằng `pnpm dlx shadcn@latest add <tên>` trong `apps/frontend` — **không** tự viết button/table/card HTML thuần; tra docs component trước khi dùng
- Data fetching: TanStack Query (useQuery, useMutation)
- Charts: Recharts (LineChart, BarChart, PieChart)
- Icons: Lucide React
- Notifications: Sonner (toast)
- Real-time: polling mỗi 10 giây hoặc WebSocket
```

### Brand palette (Casso / payOS — đã áp dụng Sprint 1 tuần 2)

Tham chiếu trực tiếp [`casso.vn`](https://casso.vn) và [`payos.vn`](https://payos.vn). Token implement tại `apps/frontend/src/index.css`; chi tiết convention tại [`03-frontend-conventions.md`](../03-frontend-conventions.md).

| Token | Hex | Dùng cho |
|---|---|---|
| Primary (Finverse Green) | `#16AB64` | CTA, link, nav active, số tiền, icon brand |
| Background | `#FFFFFF` | Nền trang, sidebar, header |
| Surface | `#F8FAFB` | Vùng content dashboard/list |
| Text | `#1E2022` | Tiêu đề, body |
| Tint | `primary/10` | Nav selected, outline button, hero gradient |

**Quy tắc:**
- Nền **trắng sạch** + accent xanh — không phủ toàn trang bằng gradient xanh đậm.
- Nút chính: `Button` variant default (`bg-primary text-primary-foreground`).
- Nav active: `bg-primary/10 text-primary font-medium`.
- Auth/hero: gradient `from-primary/10` phía trên, card trắng giữa.
- Dark mode: giữ undertone xanh qua CSS variables `.dark` — dùng `ThemeToggle`, không hard-code màu.

**Responsive (breakpoint `lg` = 1024px):**
- Desktop: sidebar cố định `w-64`, header trắng.
- Mobile: top bar + drawer sidebar; bảng → card list dưới `md`.

### Color convention (confidence / status)

```
- Confidence ≥ 85%: Badge / text `primary` hoặc variant success (xanh #16AB64) — Auto Classify
- Confidence 50–85%: Badge variant="warning" (vàng) — Human Review
- Confidence < 50%: Badge variant="destructive" (đỏ) — Cần xem xét kỹ

- Status Classified: primary/xanh | Status Review: vàng
- Status Pending: xám | Status Skipped: outline
```

### ShadCN components dùng xuyên suốt

> Catalog đầy đủ + API từng component: [ui.shadcn.com/docs/components](https://ui.shadcn.com/docs/components)

```jsx
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet"
import { Separator } from "@/components/ui/separator"
import { Skeleton } from "@/components/ui/skeleton"
import { toast } from "sonner"
```

---

## 1. 🏠 Dashboard

**Route:** `/dashboard`
**API calls:**
- `GET /api/v1/dashboard/overview`
- `GET /api/v1/dashboard/recent-transactions`
- `GET /api/v1/analytics/revenue?period=month`

### Layout

```
┌─────────────────────────────────────────────────────┐
│ Header: "Dashboard"                                  │
├─────────────────────────────────────────────────────┤
│ Stats Row (grid grid-cols-4 gap-4)                   │
│ ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐│
│ │Doanh thu │ │Giao dịch │ │Chờ review│ │AI Match  ││
│ │hôm nay   │ │chưa xử lý│ │          │ │accuracy  ││
│ │125.5M đ  │ │  12      │ │  3 🔴    │ │  94.2%   ││
│ │↑12% vs   │ │          │ │          │ │          ││
│ │hôm qua   │ │          │ │          │ │          ││
│ └──────────┘ └──────────┘ └──────────┘ └──────────┘│
├─────────────────────────────────────────────────────┤
│ Row 2 (grid grid-cols-3 gap-4)                       │
│ ┌────────────────────────┐ ┌──────────────────────┐ │
│ │ Revenue Chart          │ │ Recent Transactions  │ │
│ │ (LineChart, Recharts)  │ │ (feed real-time)     │ │
│ │ col-span-2             │ │ col-span-1           │ │
│ │                        │ │ TXN_001 | 350k | ✅  │ │
│ │                        │ │ TXN_002 | 50M  | 🚨  │ │
│ │                        │ │ TXN_003 | 1.2M | ⚠️  │ │
│ │                        │ │ [Xem tất cả →]       │ │
│ └────────────────────────┘ └──────────────────────┘ │
├─────────────────────────────────────────────────────┤
│ Row 3 (grid grid-cols-2 gap-4)                       │
│ ┌──────────────────────┐ ┌────────────────────────┐ │
│ │ Công nợ chưa thu     │ │ AI Matching Stats      │ │
│ │ Tổng: 45,200,000đ    │ │ Auto: 87% ████████░░  │ │
│ │ Quá hạn: 12,400,000đ │ │ Review: 9% █░░░░░░░░  │ │
│ │ [Xem chi tiết →]     │ │ Skip: 4%  ░░░░░░░░░░  │ │
│ └──────────────────────┘ └────────────────────────┘ │
└─────────────────────────────────────────────────────┘
```

### Stats Card component

```jsx
// Mỗi stat card dùng ShadCN Card
<Card>
  <CardHeader className="flex flex-row items-center justify-between pb-2">
    <CardTitle className="text-sm font-medium text-muted-foreground">
      Doanh thu hôm nay
    </CardTitle>
    <TrendingUp className="h-4 w-4 text-muted-foreground" />
  </CardHeader>
  <CardContent>
    <div className="text-2xl font-bold">125,500,000đ</div>
    <p className="text-xs text-green-600 mt-1">↑ 12% so với hôm qua</p>
  </CardContent>
</Card>
```

### Recent Transactions feed

```jsx
// Mỗi item trong feed
<div className="flex items-center justify-between py-2 border-b last:border-0">
  <div className="flex flex-col gap-0.5">
    <span className="text-sm font-medium truncate max-w-[180px]">
      TT HD1025 Nguyen Van A
    </span>
    <span className="text-xs text-muted-foreground">09:30 • Vietcombank</span>
  </div>
  <div className="flex items-center gap-2">
    <span className="text-sm font-semibold">350,000đ</span>
    <Badge variant="success">Matched</Badge>
  </div>
</div>
```

### States

- **Loading:** Skeleton cho stats cards và chart
- **Empty:** "Chưa có giao dịch nào hôm nay"
- **Error:** Toast error + retry button

---

## 2. 💳 Transactions

**Route:** `/transactions`
**API calls:**
- `GET /api/v1/transactions?status=&source=&from_date=&to_date=&page=&limit=20`
- `GET /api/v1/transactions/:id` (khi click xem chi tiết)
- `GET /api/v1/transactions/:id/matches` (trong detail panel)
- `GET /api/v1/transactions/:id/explanation` (trong detail panel)

### Layout

```
┌─────────────────────────────────────────────────────┐
│ Header: "Giao dịch"                                  │
├─────────────────────────────────────────────────────┤
│ Filter Bar                                           │
│ [Search nội dung...] [Status ▼] [Nguồn ▼] [Date 📅]│
├─────────────────────────────────────────────────────┤
│ Table (full width)                                   │
│ Thời gian | Số tiền | Nội dung | Khách | Hóa đơn | Confidence | Status │
│ ──────────────────────────────────────────────────  │
│ 09:30      │ 350,000đ│ TT HD.. │ NVA   │ #1025   │ 96% 🟢     │Matched │
│ 02:47      │ 50M đ   │ CK theo │ ?     │ —       │ 94% 🟡     │Review  │
│ 23:10      │ 1.2M đ  │ CK thg1 │ TTB   │ #1031   │ 40% 🔴     │Review  │
├─────────────────────────────────────────────────────┤
│ Pagination: [← Prev] [1] [2] [3] [Next →]          │
└─────────────────────────────────────────────────────┘
```

### Detail Panel (Sheet từ phải)

Khi click vào 1 row → mở ShadCN `Sheet` từ phải (width 480px):

```
┌────────────────────────────────┐
│ Chi tiết giao dịch        ✕   │
├────────────────────────────────┤
│ TXN_001                        │
│ 350,000đ • 09:30 15/01/2024   │
│ Vietcombank                    │
│                                │
│ Nội dung gốc:                  │
│ "TT HD1025 Nguyen Van A"       │
│                                │
│ ── AI Suggestion ──────────── │
│                                │
│ 🟢 Hóa đơn #1025 — 96%        │
│ Nguyễn Văn A • 350,000đ       │
│                                │
│ 🟡 Hóa đơn #1018 — 45%        │
│ Nguyễn Văn An • 350,000đ      │
│                                │
│ ── AI Explanation ─────────── │
│                                │
│ "Giao dịch được ghép với HD    │
│ #1025 vì: (1) Mã hóa đơn      │
│ '1025' khớp trực tiếp, (2) Số  │
│ tiền khớp chính xác..."        │
│                                │
│ [✅ Xác nhận] [🔄 Đổi HĐ] [⏭]│
└────────────────────────────────┘
```

### Table row component

```jsx
<TableRow
  className="cursor-pointer hover:bg-muted/50"
  onClick={() => setSelectedTxn(txn)}
>
  <TableCell className="text-sm text-muted-foreground">
    {format(txn.transactionDate, "HH:mm dd/MM")}
  </TableCell>
  <TableCell className="font-semibold">
    {formatVND(txn.amount)}
  </TableCell>
  <TableCell className="max-w-[200px] truncate text-sm">
    {txn.content}
  </TableCell>
  <TableCell>{txn.customerName ?? "—"}</TableCell>
  <TableCell>{txn.invoiceCode ?? "—"}</TableCell>
  <TableCell>
    <ConfidenceBadge score={txn.confidenceScore} />
  </TableCell>
  <TableCell>
    <StatusBadge status={txn.status} />
  </TableCell>
</TableRow>
```

### ConfidenceBadge component

```jsx
function ConfidenceBadge({ score }) {
  if (score >= 95) return <Badge variant="success">{score}%</Badge>
  if (score >= 50) return <Badge variant="warning">{score}%</Badge>
  return <Badge variant="destructive">{score}%</Badge>
}
```

### States

- **Loading:** Skeleton table (5 rows)
- **Empty:** Icon + "Không tìm thấy giao dịch nào"
- **Filter active:** Hiển thị chip filter đang áp dụng, có nút clear

---

## 3. 🔍 Human Review Queue

**Route:** `/review`
**API calls:**
- `GET /api/v1/review/queue`
- `POST /api/v1/review/:id/confirm`
- `POST /api/v1/review/:id/reassign` body: `{ invoice_id }`
- `POST /api/v1/review/:id/skip`

### Layout

```
┌─────────────────────────────────────────────────────┐
│ Header: "Hàng chờ xét duyệt"   Badge: "3 chờ xử lý"│
├─────────────────────────────────────────────────────┤
│ Card list (flex flex-col gap-4)                      │
│                                                      │
│ ┌──────────────────────────────────────────────────┐ │
│ │ TXN_001 • 09:30 • Vietcombank          🟡 72%   │ │
│ │ 350,000đ                                         │ │
│ │ "tien hang thang 1"                              │ │
│ │                                                  │ │
│ │ AI gợi ý: Hóa đơn #1025 — Nguyễn Văn A         │ │
│ │ "Học phí tháng 1 • 350,000đ • HSD: 31/01"      │ │
│ │                                                  │ │
│ │ AI Explanation (collapsible):                    │ │
│ │ "Ghép dựa trên: số tiền khớp, khách hàng..."   │ │
│ │                                                  │ │
│ │ [✅ Xác nhận ghép] [🔄 Chọn HĐ khác] [⏭ Bỏ qua]│ │
│ └──────────────────────────────────────────────────┘ │
│                                                      │
│ ┌──────────────────────────────────────────────────┐ │
│ │ TXN_002 • 23:10 • Techcombank          🟡 68%   │ │
│ │ ...                                              │ │
│ └──────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────┘
```

### Review Card component

```jsx
<Card className="border-l-4 border-l-yellow-400">
  <CardContent className="pt-4">
    {/* Transaction info */}
    <div className="flex justify-between items-start mb-3">
      <div>
        <p className="font-semibold">{formatVND(txn.amount)}</p>
        <p className="text-sm text-muted-foreground">{txn.content}</p>
        <p className="text-xs text-muted-foreground mt-1">
          {format(txn.date, "HH:mm dd/MM")} • {txn.bank}
        </p>
      </div>
      <ConfidenceBadge score={txn.confidenceScore} />
    </div>

    <Separator className="my-3" />

    {/* AI suggestion */}
    <div className="bg-muted/50 rounded-md p-3 mb-3">
      <p className="text-xs text-muted-foreground mb-1">AI gợi ý</p>
      <p className="font-medium text-sm">Hóa đơn #{txn.suggestedInvoice.code}</p>
      <p className="text-sm text-muted-foreground">
        {txn.suggestedInvoice.customerName} • {formatVND(txn.suggestedInvoice.amount)}
      </p>
    </div>

    {/* AI Explanation collapsible */}
    <Collapsible>
      <CollapsibleTrigger className="text-xs text-blue-600 hover:underline">
        Xem lý do AI ghép ▾
      </CollapsibleTrigger>
      <CollapsibleContent>
        <p className="text-xs text-muted-foreground mt-1 p-2 bg-blue-50 rounded">
          {txn.explanation}
        </p>
      </CollapsibleContent>
    </Collapsible>

    {/* Action buttons */}
    <div className="flex gap-2 mt-4">
      <Button
        size="sm"
        className="flex-1"
        onClick={() => confirm(txn.id)}
        disabled={isConfirming}
      >
        ✅ Xác nhận ghép
      </Button>
      <Button
        size="sm"
        variant="outline"
        onClick={() => setReassignOpen(true)}
      >
        🔄 Chọn HĐ khác
      </Button>
      <Button
        size="sm"
        variant="ghost"
        onClick={() => skip(txn.id)}
      >
        ⏭
      </Button>
    </div>
  </CardContent>
</Card>
```

### Reassign Dialog

Khi click "Chọn HĐ khác" → mở Dialog tìm kiếm hóa đơn:

```jsx
<Dialog open={reassignOpen} onOpenChange={setReassignOpen}>
  <DialogContent>
    <DialogHeader>
      <DialogTitle>Chọn hóa đơn để ghép</DialogTitle>
    </DialogHeader>
    <Input placeholder="Tìm theo mã HĐ, khách hàng..." />
    {/* List invoices */}
    {invoices.map(inv => (
      <div
        key={inv.id}
        className="flex justify-between p-3 rounded hover:bg-muted cursor-pointer"
        onClick={() => reassign(txn.id, inv.id)}
      >
        <div>
          <p className="font-medium">#{inv.code}</p>
          <p className="text-sm text-muted-foreground">{inv.customerName}</p>
        </div>
        <p className="font-semibold">{formatVND(inv.amount)}</p>
      </div>
    ))}
  </DialogContent>
</Dialog>
```

### States

- **Empty:** Illustration + "Không có giao dịch nào cần xem xét 🎉"
- **Loading:** Skeleton cards
- **After action:** Toast success + card tự disappear (animate-out)

---

## 4. 📄 Invoices

**Route:** `/invoices`
**API calls:**
- `GET /api/v1/invoices?status=&customer_id=&page=&limit=20`
- `POST /api/v1/invoices`
- `POST /api/v1/invoices/:id/payment-link`
- `POST /api/v1/invoices/import`

### Layout

```
┌─────────────────────────────────────────────────────┐
│ Header: "Hóa đơn"    [+ Tạo hóa đơn] [↑ Import]   │
├─────────────────────────────────────────────────────┤
│ Filter: [Search...] [Status ▼] [Khách hàng ▼] [Date]│
├─────────────────────────────────────────────────────┤
│ Table                                                │
│ Mã HĐ | Khách hàng | Số tiền | Đã TT | Status | HSD│
│ #1025  │ Nguyễn Văn A│ 350,000 │350,000│ Paid 🟢 │31/1│
│ #1026  │ Trần Thị B  │1,200,000│600,000│Partial🟡│28/1│
│ #1027  │ Lê Văn C   │ 800,000 │  0    │Unpaid 🔴│15/1│
├─────────────────────────────────────────────────────┤
│ Pagination                                           │
└─────────────────────────────────────────────────────┘
```

### Tạo hóa đơn Dialog

```jsx
<Dialog>
  <DialogContent className="sm:max-w-[480px]">
    <DialogHeader>
      <DialogTitle>Tạo hóa đơn mới</DialogTitle>
    </DialogHeader>
    <div className="grid gap-4 py-4">
      {/* Customer select */}
      <div className="grid gap-2">
        <Label>Khách hàng</Label>
        <Select>
          <SelectTrigger>
            <SelectValue placeholder="Chọn khách hàng..." />
          </SelectTrigger>
          <SelectContent>
            {customers.map(c => (
              <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Amount */}
      <div className="grid gap-2">
        <Label>Số tiền (VNĐ)</Label>
        <Input type="number" placeholder="350000" />
      </div>

      {/* Description */}
      <div className="grid gap-2">
        <Label>Mô tả</Label>
        <Input placeholder="Học phí tháng 1/2024" />
      </div>

      {/* Due date */}
      <div className="grid gap-2">
        <Label>Hạn thanh toán</Label>
        <Input type="date" />
      </div>
    </div>
    <div className="flex justify-end gap-2">
      <Button variant="outline">Hủy</Button>
      <Button>Tạo hóa đơn</Button>
    </div>
  </DialogContent>
</Dialog>
```

### Invoice Detail Sheet

Click vào row → Sheet từ phải:

```
┌────────────────────────────┐
│ Hóa đơn #1025         ✕  │
├────────────────────────────┤
│ Nguyễn Văn A               │
│ Học phí tháng 1/2024       │
│ Hạn: 31/01/2024            │
│                             │
│ Số tiền:    350,000đ       │
│ Đã thanh toán: 350,000đ    │
│ Còn lại:    0đ             │
│ Trạng thái: ✅ Paid         │
│                             │
│ ── Lịch sử thanh toán ──  │
│ 09:30 15/01 • 350,000đ    │
│ TXN_001 • Auto matched     │
│                             │
│ [🔲 Xem QR thanh toán]     │
│ [✏️ Chỉnh sửa]             │
└────────────────────────────┘
```

### Import Dialog

```jsx
// Drag & drop upload
<div className="border-2 border-dashed rounded-lg p-8 text-center">
  <Upload className="mx-auto h-8 w-8 text-muted-foreground mb-2" />
  <p className="text-sm">Kéo thả file Excel/CSV vào đây</p>
  <p className="text-xs text-muted-foreground">hoặc</p>
  <Button variant="outline" size="sm">Chọn file</Button>
</div>
// Sau khi upload → preview table trước khi confirm import
```

---

## 5. 👥 Customers

**Route:** `/customers`
**API calls:**
- `GET /api/v1/customers?search=&page=&limit=20`
- `POST /api/v1/customers`
- `GET /api/v1/customers/:id/invoices`
- `GET /api/v1/customers/:id/transactions`
- `POST /api/v1/customers/import`

### Layout

```
┌─────────────────────────────────────────────────────┐
│ Header: "Khách hàng"  [+ Thêm khách hàng] [↑ Import]│
├─────────────────────────────────────────────────────┤
│ Search: [🔍 Tìm theo tên, SĐT, email...]            │
├─────────────────────────────────────────────────────┤
│ Table                                                │
│ Tên | SĐT | Email | Số TK | Công nợ | Lần TT cuối  │
│ NVA │0901…│a@…    │1234…  │ 0đ      │ 15/01        │
│ TTB │0902…│b@…    │5678…  │1,200,000│ 10/01        │
└─────────────────────────────────────────────────────┘
```

### Customer Detail Sheet

Click vào row → Sheet từ phải với tabs:

```jsx
<Sheet>
  <SheetContent className="w-[500px] sm:max-w-[500px]">
    <SheetHeader>
      <SheetTitle>Nguyễn Văn A</SheetTitle>
    </SheetHeader>

    {/* Info */}
    <div className="grid grid-cols-2 gap-3 mt-4">
      <div><p className="text-xs text-muted-foreground">SĐT</p><p>0901234567</p></div>
      <div><p className="text-xs text-muted-foreground">Email</p><p>a@gmail.com</p></div>
      <div><p className="text-xs text-muted-foreground">Số TK</p><p>1234567890</p></div>
      <div><p className="text-xs text-muted-foreground">Ngân hàng</p><p>Vietcombank</p></div>
    </div>

    <Separator className="my-4" />

    {/* Tabs: Hóa đơn | Giao dịch */}
    <Tabs defaultValue="invoices">
      <TabsList>
        <TabsTrigger value="invoices">Hóa đơn</TabsTrigger>
        <TabsTrigger value="transactions">Giao dịch</TabsTrigger>
      </TabsList>
      <TabsContent value="invoices">
        {/* List invoices của khách này */}
      </TabsContent>
      <TabsContent value="transactions">
        {/* List transactions của khách này */}
      </TabsContent>
    </Tabs>
  </SheetContent>
</Sheet>
```

---

## 6. 📊 Analytics

**Route:** `/analytics`
**API calls:**
- `GET /api/v1/analytics/revenue?period=month`
- `GET /api/v1/analytics/cash-flow`
- `GET /api/v1/analytics/pending`
- `GET /api/v1/analytics/top-customers?limit=5`
- `GET /api/v1/analytics/matching-stats`

### Layout

```
┌─────────────────────────────────────────────────────┐
│ Header: "Báo cáo"   [Period: Tháng này ▼] [↓ Export]│
├─────────────────────────────────────────────────────┤
│ Stats Row (grid grid-cols-3 gap-4)                   │
│ ┌──────────┐ ┌──────────┐ ┌──────────┐             │
│ │Tổng DT   │ │Công nợ   │ │AI Match  │             │
│ │125.5M đ  │ │45.2M đ   │ │Rate: 94% │             │
│ └──────────┘ └──────────┘ └──────────┘             │
├─────────────────────────────────────────────────────┤
│ Row 2 (grid grid-cols-2 gap-4)                       │
│ ┌──────────────────────┐ ┌────────────────────────┐ │
│ │ Revenue Chart        │ │ Cash Flow Chart        │ │
│ │ LineChart (Recharts) │ │ BarChart (Recharts)    │ │
│ └──────────────────────┘ └────────────────────────┘ │
├─────────────────────────────────────────────────────┤
│ Row 3 (grid grid-cols-2 gap-4)                       │
│ ┌──────────────────────┐ ┌────────────────────────┐ │
│ │ Top 5 Khách hàng     │ │ AI Matching Stats      │ │
│ │ 1. NVA — 5.2M        │ │ PieChart               │ │
│ │ 2. TTB — 3.8M        │ │ Auto 87% / Review 9%  │ │
│ │ 3. LVC — 2.1M        │ │ / Skip 4%              │ │
│ └──────────────────────┘ └────────────────────────┘ │
└─────────────────────────────────────────────────────┘
```

### Revenue Chart

```jsx
<ResponsiveContainer width="100%" height={300}>
  <LineChart data={revenueData}>
    <CartesianGrid strokeDasharray="3 3" />
    <XAxis dataKey="date" />
    <YAxis tickFormatter={(v) => `${(v/1000000).toFixed(0)}M`} />
    <Tooltip formatter={(v) => formatVND(v)} />
    <Line
      type="monotone"
      dataKey="amount"
      stroke="#2563eb"
      strokeWidth={2}
      dot={false}
    />
  </LineChart>
</ResponsiveContainer>
```

---

## 7. 💬 AI Copilot

**Route:** `/copilot`
**API calls:**
- `POST /api/v1/ai/copilot` body: `{ message, history[] }`

### Layout

```
┌─────────────────────────────────────────────────────┐
│ Header: "AI Copilot"                                 │
├─────────────────────────────────────────────────────┤
│                                                      │
│              Chat Area (flex-1, overflow-y-auto)     │
│                                                      │
│  🤖 Xin chào! Tôi là AI Copilot của X-Cash AI.       │
│     Bạn có thể hỏi tôi về doanh thu, công nợ,       │
│     hóa đơn hoặc khách hàng.                        │
│                                                      │
│  👤 Doanh thu tháng này bao nhiêu?                  │
│                                         (bubble phải)│
│                                                      │
│  🤖 Tháng 1/2024, tổng doanh thu đạt               │
│     125,500,000đ, tăng 12% so với tháng trước.     │
│     (bubble trái)                                    │
│                                                      │
├─────────────────────────────────────────────────────┤
│ Suggested questions (chips, scroll ngang):           │
│ [Doanh thu hôm nay?] [HĐ chưa TT?] [Công nợ quá hạn│
├─────────────────────────────────────────────────────┤
│ Input: [Nhập câu hỏi...              ] [Gửi ↵]     │
└─────────────────────────────────────────────────────┘
```

### Chat bubble component

```jsx
// AI message (trái)
<div className="flex gap-3 max-w-[80%]">
  <div className="w-8 h-8 rounded-full bg-blue-600 flex items-center justify-center flex-shrink-0">
    <Bot className="w-4 h-4 text-white" />
  </div>
  <div className="bg-muted rounded-2xl rounded-tl-none px-4 py-3">
    <p className="text-sm whitespace-pre-wrap">{message.content}</p>
  </div>
</div>

// User message (phải)
<div className="flex gap-3 max-w-[80%] ml-auto flex-row-reverse">
  <div className="w-8 h-8 rounded-full bg-gray-200 flex items-center justify-center flex-shrink-0">
    <User className="w-4 h-4" />
  </div>
  <div className="bg-blue-600 text-white rounded-2xl rounded-tr-none px-4 py-3">
    <p className="text-sm">{message.content}</p>
  </div>
</div>
```

### Loading state (AI đang trả lời)

```jsx
// Typing indicator
<div className="flex gap-3 max-w-[80%]">
  <div className="w-8 h-8 rounded-full bg-blue-600 flex items-center justify-center">
    <Bot className="w-4 h-4 text-white" />
  </div>
  <div className="bg-muted rounded-2xl rounded-tl-none px-4 py-3">
    <div className="flex gap-1">
      <span className="w-2 h-2 bg-gray-400 rounded-full animate-bounce [animation-delay:0ms]" />
      <span className="w-2 h-2 bg-gray-400 rounded-full animate-bounce [animation-delay:150ms]" />
      <span className="w-2 h-2 bg-gray-400 rounded-full animate-bounce [animation-delay:300ms]" />
    </div>
  </div>
</div>
```

### Suggested questions

```jsx
<div className="flex gap-2 overflow-x-auto pb-2">
  {suggestions.map(q => (
    <button
      key={q}
      onClick={() => sendMessage(q)}
      className="whitespace-nowrap text-xs px-3 py-1.5 rounded-full border hover:bg-muted transition-colors"
    >
      {q}
    </button>
  ))}
</div>
```

---

## 8. ⚙️ Settings

**Route:** `/settings`
**API calls:**
- `GET /api/v1/settings/banking`
- `POST /api/v1/onboarding/banking/grant-token`
- `POST /api/v1/onboarding/banking/callback`
- `GET /api/v1/billing/current-plan`
- `POST /api/v1/billing/upgrade`
- `GET /api/v1/billing/invoices`
- `GET/PUT /api/v1/settings/notifications`
- `GET/PUT /api/v1/settings/matching-threshold`
- `GET/POST/DELETE /api/v1/team/members`
- `GET/POST/DELETE /api/v1/ai/knowledge-base`

### Layout

Dùng tabs layout ngang:

```
┌─────────────────────────────────────────────────────┐
│ Header: "Cài đặt"                                    │
├─────────────────────────────────────────────────────┤
│ Tabs: [Banking] [Billing] [Notification] [Team] [AI KB]│
├─────────────────────────────────────────────────────┤
│ Tab Content (Card)                                   │
└─────────────────────────────────────────────────────┘
```

### Tab Banking

> Webhook (nhận giao dịch ngân hàng) được cấu hình **1 lần duy nhất ở cấp App** trên Cas Developer Console — không có khái niệm Webhook URL riêng cho từng doanh nghiệp, nên tab này **không hiển thị** thông tin webhook. Tab chỉ có 1 việc: cho phép doanh nghiệp tự liên kết tài khoản ngân hàng thật qua **Cas Link** (mở trong popup/iframe).

```jsx
<Card>
  <CardHeader>
    <CardTitle>Tài khoản ngân hàng</CardTitle>
    <p className="text-sm text-muted-foreground">
      Liên kết tài khoản ngân hàng để X-Cash AI tự động nhận và phân loại giao dịch
    </p>
  </CardHeader>
  <CardContent>
    {/* Connected bank accounts via Cas Link */}
    <div className="flex items-center justify-between mb-3">
      <p className="text-sm font-medium">Tài khoản ngân hàng đã liên kết</p>
      <Button size="sm" onClick={openCasLink}>
        + Liên kết tài khoản mới
      </Button>
    </div>

    {accounts.length === 0 ? (
      <p className="text-sm text-muted-foreground py-4 text-center">
        Chưa liên kết tài khoản ngân hàng nào. Bấm "Liên kết tài khoản mới" để bắt đầu.
      </p>
    ) : (
      accounts.map(acc => (
        <div key={acc.id} className="flex items-center justify-between py-2 border-b last:border-0">
          <div>
            <p className="text-sm font-medium">{acc.bankName}</p>
            <p className="text-xs text-muted-foreground">{acc.accountNumber}</p>
          </div>
          <Badge variant="success">Đã liên kết</Badge>
        </div>
      ))
    )}
  </CardContent>
</Card>
```

```jsx
// openCasLink — mở Cas Link để liên kết ngân hàng
async function openCasLink() {
  // 1. Backend tạo grantToken
  const { grantToken, redirectUri, linkBaseUrl } = await api.post("/onboarding/banking/grant-token")

  // 2. Mở Cas Link trong popup (sandbox: dev.link.bankhub.dev; production: link.bankhub.dev)
  const casLinkUrl = `${linkBaseUrl}?grantToken=${grantToken}&redirectUri=${encodeURIComponent(redirectUri)}&iframe=false`
  const popup = window.open(casLinkUrl, "cas-link", "width=480,height=640")

  // 3. Lắng nghe message từ popup (success / cancel / error)
  window.addEventListener("message", async (event) => {
    if (event.data?.type === "CAS_LINK_SUCCESS") {
      await api.post("/onboarding/banking/callback", { publicToken: event.data.publicToken })
      popup.close()
      queryClient.invalidateQueries({ queryKey: ["banking-accounts"] })
      toast.success("Liên kết ngân hàng thành công!")
    }
    if (event.data?.type === "CAS_LINK_CANCELLED") {
      popup.close()
      toast.error("Liên kết ngân hàng thất bại. Vui lòng thử lại.")
    }
    if (event.data?.type === "CAS_LINK_ERROR") {
      popup.close()
      toast.error(event.data.message ?? "Liên kết ngân hàng thất bại. Vui lòng thử lại.")
    }
  })
}
```

### Tab Notification

```jsx
<Card>
  <CardContent className="grid gap-6 pt-6">
    {/* Email */}
    <div className="flex items-center justify-between">
      <div>
        <p className="font-medium">Email</p>
        <p className="text-sm text-muted-foreground">Nhận thông báo qua email</p>
      </div>
      <Switch checked={emailEnabled} onCheckedChange={setEmailEnabled} />
    </div>
    {emailEnabled && <Input placeholder="email@company.com" />}

    <Separator />

    {/* Slack */}
    <div className="flex items-center justify-between">
      <div>
        <p className="font-medium">Slack</p>
        <p className="text-sm text-muted-foreground">Webhook URL</p>
      </div>
      <Switch checked={slackEnabled} onCheckedChange={setSlackEnabled} />
    </div>
    {slackEnabled && <Input placeholder="https://hooks.slack.com/..." />}
  </CardContent>
</Card>
```

### Tab Billing

> Hiển thị gói hiện tại + usage, cho phép nâng cấp qua PayOS. Lưu ý: đây là PayOS account của chính X-Cash AI, dùng để thu phí dịch vụ từ doanh nghiệp — chỉ Admin xem/thao tác được (xem `rbac.md`).

```jsx
<Card>
  <CardHeader>
    <CardTitle>Gói dịch vụ</CardTitle>
  </CardHeader>
  <CardContent>
    {/* Current plan + usage */}
    <div className="flex items-center justify-between mb-2">
      <Badge variant={plan.name === "free" ? "secondary" : "default"}>
        {plan.name.toUpperCase()}
      </Badge>
      <p className="text-sm text-muted-foreground">
        {plan.transactionUsed} / {plan.transactionQuota} giao dịch tháng này
      </p>
    </div>
    <Progress
      value={(plan.transactionUsed / plan.transactionQuota) * 100}
      className={plan.transactionUsed >= plan.transactionQuota ? "bg-red-100" : ""}
    />

    {plan.transactionUsed >= plan.transactionQuota && (
      <p className="text-xs text-destructive mt-2">
        Đã hết quota tháng này. Nâng cấp gói để tiếp tục xử lý giao dịch.
      </p>
    )}

    <Separator className="my-4" />

    {/* Plan comparison + upgrade buttons */}
    <div className="grid grid-cols-3 gap-3">
      {plans.filter(p => p.id !== plan.id).map(p => (
        <div key={p.id} className="border rounded-lg p-3 text-center">
          <p className="font-semibold">{p.name}</p>
          <p className="text-lg font-bold mt-1">{formatVND(p.pricePerMonth)}</p>
          <p className="text-xs text-muted-foreground mb-3">{p.transactionQuota} giao dịch</p>
          <Button size="sm" className="w-full" onClick={() => openUpgradeDialog(p)}>
            Nâng cấp
          </Button>
        </div>
      ))}
    </div>
  </CardContent>
</Card>
```

### Upgrade Dialog — Thanh toán qua PayOS

```jsx
<Dialog open={upgradeOpen} onOpenChange={setUpgradeOpen}>
  <DialogContent>
    <DialogHeader>
      <DialogTitle>Nâng cấp lên {targetPlan.name}</DialogTitle>
    </DialogHeader>

    {!paymentOrder ? (
      <Button onClick={createUpgradeOrder} disabled={isCreating}>
        Tạo mã thanh toán — {formatVND(targetPlan.pricePerMonth)}
      </Button>
    ) : (
      <div className="flex flex-col items-center gap-3">
        <img src={paymentOrder.qrCodeUrl} alt="QR thanh toán PayOS" className="w-48 h-48" />
        <p className="text-sm text-muted-foreground">
          Quét QR hoặc <a href={paymentOrder.checkoutUrl} className="text-blue-600" target="_blank">mở link thanh toán</a>
        </p>
        <Badge variant="secondary">Đang chờ thanh toán...</Badge>
      </div>
    )}
  </DialogContent>
</Dialog>
```

```jsx
// Hook tạo order + polling trạng thái cho đến khi PayOS callback xử lý xong
function useUpgradeFlow() {
  const [paymentOrder, setPaymentOrder] = useState(null)

  const { mutate: createUpgradeOrder } = useMutation({
    mutationFn: (plan) => api.post("/billing/upgrade", { targetPlan: plan.id }),
    onSuccess: (data) => setPaymentOrder(data), // { qrCodeUrl, checkoutUrl, orderCode }
  })

  // Polling kiểm tra subscription đã đổi gói chưa (vì callback PayOS xử lý bất đồng bộ)
  useQuery({
    queryKey: ["billing", "current-plan"],
    queryFn: () => api.get("/billing/current-plan"),
    enabled: !!paymentOrder,
    refetchInterval: 3000,
    onSuccess: (data) => {
      if (data.plan !== "free") {
        toast.success("Nâng cấp gói thành công!")
        setPaymentOrder(null)
        queryClient.invalidateQueries({ queryKey: ["billing"] })
      }
    },
  })

  return { paymentOrder, createUpgradeOrder }
}
```

### Tab AI Knowledge Base

```jsx
<Card>
  <CardHeader>
    <CardTitle>Tài liệu nội bộ</CardTitle>
    <p className="text-sm text-muted-foreground">
      Upload SOP, quy trình kế toán để AI trả lời đúng nghiệp vụ của bạn
    </p>
  </CardHeader>
  <CardContent>
    {/* Upload zone */}
    <div className="border-2 border-dashed rounded-lg p-6 text-center mb-4">
      <Upload className="mx-auto h-8 w-8 text-muted-foreground mb-2" />
      <p className="text-sm">Kéo thả PDF, DOCX vào đây</p>
      <Button variant="outline" size="sm" className="mt-2">Chọn file</Button>
    </div>

    {/* Uploaded docs list */}
    {docs.map(doc => (
      <div className="flex items-center justify-between py-2 border-b">
        <div className="flex items-center gap-2">
          <FileText className="w-4 h-4 text-muted-foreground" />
          <div>
            <p className="text-sm font-medium">{doc.name}</p>
            <p className="text-xs text-muted-foreground">{doc.uploadedAt}</p>
          </div>
        </div>
        <Button variant="ghost" size="sm">
          <Trash2 className="w-4 h-4 text-destructive" />
        </Button>
      </div>
    ))}
  </CardContent>
</Card>
```

### Tab AI Matching Threshold

```jsx
<Card>
  <CardHeader>
    <CardTitle>Ngưỡng tự động ghép</CardTitle>
  </CardHeader>
  <CardContent>
    <p className="text-sm text-muted-foreground mb-4">
      Giao dịch có Confidence Score ≥ ngưỡng này sẽ được ghép tự động.
      Dưới ngưỡng sẽ chuyển sang Human Review.
    </p>
    <div className="flex items-center gap-4">
      <Slider
        min={50}
        max={100}
        step={1}
        value={[threshold]}
        onValueChange={([v]) => setThreshold(v)}
        className="flex-1"
      />
      <span className="font-bold text-lg w-16 text-center">{threshold}%</span>
    </div>
    <Button className="mt-4" onClick={save}>Lưu thay đổi</Button>
  </CardContent>
</Card>
```

---

## 9. 🏢 Partner Dashboard (Cas Partner)

**Route:** `/partner` (layout hoàn toàn riêng, không dùng chung Sidebar 8 mục ở trên)
**Quyền truy cập:** chỉ role `cas_partner` — middleware redirect role khác về `/dashboard` nếu cố vào `/partner`
**API calls:**
- `GET /api/v1/partner/tenants`
- `GET /api/v1/partner/tenants/:id`
- `PATCH /api/v1/partner/tenants/:id/suspend`
- `PATCH /api/v1/partner/tenants/:id/activate`
- `GET /api/v1/partner/revenue`
- `GET /api/v1/partner/usage-stats`
- `GET /api/v1/partner/audit-logs`

### Layout riêng

Partner Dashboard dùng layout **đơn giản hơn**, không có Sidebar 8 mục nghiệp vụ — chỉ có top nav vì Cas Partner không thao tác nghiệp vụ, chỉ xem tổng quan:

```
┌─────────────────────────────────────────────────────┐
│ Top Nav: X-Cash AI — Partner Console      [Logout]  │
├─────────────────────────────────────────────────────┤
│ Stats Row (grid grid-cols-4 gap-4)                   │
│ ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐│
│ │Tổng DN   │ │DN active │ │Tổng GD    │ │Doanh thu ││
│ │  127     │ │  118     │ │xử lý tháng│ │tháng này ││
│ │↑8 mới    │ │9 suspended│ │1.2M       │ │45.8M đ   ││
│ └──────────┘ └──────────┘ └──────────┘ └──────────┘│
├─────────────────────────────────────────────────────┤
│ Revenue Chart (LineChart, full width)                │
├─────────────────────────────────────────────────────┤
│ Filter: [Search tên DN...] [Status ▼] [Plan ▼]      │
├─────────────────────────────────────────────────────┤
│ Table: Danh sách doanh nghiệp                        │
│ Tên DN | Gói | Trạng thái | GD/tháng | DT | Action  │
│ TT Anh ngữ ABC│Pro│🟢 Active│2,400│2.5M│[Xem][Khóa] │
│ Phòng khám XYZ│Free│🟢 Active│450│0đ│[Xem][Nâng cấp]│
│ Shop Online K │Pro│🔴 Suspended│0│0đ│[Xem][Mở khóa] │
├─────────────────────────────────────────────────────┤
│ Pagination                                           │
└─────────────────────────────────────────────────────┘
```

### Stats Card (giống Dashboard thường nhưng số liệu khác)

```jsx
<div className="grid grid-cols-4 gap-4">
  <Card>
    <CardHeader className="pb-2">
      <CardTitle className="text-sm font-medium text-muted-foreground">
        Tổng doanh nghiệp
      </CardTitle>
    </CardHeader>
    <CardContent>
      <div className="text-2xl font-bold">127</div>
      <p className="text-xs text-green-600 mt-1">↑ 8 mới tháng này</p>
    </CardContent>
  </Card>
  {/* Tương tự cho DN active, Tổng GD, Doanh thu */}
</div>
```

### Tenant Table với Action buttons

```jsx
<Table>
  <TableHeader>
    <TableRow>
      <TableHead>Tên doanh nghiệp</TableHead>
      <TableHead>Gói</TableHead>
      <TableHead>Trạng thái</TableHead>
      <TableHead>GD/tháng</TableHead>
      <TableHead>Doanh thu</TableHead>
      <TableHead className="text-right">Thao tác</TableHead>
    </TableRow>
  </TableHeader>
  <TableBody>
    {tenants.map(t => (
      <TableRow key={t.id}>
        <TableCell className="font-medium">{t.businessName}</TableCell>
        <TableCell>
          <Badge variant={t.plan === "pro" ? "default" : "secondary"}>
            {t.plan.toUpperCase()}
          </Badge>
        </TableCell>
        <TableCell>
          {t.status === "active" ? (
            <Badge variant="success">🟢 Active</Badge>
          ) : (
            <Badge variant="destructive">🔴 Suspended</Badge>
          )}
        </TableCell>
        <TableCell>{t.transactionCount.toLocaleString()}</TableCell>
        <TableCell className="font-semibold">{formatVND(t.revenue)}</TableCell>
        <TableCell className="text-right">
          <div className="flex justify-end gap-2">
            <Button size="sm" variant="outline" onClick={() => openDetail(t.id)}>
              Xem
            </Button>
            {t.status === "active" ? (
              <Button size="sm" variant="destructive" onClick={() => suspend(t.id)}>
                Khóa
              </Button>
            ) : (
              <Button size="sm" onClick={() => activate(t.id)}>
                Mở khóa
              </Button>
            )}
          </div>
        </TableCell>
      </TableRow>
    ))}
  </TableBody>
</Table>
```

### Suspend Confirmation Dialog

Khóa tài khoản là hành động nhạy cảm — luôn confirm trước khi thực hiện:

```jsx
<AlertDialog>
  <AlertDialogContent>
    <AlertDialogHeader>
      <AlertDialogTitle>Khóa tài khoản doanh nghiệp?</AlertDialogTitle>
      <AlertDialogDescription>
        Toàn bộ user của <strong>{tenant.businessName}</strong> sẽ không đăng nhập được.
        Webhook vẫn nhận nhưng giao dịch sẽ xếp hàng chờ, không xử lý cho đến khi mở khóa lại.
      </AlertDialogDescription>
    </AlertDialogHeader>
    <AlertDialogFooter>
      <AlertDialogCancel>Hủy</AlertDialogCancel>
      <AlertDialogAction
        className="bg-destructive"
        onClick={() => suspendMutation.mutate(tenant.id)}
      >
        Xác nhận khóa
      </AlertDialogAction>
    </AlertDialogFooter>
  </AlertDialogContent>
</AlertDialog>
```

### Tenant Detail Sheet

Click "Xem" → Sheet từ phải, hiển thị usage chi tiết (KHÔNG hiển thị dữ liệu nghiệp vụ như tên khách hàng, nội dung giao dịch — chỉ số liệu tổng hợp):

```jsx
<Sheet>
  <SheetContent className="w-[480px]">
    <SheetHeader>
      <SheetTitle>{tenant.businessName}</SheetTitle>
    </SheetHeader>

    <div className="grid grid-cols-2 gap-3 mt-4">
      <div><p className="text-xs text-muted-foreground">Mã số thuế</p><p>{tenant.taxCode}</p></div>
      <div><p className="text-xs text-muted-foreground">Ngày tham gia</p><p>{tenant.createdAt}</p></div>
      <div><p className="text-xs text-muted-foreground">Gói dịch vụ</p><p>{tenant.plan}</p></div>
      <div><p className="text-xs text-muted-foreground">Trạng thái</p><StatusBadge status={tenant.status} /></div>
    </div>

    <Separator className="my-4" />

    <p className="text-sm font-medium mb-2">Usage 30 ngày qua</p>
    <ResponsiveContainer width="100%" height={200}>
      <LineChart data={tenant.usageHistory}>
        <XAxis dataKey="date" />
        <YAxis />
        <Tooltip />
        <Line type="monotone" dataKey="transactionCount" stroke="#2563eb" />
      </LineChart>
    </ResponsiveContainer>

    <Separator className="my-4" />

    <p className="text-sm font-medium mb-2">Doanh thu</p>
    <p className="text-2xl font-bold">{formatVND(tenant.totalRevenue)}</p>
    <p className="text-xs text-muted-foreground">Tổng từ khi tham gia</p>
  </SheetContent>
</Sheet>
```

### States

- **Empty:** "Chưa có doanh nghiệp nào đăng ký"
- **Loading:** Skeleton table
- **Suspend thành công:** Toast + badge chuyển đỏ ngay (optimistic update qua TanStack Query)

### ⚠️ Lưu ý khi code màn hình này

- Route `/partner/*` phải tách hoàn toàn khỏi router nghiệp vụ — dùng `<ProtectedRoute role="cas_partner">` riêng wrap quanh, không tái sử dụng layout 8 màn hình kia.
- Component này **không bao giờ** gọi API `/transactions`, `/invoices`, `/customers` của bất kỳ tenant nào — chỉ gọi `/partner/*`. Nếu thấy code Partner Dashboard import API nghiệp vụ thông thường, đó là dấu hiệu thiết kế sai.

---

## 🔧 Shared Components

### formatVND utility

```js
function formatVND(amount) {
  return new Intl.NumberFormat("vi-VN", {
    style: "currency",
    currency: "VND",
  }).format(amount)
}
```

### StatusBadge component

```jsx
function StatusBadge({ status }) {
  const map = {
    matched: { label: "Matched", variant: "success" },
    review: { label: "Review", variant: "warning" },
    pending: { label: "Pending", variant: "secondary" },
    skipped: { label: "Skipped", variant: "outline" },
  }
  const { label, variant } = map[status] ?? {}
  return <Badge variant={variant}>{label}</Badge>
}
```

### TanStack Query pattern

```jsx
// Fetch danh sách giao dịch
const { data, isLoading, error } = useQuery({
  queryKey: ["transactions", filters],
  queryFn: () => api.get("/transactions", { params: filters }),
  refetchInterval: 10_000, // polling mỗi 10 giây
})

// Mutation confirm review
const { mutate: confirm, isPending } = useMutation({
  mutationFn: (id) => api.post(`/review/${id}/confirm`),
  onSuccess: () => {
    toast.success("Đã xác nhận ghép hóa đơn")
    queryClient.invalidateQueries({ queryKey: ["review"] })
    queryClient.invalidateQueries({ queryKey: ["transactions"] })
  },
  onError: () => toast.error("Có lỗi xảy ra, vui lòng thử lại"),
})
```

### Loading skeleton pattern

```jsx
// Dùng cho table
function TableSkeleton({ rows = 5 }) {
  return Array.from({ length: rows }).map((_, i) => (
    <TableRow key={i}>
      {Array.from({ length: 7 }).map((_, j) => (
        <TableCell key={j}><Skeleton className="h-4 w-full" /></TableCell>
      ))}
    </TableRow>
  ))
}
```

### Empty state pattern

```jsx
function EmptyState({ icon: Icon, title, description, action }) {
  return (
    <div className="flex flex-col items-center justify-center py-16 text-center">
      <Icon className="w-12 h-12 text-muted-foreground mb-4" />
      <h3 className="font-semibold text-lg mb-1">{title}</h3>
      <p className="text-sm text-muted-foreground mb-4">{description}</p>
      {action}
    </div>
  )
}
```
