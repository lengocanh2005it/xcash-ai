/**
 * Seed dữ liệu demo đa dạng cho 1 tenant (giao dịch + định khoản TT133).
 *
 * Chạy:
 *   pnpm --filter @xcash/backend run prisma:seed:demo
 *   pnpm --filter @xcash/backend run prisma:seed:demo -- lengocanhpyne363@gmail.com
 */
import {
  type AccountType,
  type ClassificationType,
  PrismaClient,
  type TransactionStatus,
} from '@prisma/client';
import { TT133_ACCOUNTS } from '../src/modules/chart-of-accounts/tt133-seed';

const prisma = new PrismaClient();

const SEED_PREFIX = 'demo-seed-';
const DEFAULT_EMAIL = 'lengocanhpyne363@gmail.com';

interface SeedClassification {
  debitAccount: string;
  creditAccount: string;
  confidenceScore: number;
  classificationType: ClassificationType;
  classifiedBy: string;
  reason: string;
  status: TransactionStatus;
}

interface SeedTransaction {
  key: string;
  content: string;
  /** Tên đối tác giao dịch (giống counterAccountName từ Cas webhook) */
  sender: string;
  amount: number;
  daysAgo: number;
  status: TransactionStatus;
  classification?: SeedClassification;
}

const DEMO_TRANSACTIONS: SeedTransaction[] = [
  // --- Thu (doanh thu) — đã định khoản tự động ---
  {
    key: 'rev-abc',
    content: 'CONG TY ABC CK TIEN HANG THANG 6',
    sender: 'CONG TY TNHH ABC',
    amount: 15_000_000,
    daysAgo: 0,
    status: 'classified',
    classification: {
      debitAccount: '112',
      creditAccount: '511',
      confidenceScore: 92,
      classificationType: 'auto',
      classifiedBy: 'ai',
      reason: 'Nội dung chứa "TIEN HANG" — doanh thu bán hàng, ghi Có 511.',
      status: 'classified',
    },
  },
  {
    key: 'rev-xyz',
    content: 'KHACH HANG XYZ TT DON HANG DH240601',
    sender: 'CONG TY XYZ',
    amount: 8_500_000,
    daysAgo: 2,
    status: 'classified',
    classification: {
      debitAccount: '112',
      creditAccount: '511',
      confidenceScore: 88,
      classificationType: 'auto',
      classifiedBy: 'ai',
      reason: 'Thanh toán đơn hàng từ khách — doanh thu.',
      status: 'classified',
    },
  },
  {
    key: 'rev-service',
    content: 'THU PHI DICH VU TU CONG TY DEF',
    sender: 'CONG TY DEF',
    amount: 4_200_000,
    daysAgo: 4,
    status: 'classified',
    classification: {
      debitAccount: '112',
      creditAccount: '511',
      confidenceScore: 90,
      classificationType: 'auto',
      classifiedBy: 'ai',
      reason: 'Thu phí dịch vụ — doanh thu.',
      status: 'classified',
    },
  },
  // --- Chi phí — đã định khoản tự động ---
  {
    key: 'exp-salary',
    content: 'TRA LUONG NV THANG 6',
    sender: 'CHI LUONG NHAN VIEN',
    amount: -45_000_000,
    daysAgo: 3,
    status: 'classified',
    classification: {
      debitAccount: '334',
      creditAccount: '112',
      confidenceScore: 95,
      classificationType: 'auto',
      classifiedBy: 'ai',
      reason: 'Chi lương nhân viên — Nợ 334 Phải trả NLĐ.',
      status: 'classified',
    },
  },
  {
    key: 'exp-electric',
    content: 'THANH TOAN HOA DON DIEN EVN THANG 6',
    sender: 'CONG TY DIEN LUC EVN',
    amount: -3_200_000,
    daysAgo: 5,
    status: 'classified',
    classification: {
      debitAccount: '627',
      creditAccount: '112',
      confidenceScore: 91,
      classificationType: 'auto',
      classifiedBy: 'ai',
      reason: 'Hóa đơn điện — chi phí quản lý doanh nghiệp.',
      status: 'classified',
    },
  },
  {
    key: 'exp-office',
    content: 'MUA VAN PHONG PHAM FAHASA',
    sender: 'NHA SACH FAHASA',
    amount: -1_250_000,
    daysAgo: 6,
    status: 'classified',
    classification: {
      debitAccount: '642',
      creditAccount: '112',
      confidenceScore: 87,
      classificationType: 'auto',
      classifiedBy: 'ai',
      reason: 'Văn phòng phẩm — chi phí quản lý.',
      status: 'classified',
    },
  },
  {
    key: 'exp-shipping',
    content: 'CHI PHI VAN CHUYEN GHTK T6',
    sender: 'GIAO HANG TIET KIEM',
    amount: -890_000,
    daysAgo: 7,
    status: 'classified',
    classification: {
      debitAccount: '641',
      creditAccount: '112',
      confidenceScore: 86,
      classificationType: 'auto',
      classifiedBy: 'ai',
      reason: 'Phí vận chuyển — chi phí bán hàng.',
      status: 'classified',
    },
  },
  {
    key: 'exp-tax',
    content: 'NOP THUE GTGT QUY 2/2026',
    sender: 'KHO BAC NHA NUOC',
    amount: -12_000_000,
    daysAgo: 8,
    status: 'classified',
    classification: {
      debitAccount: '333',
      creditAccount: '112',
      confidenceScore: 93,
      classificationType: 'auto',
      classifiedBy: 'ai',
      reason: 'Nộp thuế GTGT — Nợ 333.',
      status: 'classified',
    },
  },
  {
    key: 'exp-interest',
    content: 'TRA LAI VAY NGAN HANG VCB',
    sender: 'NGAN HANG VIETCOMBANK',
    amount: -2_100_000,
    daysAgo: 9,
    status: 'classified',
    classification: {
      debitAccount: '635',
      creditAccount: '112',
      confidenceScore: 89,
      classificationType: 'auto',
      classifiedBy: 'ai',
      reason: 'Chi phí lãi vay.',
      status: 'classified',
    },
  },
  // --- Human Review queue (confidence < 85%) ---
  {
    key: 'review-transfer',
    content: 'CK TU NGUYEN VAN A CHUYEN KHOAN',
    sender: 'NGUYEN VAN A',
    amount: 5_000_000,
    daysAgo: 0,
    status: 'review',
    classification: {
      debitAccount: '112',
      creditAccount: '131',
      confidenceScore: 72,
      classificationType: 'auto',
      classifiedBy: 'ai',
      reason: 'Không rõ là thu nợ hay doanh thu — cần kế toán xác nhận.',
      status: 'review',
    },
  },
  {
    key: 'review-unknown',
    content: 'TT CHUA RO NOI DUNG GD',
    sender: 'KHONG RO',
    amount: -500_000,
    daysAgo: 0,
    status: 'review',
    classification: {
      debitAccount: '642',
      creditAccount: '112',
      confidenceScore: 65,
      classificationType: 'auto',
      classifiedBy: 'ai',
      reason: 'Nội dung mơ hồ, không khớp mẫu TT133 rõ ràng.',
      status: 'review',
    },
  },
  {
    key: 'review-refund',
    content: 'HOAN TIEN KHACH HANG LE',
    sender: 'KHACH HANG LE',
    amount: -1_100_000,
    daysAgo: 1,
    status: 'review',
    classification: {
      debitAccount: '511',
      creditAccount: '112',
      confidenceScore: 58,
      classificationType: 'auto',
      classifiedBy: 'ai',
      reason: 'Có thể là giảm doanh thu hoặc chi phí khác — cần review.',
      status: 'review',
    },
  },
  {
    key: 'review-rent',
    content: 'TT TIEN THUE MAT BANG Q2',
    sender: 'CONG TY BAT DONG SAN',
    amount: -18_000_000,
    daysAgo: 2,
    status: 'review',
    classification: {
      debitAccount: '627',
      creditAccount: '112',
      confidenceScore: 78,
      classificationType: 'auto',
      classifiedBy: 'ai',
      reason: 'Thuê mặt bằng — gần ngưỡng 85%, nên xác nhận TK chi phí.',
      status: 'review',
    },
  },
  // --- Định khoản thủ công (kế toán đã sửa) ---
  {
    key: 'manual-fix',
    content: 'THU TIEN MAT KHACH LE KHONG CO HD',
    sender: 'KHACH LE',
    amount: 2_000_000,
    daysAgo: 3,
    status: 'classified',
    classification: {
      debitAccount: '111',
      creditAccount: '511',
      confidenceScore: 100,
      classificationType: 'manual',
      classifiedBy: 'user',
      reason: 'Kế toán xác nhận thu tiền mặt — ghi Nợ 111.',
      status: 'classified',
    },
  },
  // --- Bỏ qua ---
  {
    key: 'skipped-dup',
    content: 'GD TRUNG LAP BO QUA',
    sender: 'KHONG RO',
    amount: -100_000,
    daysAgo: 10,
    status: 'skipped',
    classification: {
      debitAccount: '642',
      creditAccount: '112',
      confidenceScore: 40,
      classificationType: 'auto',
      classifiedBy: 'ai',
      reason: 'Giao dịch trùng lặp — kế toán bỏ qua.',
      status: 'skipped',
    },
  },
  // --- Chờ AI xử lý ---
  {
    key: 'pending-new',
    content: 'GD MOI VUA NHAN CHO AI XU LY',
    sender: 'KHACH HANG MOI',
    amount: 3_500_000,
    daysAgo: 0,
    status: 'pending',
  },
  {
    key: 'pending-out',
    content: 'CHI PHI QUANG CAO FACEBOOK T7',
    sender: 'FACEBOOK ADS',
    amount: -2_800_000,
    daysAgo: 0,
    status: 'pending',
  },
  // --- Tháng trước (cho báo cáo) ---
  {
    key: 'prev-rev',
    content: 'DOANH THU BAN HANG THANG 5',
    sender: 'CONG TY TNHH ABC',
    amount: 22_000_000,
    daysAgo: 35,
    status: 'classified',
    classification: {
      debitAccount: '112',
      creditAccount: '511',
      confidenceScore: 94,
      classificationType: 'auto',
      classifiedBy: 'ai',
      reason: 'Doanh thu tháng 5.',
      status: 'classified',
    },
  },
  {
    key: 'prev-salary',
    content: 'TRA LUONG NV THANG 5',
    sender: 'CHI LUONG NHAN VIEN',
    amount: -42_000_000,
    daysAgo: 38,
    status: 'classified',
    classification: {
      debitAccount: '334',
      creditAccount: '112',
      confidenceScore: 96,
      classificationType: 'auto',
      classifiedBy: 'ai',
      reason: 'Lương tháng 5.',
      status: 'classified',
    },
  },
  {
    key: 'prev-rent',
    content: 'THANH TOAN TIEN THUE VP THANG 5',
    sender: 'CONG TY CHO THUE VP',
    amount: -15_000_000,
    daysAgo: 40,
    status: 'classified',
    classification: {
      debitAccount: '627',
      creditAccount: '112',
      confidenceScore: 90,
      classificationType: 'auto',
      classifiedBy: 'ai',
      reason: 'Thuê văn phòng tháng 5.',
      status: 'classified',
    },
  },
  {
    key: 'prev-supplies',
    content: 'MUA NGUYEN LIEU SAN XUAT',
    sender: 'NHA CUNG CAP NVL',
    amount: -9_500_000,
    daysAgo: 42,
    status: 'classified',
    classification: {
      debitAccount: '152',
      creditAccount: '112',
      confidenceScore: 88,
      classificationType: 'auto',
      classifiedBy: 'ai',
      reason: 'Mua nguyên liệu — Nợ 152.',
      status: 'classified',
    },
  },
];

