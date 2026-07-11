# Copilot export báo cáo (Excel/PDF) — Design

## Bối cảnh

Copilot hiện có ~15 tool (registry pattern trong [`copilot-tool.registry.ts`](../../../apps/backend/src/modules/ai/copilot-tool.registry.ts)), chưa có action xuất file. Backend đã có sẵn `GET /reports/export` (Excel only, qua `ReportDataService.exportExcel()` + `fetchExportData()`), dùng cho nút export trên `ReportsPage`. Mục tiêu: cho phép user yêu cầu Copilot xuất báo cáo (Excel hoặc PDF) trực tiếp trong khung chat, hiển thị nút tải về ngay trong tin nhắn.

Ràng buộc kỹ thuật quan trọng: OpenAI function-calling chỉ truyền JSON qua model, không thể trả buffer nhị phân qua tool result. Do đó tool chỉ trả **metadata + tham chiếu**, file thật được tải qua 1 endpoint HTTP riêng.

## Kiến trúc tổng quan

1. Tool mới `export_report` — nhận `format` (`excel`/`pdf`) + `year+month` HOẶC `startDate+endDate`.
2. Tool tái dùng `ReportDataService.fetchExportData(tenantId, fromDate, toDate)` (đã có) để lấy dữ liệu.
3. Sinh file (Excel: tái dùng `buildExportWorkbook()`; PDF: viết mới bằng `pdfmake`), lưu buffer + metadata tạm vào Redis (`copilot:export:{exportId}`, TTL 10 phút).
4. Tool trả về cho model `{ exportId, format, fileName }` — model không hiển thị exportId thô cho user (giữ quy ước "không lộ kỹ thuật").
5. Activity kiểu mới `file_export` — payload gồm `exportId, format, fileName, fromDate, toDate` — được lưu **vĩnh viễn** trong copilot history (DB), không phụ thuộc Redis còn sống hay không.
6. FE hiển thị card + nút "Tải về" trong khung chat dựa trên activity này.
7. Endpoint `GET /reports/copilot-export/:exportId?fromDate=&toDate=&format=` (Bearer JWT):
   - Redis còn → trả buffer luôn.
   - Redis hết hạn/miss → dùng `fromDate/toDate/format` FE gửi kèm (lấy từ activity đã lưu trong history) để **regenerate on-demand** — gọi lại `fetchExportData` + build file mới, không cache lại.
   - So khớp `tenantId` trong Redis metadata (khi có) với tenant của user hiện tại → 403 nếu khác tenant.

Quyết định "regenerate on-demand" thay vì object storage (S3...): tránh thêm dependency/storage mới cho hệ thống hiện chưa có, tránh rủi ro file cũ lệch số liệu nếu giao dịch bị sửa sau khi export, và chi phí tính lại report là rẻ (vài query aggregation).

## Chi tiết tool

```
name: 'export_report'
description: 'Xuất báo cáo định khoản ra file Excel hoặc PDF theo tháng hoặc khoảng ngày tùy chỉnh.'
parameters:
  format: enum ['excel', 'pdf']   // required
  year: integer                   // optional, dùng cùng month
  month: integer (1-12)           // optional, dùng cùng year
  startDate: string (date)        // optional, dùng cùng endDate
  endDate: string (date)          // optional, dùng cùng startDate
```

Validation trong `execute`: phải có đúng 1 trong 2 cặp (`year`+`month`) hoặc (`startDate`+`endDate`) — thiếu cả hai hoặc thiếu 1 vế của cặp → throw `BadRequestException` với message rõ để model tự hỏi lại user hoặc sửa tham số. Khi có `year+month`, convert sang `fromDate/toDate` bằng `periodBounds()` đã có trong `report-date.util.ts`.

`activity`:
```
final: { kind: 'file_export', label: 'Xuất báo cáo', source: 'X-Cash AI' }
streaming: { kind: 'file_export', label: 'Đang xuất báo cáo…', source: 'X-Cash AI' }
```

`enabledBy`: không cần feature flag riêng — đây là tool chỉ đọc dữ liệu (giống `get_month_summary`), không phải action ghi như `propose_*`.

## Sinh file

- **Excel**: gọi thẳng `buildExportWorkbook()` hiện có trong `report-excel.util.ts`, `XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' })`.
- **PDF**: file mới `report-pdf.util.ts`, dùng `pdfmake` (pure-JS, không cần Chromium — phù hợp VPS, nhẹ hơn puppeteer). Layout tương đương Excel: header (tên doanh nghiệp, khoảng thời gian, ngày xuất), summary thu/chi/lãi-lỗ + stats, bảng breakdown theo tài khoản, bảng chi tiết giao dịch.
- Cả 2 dùng chung input là kết quả của `fetchExportData()` — không viết lại logic fetch.

## Lưu trữ tạm & endpoint tải

- Redis key: `copilot:export:{exportId}` (uuid v4), value JSON `{ tenantId, format, fileName, bufferBase64 }`, TTL 600s.
- `GET /reports/copilot-export/:exportId?fromDate&endDate&format` (Bearer JWT, mọi role tenant — giống `/reports/export` hiện tại, không giới hạn role riêng):
  1. Lookup Redis theo `exportId`. Nếu có: so `tenantId` metadata với `req.user.tenantId`, khác → 403; khớp → trả `StreamableFile` từ base64 decode.
  2. Nếu Redis miss: cần `fromDate`, `endDate`, `format` trong query (bắt buộc khi fallback) → gọi lại `fetchExportData(tenantId, fromDate, endDate)` rồi build file theo `format`, trả về, không lưu lại Redis.

## Frontend

- Activity `kind: 'file_export'` → render 1 card nhỏ trong message: icon theo `format` (Excel/PDF) + `fileName` + nút "Tải về".
- Bấm nút: gọi `getApiData(url, { responseType: 'blob' })` (endpoint ở trên, kèm `exportId` + `fromDate/toDate/format` lưu sẵn trong activity) → `URL.createObjectURL(blob)` → trigger tải qua thẻ `<a>` ẩn → `revokeObjectURL`. Không dùng `<a href>` trực tiếp vì endpoint cần Bearer token.
- Trạng thái loading trên nút khi đang tải; lỗi (403/500) → toast tiếng Việt.

## Error handling

- Thiếu cả 2 cặp tham số hoặc thiếu 1 vế → `BadRequestException`, model tự hỏi lại user.
- Tenant không có giao dịch trong khoảng đó → vẫn xuất file (summary rỗng/0), nhất quán hành vi Excel export hiện tại — không throw lỗi.
- `exportId` thuộc tenant khác → 403.
- Redis miss + thiếu query params fallback (trường hợp hi hữu, dữ liệu activity cũ không đủ field) → 400 rõ ràng.

## Testing

- Unit: `report-pdf.util.ts` build không lỗi với dữ liệu mẫu (rỗng + có data); tool `export_report` validate params (thiếu cả 2 loại → throw, có cả 2 loại → throw hoặc ưu tiên 1 loại — chọn throw để tránh mơ hồ).
- Integration: `GET /reports/copilot-export/:exportId` — Redis hit trả đúng buffer; Redis miss regenerate đúng dữ liệu; sai tenant → 403.
- `pnpm verify` phải pass (lint, type-check, test, build) trước khi coi hoàn thành.
- Không cần update `agent-docs/reference/rbac.md` vì endpoint dùng chung rule "Bearer JWT, mọi role" như `/reports/export` hiện tại — nhưng cần chạy `/sync-agent-docs` sau khi code xong vì thêm route mới + tool mới vào registry (ảnh hưởng bảng API + danh sách tool trong `00-current-state.md`).
