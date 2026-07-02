# Hướng dẫn import hóa đơn từ Excel

> Dành cho **chủ doanh nghiệp / kế toán** khi upload danh sách hóa đơn lên PayPilot AI.

## Bước 1 — Tải file mẫu

Trong app (hoặc Swagger), gọi:

```
GET /api/v1/invoices/import/template
```

Tải về file `paypilot-import-hoa-don-mau.xlsx` — **luôn dùng file này làm điểm bắt đầu**, đừng tự tạo cột mới nếu chưa quen.

## Bước 2 — Điền dữ liệu

| Cột | Bắt buộc | Ví dụ | Ghi chú |
|---|---|---|---|
| `ma_hoa_don` | Có | `HD1025` | Mã unique trong doanh nghiệp; khách thường gõ nội dung CK theo mã này |
| `ten_khach_hang` | Có | `Nguyễn Văn A` | Tên khách — dùng cho AI matching |
| `so_tien` | Có | `350000` | Chỉ số, không ghi "đ" hay dấu phẩy |
| `han_thanh_toan` | Không | `2026-12-31` | Định dạng ngày `YYYY-MM-DD` |
| `sdt` | Không | `0901234567` | Số điện thoại khách |
| `email` | Không | `khach@example.com` | Email khách |

**Cột tiếng Anh cũng được chấp nhận:** `invoice_code`, `customer_name`, `amount`, `due_date`, `phone`, `email`.

## Quy tắc quan trọng

1. **Dòng 1 là tiêu đề cột** — không xóa, không đổi tên cột bắt buộc.
2. **Dùng sheet đầu tiên** của file Excel (tên sheet không quan trọng).
3. **Không gộp ô**, không chèn dòng tiêu đề phụ.
4. **Mỗi dòng = 1 hóa đơn.**
5. File tối đa **500 dòng** và **5 MB** mỗi lần import.
6. Trùng `ma_hoa_don` đã có → dòng đó bị **bỏ qua** (skipped), không ghi đè.

## Bước 3 — Upload

```
POST /api/v1/invoices/import
Content-Type: multipart/form-data
file: <file .xlsx>
```

Chỉ role **Admin** hoặc **Accountant** được import.

## Kết quả trả về

```json
{
  "imported": 10,
  "skipped": 2,
  "errors": ["Dòng 5: thiếu số tiền (cột so_tien / amount)"],
  "skipped_empty_rows": 1
}
```

| Trường | Ý nghĩa |
|---|---|
| `imported` | Số hóa đơn tạo thành công (kèm embedding nếu đã cấu hình OpenAI) |
| `skipped` | Số dòng trùng mã hóa đơn đã tồn tại |
| `errors` | Lỗi từng dòng — sửa file và import lại |
| `skipped_empty_rows` | Số dòng trống trong file (bỏ qua, không tính lỗi) |

## Lỗi thường gặp

| Thông báo | Cách sửa |
|---|---|
| Thiếu cột bắt buộc | Tải lại file mẫu, giữ 3 cột `ma_hoa_don`, `ten_khach_hang`, `so_tien` |
| Không có dòng hợp lệ | Kiểm tra từng dòng có đủ 3 cột bắt buộc |
| Số tiền không hợp lệ | Chỉ nhập số nguyên dương, vd `350000` |
| File vượt quá 500 dòng | Chia file thành nhiều phần nhỏ hơn |

## Sau khi import

- Khách hàng mới được tạo tự động nếu chưa có (theo tên).
- Hệ thống tự **embedding** hóa đơn + khách hàng mới (cần `OPENAI_API_KEY` trên server).
- Có thể mock webhook Cas với nội dung chứa `ma_hoa_don` để test AI matching.

## Tính năng dự kiến (chưa có)

**AI Smart Excel Import** — nếu file Excel có cột tên khác chuẩn (vd `Giá trị`, `Tên KH`, `Mã đơn`), hệ thống sẽ dùng AI gợi ý ghép cột đúng định dạng, cho kế toán xác nhận trước khi import. Hiện tại vui lòng dùng file mẫu hoặc đặt tên cột theo bảng trên. Chi tiết kỹ thuật: `business-overview.md` mục Future Enhancements.
