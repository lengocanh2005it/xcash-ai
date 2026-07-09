import type { KnowledgeSection } from './casso';

export const BILLING_SETTINGS_KNOWLEDGE: KnowledgeSection[] = [
  {
    id: 'billing_payos',
    title: 'Thanh toán qua PayOS — Cách thanh toán gói dịch vụ',
    keywords: [
      'payos',
      'thanh toán',
      'thanh toán gói',
      'thanh toán online',
      'qr code',
      'chuyển khoản',
      'hóa đơn',
      'invoice',
      'payment link',
    ],
    content: `X-Cash AI sử dụng **payOS** (sản phẩm của Casso) làm cổng thanh toán chính:

**Cách thanh toán:**
1. Admin vào **Cài đặt → Gói dịch vụ** → nhấn **Nâng cấp** hoặc **Gia hạn**
2. Hệ thống tạo link thanh toán payOS (QR code + URL)
3. Quét QR qua app ngân hàng hoặc mở link trên trình duyệt → thanh toán
4. Sau khi thanh toán thành công, hệ thống tự động cập nhật gói dịch vụ

**Hỗ trợ:**
- Chuyển khoản ngân hàng qua QR
- Ví điện tử (MoMo, ZaloPay...)
- Thẻ tín dụng/ghi nợ (nếu ngân hàng hỗ trợ)

**Lưu ý:**
- Hóa đơn xuất tự động mỗi kỳ thanh toán
- Nếu thanh toán không thành công, có thể thử lại hoặc chọn phương thức khác
- Nếu gặp lỗi thanh toán, liên hệ hỗ trợ 1900 8144`,
  },
  {
    id: 'billing_subscription',
    title: 'Gói dịch vụ & Quota — Xem và quản lý',
    keywords: [
      'gói dịch vụ',
      'subscription',
      'quota',
      'hết quota',
      'nâng cấp',
      'gia hạn',
      'đổi gói',
      'gói đang dùng',
      'trạng thái gói',
    ],
    content: `X-Cash AI hoạt động theo mô hình subscription (thuê bao theo tháng):

**Xem trạng thái gói:**
- Vào **Cài đặt → Gói dịch vụ** để xem:
  - Gói đang dùng (Free / Pro / Enterprise)
  - Quota đã dùng / Tổng quota trong tháng
  - Ngày hết hạn và ngày gia hạn tiếp theo

**Quota bao gồm:**
- **Quota giao dịch**: Số GD ngân hàng được xử lý trong tháng (GD import Excel không tính)
- **Quota AI Copilot**: Số lượt chat AI trong tháng

**Hết quota怎么办:**
- Hệ thống tạm dừng nhận GD mới từ Casso
- Vẫn có thể xem GD cũ và báo cáo
- Cần nâng cấp hoặc chờ kỳ billing tiếp theo

**Nâng cấp / Đổi gói:**
- Admin thực hiện trong **Cài đặt → Gói dịch vụ**
- Thanh toán qua payOS → ngay lập tức được kích hoạt`,
  },
  {
    id: 'settings_tenant',
    title: 'Cài đặt doanh nghiệp — Thông tin và cấu hình',
    keywords: [
      'cài đặt',
      'settings',
      'thông tin doanh nghiệp',
      'tenant',
      'cấu hình',
      'company info',
      'logo',
      'tên công ty',
    ],
    content: `Trang **Cài đặt** cho phép admin quản lý thông tin và cấu hình doanh nghiệp:

**Thông tin doanh nghiệp:**
- Tên công ty, mã số thuế, địa chỉ
- Logo (hiển thị trên báo cáo xuất)
- Ngôn ngữ, múi giờ

**Ngân hàng:**
- Quản lý các tài khoản ngân hàng đã liên kết qua Cas Link
- Xem trạng thái liên kết, hủy liên kết
- Liên kết mới qua luồng Cas Link

**Người dùng:**
- Quản lý thành viên trong doanh nghiệp
- Phân quyền: Admin / Accountant / Viewer
- Mời người dùng mới qua email

**Cài đặt khác:**
- Ngưỡng AI tự động approve (mặc định 85%)
- Cài đặt thông báo email
- Quản lý API key (nếu cần tích hợp bên ngoài)`,
  },
  {
    id: 'error_states',
    title: 'Lỗi thường gặp & Cách xử lý',
    keywords: [
      'lỗi',
      'error',
      'không hoạt động',
      'bị lỗi',
      'xử lý lỗi',
      'troubleshoot',
      'không import được',
      'không xem được báo cáo',
    ],
    content: `Một số lỗi thường gặp khi sử dụng X-Cash AI và cách xử lý:

**1. Không thấy giao dịch từ ngân hàng:**
- Kiểm tra đã liên kết ngân hàng chưa (Cài đặt → Ngân hàng)
- Kiểm tra trạng thái gói dịch vụ (có thể hết quota)
- Chờ 5-30 giây, Casso thường push chậm
- Nếu vẫn không thấy, liên hệ hỗ trợ

**2. Import Excel thất bại:**
- Đảm bảo file đúng định dạng (.xlsx, .xls)
- Kiểm tra file có rỗng không
- Thử tải lại file từ ngân hàng
- Nếu lỗi持续, thử đổi trình duyệt

**3. AI Copilot không trả lời:**
- Kiểm tra quota AI Copilot còn không
- Thử câu hỏi ngắn gọn hơn
- Nếu lỗi持续, có thể do server tạm thời quá tải

**4. Báo cáo hiển thị sai hoặc thiếu:**
- Kiểm tra bộ lọc ngày tháng
- Đảm bảo đã có GD được phân loại trong kỳ
- Thử tải lại trang (F5)

**5. Lỗi thanh toán payOS:**
- Thử lại sau vài phút
- Chọn phương thức thanh toán khác
- Liên hệ ngân hàng nếu lỗi từ phía NH
- Liên hệ hỗ trợ 1900 8144`,
  },
  {
    id: 'error_edge_cases',
    title: 'Trường hợp đặc biệt — GD trùng, GD lặp lại',
    keywords: ['trùng', 'duplicate', 'lặp lại', 'double', 'nhập trùng', 'import trùng'],
    content: `X-Cash AI có cơ chế chống trùng lặp giao dịch:

**Khi import Excel:**
- Hệ thống tự động check trùng dựa trên: ngày + số tiền + nội dung GD
- Nếu phát hiện GD giống hệt → cảnh báo và bỏ qua GD trùng
- Chỉ import GD mới, không tạo bản sao

**Khi nhận từ Casso (Cas Balance Hook):**
- Dùng Redis idempotency check theo transaction.id
- Nếu Casso retry (gửi lại GD đã xử lý) → hệ thống bỏ qua, không xử lý trùng
- Đảm bảo mỗi GD chỉ được xử lý 1 lần duy nhất

**Nếu nghi ngờ trùng lặp:**
- Kiểm tra tab Giao dịch, lọc theo nội dung hoặc số tiền
- Dùng AI Copilot: "Tìm giao dịch [nội dung]" để kiểm tra
- Nếu phát hiện trùng thật → liên hệ admin xử lý`,
  },
  {
    id: 'settings_notifications',
    title: 'Thông báo & Cài đặt email',
    keywords: [
      'thông báo',
      'notification',
      'email',
      'cài đặt thông báo',
      'bật thông báo',
      'tắt thông báo',
    ],
    content: `X-Cash AI có thể gửi thông báo qua email cho các sự kiện quan trọng:

**Các loại thông báo:**
- Quota giao dịch sắp hết (dưới 80%)
- Quota đã hết, cần gia hạn
- Có giao dịch mới chờ xét duyệt (Human Review)
- Thanh toán thành công/thất bại

**Cài đặt:**
- Admin vào **Cài đặt → Thông báo** để bật/tắt từng loại
- Thay đổi email nhận thông báo
- Tần suất thông báo (real-time hoặc tóm tắt hàng ngày)

**Lưu ý:**
- Thông báo chỉ gửi cho Admin
- Không gửi thông báo cho Accountant/Viewer (trừ khi admin cấu hình thêm)`,
  },
];
