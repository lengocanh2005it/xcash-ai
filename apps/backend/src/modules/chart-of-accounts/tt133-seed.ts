export interface AccountSeed {
  accountCode: string;
  accountName: string;
  accountType: 'asset' | 'liability' | 'equity' | 'revenue' | 'expense';
  parentCode: string | null;
}

export const TT133_ACCOUNTS: AccountSeed[] = [
  // NHÓM 1: TÀI SẢN
  { accountCode: '111', accountName: 'Tiền mặt', accountType: 'asset', parentCode: null },
  { accountCode: '112', accountName: 'Tiền gửi ngân hàng', accountType: 'asset', parentCode: null },
  { accountCode: '113', accountName: 'Tiền đang chuyển', accountType: 'asset', parentCode: null },
  {
    accountCode: '121',
    accountName: 'Chứng khoán kinh doanh',
    accountType: 'asset',
    parentCode: null,
  },
  {
    accountCode: '128',
    accountName: 'Đầu tư nắm giữ đến ngày đáo hạn',
    accountType: 'asset',
    parentCode: null,
  },
  {
    accountCode: '131',
    accountName: 'Phải thu khách hàng',
    accountType: 'asset',
    parentCode: null,
  },
  {
    accountCode: '133',
    accountName: 'Thuế GTGT được khấu trừ',
    accountType: 'asset',
    parentCode: null,
  },
  { accountCode: '136', accountName: 'Phải thu nội bộ', accountType: 'asset', parentCode: null },
  { accountCode: '138', accountName: 'Phải thu khác', accountType: 'asset', parentCode: null },
  { accountCode: '141', accountName: 'Tạm ứng', accountType: 'asset', parentCode: null },
  {
    accountCode: '151',
    accountName: 'Hàng mua đang đi trên đường',
    accountType: 'asset',
    parentCode: null,
  },
  {
    accountCode: '152',
    accountName: 'Nguyên liệu, vật liệu',
    accountType: 'asset',
    parentCode: null,
  },
  { accountCode: '153', accountName: 'Công cụ, dụng cụ', accountType: 'asset', parentCode: null },
  {
    accountCode: '154',
    accountName: 'Chi phí SXKD dở dang',
    accountType: 'asset',
    parentCode: null,
  },
  { accountCode: '155', accountName: 'Thành phẩm', accountType: 'asset', parentCode: null },
  { accountCode: '156', accountName: 'Hàng hóa', accountType: 'asset', parentCode: null },
  { accountCode: '157', accountName: 'Hàng gửi đi bán', accountType: 'asset', parentCode: null },
  { accountCode: '211', accountName: 'TSCĐ hữu hình', accountType: 'asset', parentCode: null },
  { accountCode: '213', accountName: 'TSCĐ vô hình', accountType: 'asset', parentCode: null },
  { accountCode: '214', accountName: 'Hao mòn TSCĐ', accountType: 'asset', parentCode: null },
  {
    accountCode: '217',
    accountName: 'Bất động sản đầu tư',
    accountType: 'asset',
    parentCode: null,
  },
  {
    accountCode: '221',
    accountName: 'Đầu tư vào công ty con',
    accountType: 'asset',
    parentCode: null,
  },
  { accountCode: '228', accountName: 'Đầu tư khác', accountType: 'asset', parentCode: null },
  {
    accountCode: '241',
    accountName: 'Xây dựng cơ bản dở dang',
    accountType: 'asset',
    parentCode: null,
  },
  { accountCode: '242', accountName: 'Chi phí trả trước', accountType: 'asset', parentCode: null },

  // NHÓM 3: NỢ PHẢI TRẢ
  {
    accountCode: '311',
    accountName: 'Vay và nợ thuê tài chính ngắn hạn',
    accountType: 'liability',
    parentCode: null,
  },
  {
    accountCode: '315',
    accountName: 'Nợ dài hạn đến hạn trả',
    accountType: 'liability',
    parentCode: null,
  },
  {
    accountCode: '331',
    accountName: 'Phải trả người bán',
    accountType: 'liability',
    parentCode: null,
  },
  {
    accountCode: '332',
    accountName: 'Thuế và các khoản phải nộp Nhà nước',
    accountType: 'liability',
    parentCode: null,
  },
  {
    accountCode: '333',
    accountName: 'Thuế và các khoản phải nộp Nhà nước',
    accountType: 'liability',
    parentCode: null,
  },
  {
    accountCode: '334',
    accountName: 'Phải trả người lao động',
    accountType: 'liability',
    parentCode: null,
  },
  {
    accountCode: '335',
    accountName: 'Chi phí phải trả',
    accountType: 'liability',
    parentCode: null,
  },
  {
    accountCode: '336',
    accountName: 'Phải trả nội bộ',
    accountType: 'liability',
    parentCode: null,
  },
  {
    accountCode: '338',
    accountName: 'Phải trả, phải nộp khác',
    accountType: 'liability',
    parentCode: null,
  },
  {
    accountCode: '341',
    accountName: 'Vay và nợ thuê tài chính dài hạn',
    accountType: 'liability',
    parentCode: null,
  },
  {
    accountCode: '343',
    accountName: 'Trái phiếu phát hành',
    accountType: 'liability',
    parentCode: null,
  },
  {
    accountCode: '344',
    accountName: 'Nhận ký quỹ, ký cược dài hạn',
    accountType: 'liability',
    parentCode: null,
  },
  {
    accountCode: '347',
    accountName: 'Thuế thu nhập hoãn lại phải trả',
    accountType: 'liability',
    parentCode: null,
  },
  {
    accountCode: '352',
    accountName: 'Dự phòng phải trả',
    accountType: 'liability',
    parentCode: null,
  },

  // NHÓM 4: VỐN CHỦ SỞ HỮU
  {
    accountCode: '411',
    accountName: 'Vốn đầu tư của chủ sở hữu',
    accountType: 'equity',
    parentCode: null,
  },
  {
    accountCode: '418',
    accountName: 'Các quỹ thuộc vốn chủ sở hữu',
    accountType: 'equity',
    parentCode: null,
  },
  { accountCode: '419', accountName: 'Cổ phiếu quỹ', accountType: 'equity', parentCode: null },
  {
    accountCode: '421',
    accountName: 'Lợi nhuận sau thuế chưa phân phối',
    accountType: 'equity',
    parentCode: null,
  },
  {
    accountCode: '441',
    accountName: 'Nguồn vốn đầu tư XDCB',
    accountType: 'equity',
    parentCode: null,
  },

  // NHÓM 5: DOANH THU
  {
    accountCode: '511',
    accountName: 'Doanh thu bán hàng và cung cấp dịch vụ',
    accountType: 'revenue',
    parentCode: null,
  },
  {
    accountCode: '515',
    accountName: 'Doanh thu hoạt động tài chính',
    accountType: 'revenue',
    parentCode: null,
  },
  {
    accountCode: '521',
    accountName: 'Các khoản giảm trừ doanh thu',
    accountType: 'revenue',
    parentCode: null,
  },

  // NHÓM 6: CHI PHÍ
  { accountCode: '611', accountName: 'Chi phí mua hàng', accountType: 'expense', parentCode: null },
  {
    accountCode: '621',
    accountName: 'Chi phí nguyên vật liệu trực tiếp',
    accountType: 'expense',
    parentCode: null,
  },
  {
    accountCode: '622',
    accountName: 'Chi phí nhân công trực tiếp',
    accountType: 'expense',
    parentCode: null,
  },
  {
    accountCode: '623',
    accountName: 'Chi phí sử dụng máy thi công',
    accountType: 'expense',
    parentCode: null,
  },
  {
    accountCode: '627',
    accountName: 'Chi phí sản xuất chung',
    accountType: 'expense',
    parentCode: null,
  },
  {
    accountCode: '631',
    accountName: 'Giá thành sản xuất',
    accountType: 'expense',
    parentCode: null,
  },
  { accountCode: '632', accountName: 'Giá vốn hàng bán', accountType: 'expense', parentCode: null },
  {
    accountCode: '635',
    accountName: 'Chi phí tài chính',
    accountType: 'expense',
    parentCode: null,
  },
  { accountCode: '641', accountName: 'Chi phí bán hàng', accountType: 'expense', parentCode: null },
  {
    accountCode: '642',
    accountName: 'Chi phí quản lý doanh nghiệp',
    accountType: 'expense',
    parentCode: null,
  },
  { accountCode: '711', accountName: 'Thu nhập khác', accountType: 'revenue', parentCode: null },
  { accountCode: '811', accountName: 'Chi phí khác', accountType: 'expense', parentCode: null },
  {
    accountCode: '821',
    accountName: 'Chi phí thuế thu nhập doanh nghiệp',
    accountType: 'expense',
    parentCode: null,
  },
];