function daysAgoDate(daysAgo: number): Date {
  const d = new Date();
  d.setHours(10, 30, 0, 0);
  d.setDate(d.getDate() - daysAgo);
  return d;
}

async function ensureChartOfAccounts(tenantId: string): Promise<void> {
  const count = await prisma.chartOfAccount.count({ where: { tenantId } });
  if (count > 0) return;

  await prisma.chartOfAccount.createMany({
    data: TT133_ACCOUNTS.map((a) => ({
      tenantId,
      accountCode: a.accountCode,
      accountName: a.accountName,
      accountType: a.accountType as AccountType,
      parentCode: a.parentCode,
      isActive: true,
    })),
    skipDuplicates: true,
  });
}

async function ensureCasGrant(tenantId: string): Promise<string> {
  const existing = await prisma.casGrant.findFirst({
    where: { tenantId, status: 'active' },
  });
  if (existing) return existing.grantId;

  const grant = await prisma.casGrant.create({
    data: {
      tenantId,
      grantId: `demo-grant-${tenantId.slice(0, 8)}`,
      accessToken: 'demo-access-token',
      accountNumber: '1903658888',
      accountHolderName: 'CONG TY TNHH DEMO X-CASH',
      bankName: 'Vietcombank',
      bankLogo: null,
      status: 'active',
    },
  });
  return grant.grantId;
}

