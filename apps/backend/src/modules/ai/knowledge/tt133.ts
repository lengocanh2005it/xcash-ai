import type { KnowledgeSection } from './casso';

export const TT133_KNOWLEDGE: KnowledgeSection[] = [
  {
    id: 'tt133_overview',
    title: 'TT133 là gì?',
    keywords: [
      'tt133',
      'thông tư 133',
      'tt133 là gì',
      'chuẩn kế toán',
      'kế toán sme',
      'kế toán doanh nghiệp nhỏ',
    ],
    content: `**Thông tư 133/2016/TT-BTC** (gọi tắt: **TT133**) là chuẩn mực kế toán dành riêng cho **doanh nghiệp nhỏ và vừa (SME)** tại Việt Nam, do Bộ Tài chính ban hành.

Đặc điểm chính:
- Áp dụng cho doanh nghiệp vừa và nhỏ, hộ kinh doanh (thay thế Quyết định 48/2006)
- Hệ thống tài khoản đơn giản hơn VAS/TT200 (khoảng 60-70 tài khoản thay vì 100+)
- Phương pháp kế toán: ghi nhận theo nguyên tắc dồn tích (accrual)
- Báo cáo tài chính: Bảng CĐKT, Báo cáo KQHĐKD, Thuyết minh

X-Cash AI dùng TT133 làm cơ sở để AI phân loại giao dịch ngân hàng thành các bút toán kế toán (định khoản). Hệ thống seed sẵn ~60 tài khoản TT133 khi doanh nghiệp đăng ký.`,
  },
  {
    id: 'tt133_accounts',
    title: 'Danh sách tài khoản TT133 thường dùng',
    keywords: [
      'tài khoản',
      'mã tài khoản',
      'tk 111',
      'tk 112',
      'tk 131',
      'tk 331',
      'tk 511',
      'tk 642',
      'chart of accounts',
      'hệ thống tài khoản',
      'danh sách tài khoản',
    ],
    content: `Các tài khoản TT133 thường gặp nhất:

**Tài sản (1xx - 2xx)**
- **111** — Tiền mặt
- **112** — Tiền gửi ngân hàng ← mọi GD NH đều qua TK này
- **113** — Tiền đang chuyển
- **131** — Phải thu của khách hàng
- **133** — Thuế GTGT được khấu trừ
- **141** — Tạm ứng
- **156** — Hàng hóa
- **211** — Tài sản cố định hữu hình
- **242** — Chi phí trả trước dài hạn

**Nợ phải trả (3xx)**
- **331** — Phải trả người bán
- **333** — Thuế và các khoản phải nộp Nhà nước
- **334** — Phải trả người lao động
- **338** — Phải trả, phải nộp khác
- **341** — Vay và nợ thuê tài chính

**Vốn chủ sở hữu (4xx)**
- **411** — Vốn đầu tư của chủ sở hữu
- **421** — Lợi nhuận sau thuế chưa phân phối

**Doanh thu (5xx)**
- **511** — Doanh thu bán hàng và cung cấp dịch vụ
- **515** — Doanh thu hoạt động tài chính (lãi tiền gửi, lãi cho vay)
- **521** — Các khoản giảm trừ doanh thu

**Chi phí (6xx)**
- **611** — Mua hàng
- **621** — Chi phí nguyên vật liệu trực tiếp
- **622** — Chi phí nhân công trực tiếp
- **627** — Chi phí sản xuất chung
- **631** — Giá thành sản xuất
- **632** — Giá vốn hàng bán
- **635** — Chi phí tài chính (lãi vay, phí NH)
- **641** — Chi phí bán hàng
- **642** — Chi phí quản lý doanh nghiệp (lương VP, thuê văn phòng, ...)
- **811** — Chi phí khác`,
  },
  {
    id: 'tt133_journal_entry',
    title: 'Định khoản kế toán là gì? Nợ/Có hoạt động thế nào?',
    keywords: [
      'định khoản',
      'định khoản là gì',
      'nợ có',
      'ghi nợ',
      'ghi có',
      'bút toán',
      'journal entry',
      'debit credit',
    ],
    content: `**Định khoản kế toán** (journal entry) là cách ghi nhận một giao dịch kinh tế vào sổ kế toán theo nguyên tắc **bút toán kép**: mỗi giao dịch luôn có ít nhất một bên Nợ và một bên Có với tổng giá trị bằng nhau.

**Quy tắc cơ bản:**
- **Nợ 112** — tiền VÀO tài khoản ngân hàng (tài sản tăng)
- **Có 112** — tiền RA khỏi tài khoản ngân hàng (tài sản giảm)

**Ví dụ định khoản thường gặp:**

Thu tiền từ khách hàng:
→ Nợ **112** (tiền vào NH) / Có **131** (giảm công nợ phải thu)

Trả tiền cho nhà cung cấp:
→ Nợ **331** (giảm nợ phải trả) / Có **112** (tiền ra NH)

Thu doanh thu dịch vụ (tiền vào ngay):
→ Nợ **112** / Có **511**

Trả lương nhân viên:
→ Nợ **334** / Có **112**

Trả lãi vay ngân hàng:
→ Nợ **635** / Có **112**

Chi phí quản lý (mua văn phòng phẩm, thuê văn phòng...):
→ Nợ **642** / Có **112**

Nộp thuế:
→ Nợ **333** / Có **112**

**Ngưỡng AI tự động:** X-Cash AI tự động approve định khoản khi độ tin cậy ≥ **85%**. Dưới ngưỡng → vào hàng đợi Human Review cho kế toán xét duyệt.`,
  },
  {
    id: 'tt133_common_concepts',
    title: 'Các khái niệm kế toán cơ bản',
    keywords: [
      'doanh thu',
      'chi phí',
      'lãi lỗ',
      'phải thu',
      'phải trả',
      'công nợ',
      'vốn chủ',
      'khái niệm kế toán',
      'tài sản',
      'nợ phải trả',
    ],
    content: `Các khái niệm kế toán cơ bản theo TT133:

**Doanh thu (Revenue)** — TK 511, 515
Giá trị hàng hóa/dịch vụ đã bán được trong kỳ. Doanh thu thuần = Doanh thu gộp - Giảm trừ doanh thu (chiết khấu, hàng trả lại).

**Chi phí (Expense)** — TK 6xx
Giá trị nguồn lực tiêu hao để tạo ra doanh thu. Gồm giá vốn (632), chi phí bán hàng (641), chi phí quản lý (642), chi phí tài chính (635).

**Lãi/lỗ (Profit/Loss)**
= Doanh thu - Chi phí
Dương → lãi (profit), âm → lỗ (loss).

**Phải thu khách hàng** — TK 131
Tiền khách đã mua hàng nhưng chưa trả. Khi thu được tiền: Nợ 112 / Có 131.

**Phải trả người bán** — TK 331
Tiền mình đã mua hàng/dịch vụ nhưng chưa trả. Khi thanh toán: Nợ 331 / Có 112.

**Tài sản cố định** — TK 211
Tài sản có giá trị lớn, dùng lâu dài (>1 năm). Phải trích khấu hao theo từng kỳ.

**Thuế GTGT (VAT)** — TK 133 (đầu vào), TK 333 (phải nộp)
Doanh nghiệp kê khai VAT đầu vào được khấu trừ, VAT đầu ra phải nộp Nhà nước.

**Lưu chuyển tiền tệ**
Báo cáo lưu chuyển tiền tệ (cash flow) theo dõi dòng tiền thực tế vào/ra — khác với báo cáo KQHĐKD (tính theo dồn tích, có thể có doanh thu nhưng chưa thu tiền).`,
  },
];
