import type { KnowledgeSection } from './casso';

export const XCASH_FEATURES_KNOWLEDGE: KnowledgeSection[] = [
  {
    id: 'xcash_overview',
    title: 'X-Cash AI là gì? Có những tính năng gì?',
    keywords: [
      'x-cash ai',
      'xcash',
      'x-cash là gì',
      'tính năng',
      'phần mềm kế toán',
      'ai copilot',
      'bạn là ai',
      'bạn làm được gì',
    ],
    content: `**X-Cash AI** là nền tảng kế toán thông minh cho doanh nghiệp vừa và nhỏ (SME) Việt Nam. X-Cash AI kết hợp tích hợp ngân hàng (qua Casso) với AI định khoản tự động theo chuẩn **TT133**.

Các tính năng chính:
- **Nhận giao dịch real-time**: Kết nối ngân hàng qua Cas Link, nhận GD tự động qua Cas Balance Hook
- **AI định khoản tự động**: Phân loại giao dịch thành bút toán kế toán (Nợ/Có) dùng gpt-4o-mini + pgvector
- **Human Review**: Giao dịch AI không chắc chắn (<85%) → kế toán xét duyệt tay
- **Import Excel**: Nhập giao dịch từ file Excel (sao kê ngân hàng tải về)
- **Báo cáo thu chi**: Tổng hợp doanh thu, chi phí, lãi/lỗ theo tháng
- **AI Copilot**: Trợ lý AI trả lời câu hỏi về tài chính, kế toán, phân tích dữ liệu của doanh nghiệp`,
  },
  {
    id: 'xcash_human_review',
    title: 'Human Review — Xét duyệt giao dịch',
    keywords: [
      'human review',
      'xét duyệt',
      'chờ duyệt',
      'review queue',
      'kế toán duyệt',
      'giao dịch chờ',
      'approve',
      'reject',
    ],
    content: `**Human Review** là quy trình kế toán xét duyệt các giao dịch mà AI phân loại với độ tin cậy dưới ngưỡng.

Luồng hoạt động:
1. AI phân loại GD → độ tin cậy **< 85%** → GD vào hàng đợi Human Review (status = review)
2. Kế toán (role: accountant hoặc admin) vào trang Giao dịch → lọc "Chờ duyệt"
3. Xem đề xuất AI, điều chỉnh nếu cần, nhấn **Duyệt** hoặc **Từ chối**
4. Sau khi duyệt → GD được ghi nhận vào sổ kế toán chính thức

Phân quyền:
- **Admin, Accountant**: được duyệt/từ chối GD
- **Viewer**: chỉ xem, không được duyệt

Cấu hình ngưỡng:
- Mặc định: **85%** → tự động approve
- Có thể điều chỉnh trong cài đặt (AI_MATCHING_AUTO_THRESHOLD)`,
  },
  {
    id: 'xcash_import_excel',
    title: 'Import giao dịch từ Excel',
    keywords: [
      'import excel',
      'nhập excel',
      'sao kê',
      'upload file',
      'import giao dịch',
      'excel',
      'file xlsx',
    ],
    content: `X-Cash AI cho phép nhập giao dịch từ file Excel (sao kê ngân hàng tải về từ internet banking):

Cách thực hiện:
1. Vào trang **Giao dịch** → nhấn **Nhập từ Excel**
2. Tải file sao kê từ ngân hàng (định dạng .xlsx hoặc .xls)
3. Hệ thống parse file, hiển thị preview các GD sẽ import
4. Xác nhận → GD được import và AI tự động phân loại định khoản

Lưu ý:
- GD import Excel có **nguồn = "import"** (khác với GD từ Casso = "cas")
- Trong tab Giao dịch, có thể lọc theo nguồn để phân biệt
- Hệ thống check trùng lặp dựa theo ngày, số tiền, nội dung để tránh import 2 lần
- Khuôn dạng file hỗ trợ tùy theo cấu hình của từng ngân hàng; nếu file không nhận được → liên hệ hỗ trợ`,
  },
  {
    id: 'xcash_reports',
    title: 'Báo cáo thu chi — Xem doanh thu, chi phí, lãi/lỗ',
    keywords: [
      'báo cáo',
      'doanh thu',
      'chi phí',
      'lãi lỗ',
      'thu chi',
      'report',
      'tổng hợp',
      'thống kê',
      'tháng này',
      'tháng trước',
    ],
    content: `X-Cash AI cung cấp báo cáo thu chi theo tháng, tổng hợp từ tất cả GD đã được phân loại định khoản:

**Báo cáo tháng** bao gồm:
- **Tổng thu (doanh thu)**: Tổng giá trị GD tiền vào đã phân loại
- **Tổng chi (chi phí)**: Tổng giá trị GD tiền ra đã phân loại
- **Lãi/lỗ thuần**: Tổng thu - Tổng chi
- **Số GD trong kỳ**: Tổng số GD, trong đó có bao nhiêu chờ duyệt
- **Độ chính xác AI**: % GD AI tự động phân loại đúng (auto-approved)

**Top tài khoản phát sinh**: Danh sách TK kế toán có phát sinh nhiều nhất trong tháng

**So sánh tháng**: So sánh thu/chi/lãi-lỗ tháng này vs tháng trước

AI Copilot có thể lấy và phân tích báo cáo này khi bạn hỏi về tình hình tài chính.`,
  },
  {
    id: 'xcash_rbac',
    title: 'Phân quyền trong X-Cash AI (RBAC)',
    keywords: [
      'phân quyền',
      'role',
      'quyền',
      'admin',
      'accountant',
      'viewer',
      'kế toán',
      'quản trị',
      'rbac',
      'người dùng',
    ],
    content: `X-Cash AI có 3 role chính cho người dùng trong doanh nghiệp:

**Admin**
- Toàn quyền: cấu hình, quản lý người dùng, liên kết ngân hàng
- Được duyệt/từ chối giao dịch, xem báo cáo, dùng AI Copilot
- Quản lý gói dịch vụ (billing)

**Accountant (Kế toán)**
- Xem và duyệt/từ chối giao dịch (Human Review)
- Xem báo cáo thu chi, dùng AI Copilot
- Không được cấu hình hệ thống hay quản lý user

**Viewer (Người xem)**
- Chỉ xem giao dịch và báo cáo
- Không được duyệt GD, không thay đổi cấu hình`,
  },
  {
    id: 'xcash_subscription',
    title: 'Gói dịch vụ & Quota',
    keywords: [
      'gói dịch vụ',
      'subscription',
      'quota',
      'hết quota',
      'billing',
      'thanh toán',
      'nâng cấp',
      'gói',
    ],
    content: `X-Cash AI hoạt động theo mô hình subscription (gói thuê bao theo tháng):

- Mỗi gói có giới hạn số **giao dịch được xử lý** trong tháng (quota GD)
- Hết quota → hệ thống tạm dừng nhận GD mới từ Casso cho đến khi gia hạn hoặc nâng cấp
- GD import Excel không bị tính vào quota từ Casso (tùy cấu hình gói)

Xem trạng thái gói:
- Vào **Cài đặt → Gói dịch vụ** để xem quota đã dùng, ngày gia hạn
- Admin nhận email thông báo khi quota gần hết

Thanh toán:
- Hỗ trợ thanh toán qua **payOS** (chuyển khoản ngân hàng, QR)
- Hóa đơn xuất tự động mỗi kỳ`,
  },
];