async function clearPreviousSeed(tenantId: string): Promise<number> {
  const seeded = await prisma.transaction.findMany({
    where: { tenantId, transactionId: { startsWith: SEED_PREFIX } },
    select: { id: true },
  });
  if (seeded.length === 0) return 0;

  const ids = seeded.map((t) => t.id);
  await prisma.transactionClassification.deleteMany({
    where: { transactionId: { in: ids } },
  });
  await prisma.transaction.deleteMany({ where: { id: { in: ids } } });
  return seeded.length;
}

async function seedTransactions(
  tenantId: string,
  grantId: string,
  userId: string,
): Promise<{ created: number; byStatus: Record<string, number> }> {
  const byStatus: Record<string, number> = {};
  let created = 0;

  for (const item of DEMO_TRANSACTIONS) {
    const transactionDate = daysAgoDate(item.daysAgo);
    const absAmount = Math.abs(item.amount);

    const tx = await prisma.transaction.create({
      data: {
        tenantId,
        grantId,
        transactionId: `${SEED_PREFIX}${item.key}`,
        amount: item.amount,
        senderAccount: item.sender,
        receiverAccount: item.amount >= 0 ? '1903658888' : '9876543210',
        content: item.content,
        transactionDate,
        status: item.status,
      },
    });

    if (item.classification) {
      const c = item.classification;
      await prisma.transactionClassification.create({
        data: {
          tenantId,
          transactionId: tx.id,
          debitAccount: c.debitAccount,
          creditAccount: c.creditAccount,
          amount: absAmount,
          confidenceScore: c.confidenceScore,
          classificationType: c.classificationType,
          classifiedBy: c.classificationType === 'manual' ? userId : c.classifiedBy,
          reason: c.reason,
          status: c.status,
        },
      });
    }

    byStatus[item.status] = (byStatus[item.status] ?? 0) + 1;
    created++;
  }

  return { created, byStatus };
}

async function main(): Promise<void> {
  const email = (process.argv[2] ?? DEFAULT_EMAIL).toLowerCase();

  const user = await prisma.user.findUnique({
    where: { email },
    include: { tenant: true },
  });

  if (!user?.tenantId) {
    console.error(`❌ Không tìm thấy user với email "${email}" hoặc chưa có tenant.`);
    console.error('   Hãy đăng ký tài khoản trước, rồi chạy lại seed.');
    process.exit(1);
  }

  const tenantId = user.tenantId;
  console.log(`📧 User: ${user.name} <${user.email}>`);
  console.log(`🏢 Tenant: ${user.tenant?.businessName ?? tenantId}`);

  await ensureChartOfAccounts(tenantId);
  const grantId = await ensureCasGrant(tenantId);

  const removed = await clearPreviousSeed(tenantId);
  if (removed > 0) {
    console.log(`🗑️  Đã xóa ${removed} giao dịch seed cũ.`);
  }

  const { created, byStatus } = await seedTransactions(tenantId, grantId, user.id);

  console.log(`✅ Đã seed ${created} giao dịch demo:`);
  for (const [status, count] of Object.entries(byStatus)) {
    console.log(`   - ${status}: ${count}`);
  }
  console.log(`   Danh mục TK TT133: OK | Cas grant: ${grantId}`);
  console.log('🎉 Xong — đăng nhập và xem Dashboard / Review / Báo cáo.');
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
