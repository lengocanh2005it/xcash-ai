/**
 * Seed nhiều doanh nghiệp demo đa dạng cho Partner Dashboard (Cas Partner).
 * Không đụng vào tenant thật của user hiện có — chỉ tạo thêm tenant mới với prefix email riêng.
 *
 * Chạy:
 *   pnpm --filter @xcash/backend run prisma:seed:partners
 *
 * Nguyên tắc "các con số phải khớp":
 * - Giá gói / quota lấy từ 1 nguồn duy nhất (PLAN_PRICE / PLAN_QUOTA), khớp bảng `plan_pricing`.
 * - subscription.pricePerMonth = PLAN_PRICE[plan]; payment_order.amount = PLAN_PRICE[plan của kỳ đó].
 * - Mọi DN đang hoạt động & trả phí đều có 1 payment ở tháng hiện tại → "thực thu tháng này" == MRR.
 * - Giao dịch "thu" (tiền vào, +) luôn ghi Có TK doanh thu (511); "chi" (tiền ra, −) luôn ghi Nợ TK
 *   chi phí (6xx) → doanh thu/chi phí trong báo cáo == tổng tiền vào/ra của các GD đã định khoản.
 */

import {
  type AccountType,
  type ClassificationType,
  PrismaClient,
  type SubscriptionPlan,
  type SubscriptionStatus,
  type TransactionStatus,
} from '@prisma/client';
import * as bcrypt from 'bcryptjs';
import { TT133_ACCOUNTS } from '../src/modules/chart-of-accounts/tt133-seed';

const prisma = new PrismaClient();

const EMAIL_SUFFIX = '@xcash-demo.vn';
const PASSWORD = 'Demo@12345';

const PARTNER_EMAIL = 'partner@xcash.ai';
const PARTNER_PASSWORD = 'Partner@123';
const PARTNER_NAME = 'Cas Partner Admin';

// Nguồn sự thật duy nhất về giá & quota — PHẢI khớp migration `add_plan_pricing`.
const PLAN_PRICE: Record<SubscriptionPlan, number> = {
  free: 0,
  starter: 299_000,
  pro: 799_000,
  enterprise: 2_500_000,
};
const PLAN_QUOTA: Record<SubscriptionPlan, number> = {
  free: 50,
  starter: 500,
  pro: 2_000,
  enterprise: 999_999,
};

// GD "thu" (tiền vào, +): luôn ghi Có TK doanh thu 511 → tính vào doanh thu.
const REVENUE_PAIRS: Array<{ debit: string; credit: string }> = [
  { debit: '112', credit: '511' },
  { debit: '111', credit: '511' },
];
// GD "chi" (tiền ra, −): luôn ghi Nợ TK chi phí 6xx → tính vào chi phí.
const EXPENSE_PAIRS: Array<{ debit: string; credit: string }> = [
  { debit: '642', credit: '112' },
  { debit: '627', credit: '112' },
  { debit: '641', credit: '112' },
  { debit: '635', credit: '112' },
  { debit: '632', credit: '112' },
];

const CONTENT_SAMPLES = {
  revenue: [
    'CK TIEN HANG THANG',
    'THANH TOAN DON HANG',
    'THU PHI DICH VU',
    'KHACH HANG TT DON HANG',
    'DOANH THU BAN LE',
  ],
  expense: [
    'TRA LUONG NHAN VIEN',
    'THANH TOAN HOA DON DIEN NUOC',
    'CHI PHI VAN CHUYEN',
    'CHI PHI MARKETING QUANG CAO',
    'TRA LAI VAY NGAN HANG',
    'THUE MAT BANG KINH DOANH',
  ],
};

const BANKS = [
  'Vietcombank',
  'Techcombank',
  'ACB',
  'BIDV',
  'MB Bank',
  'Sacombank',
  'VPBank',
  'TPBank',
  'HDBank',
];

interface PaymentHistoryEntry {
  monthsAgo: number;
  plan: SubscriptionPlan;
}

interface TenantSeedConfig {
  businessName: string;
  ownerName: string;
  slug: string;
  plan: SubscriptionPlan;
  status: SubscriptionStatus;
  monthlyTxCount: number;
  aiAccuracyTarget: number; // 0-100, % giao dịch auto-classify với confidence cao
  reviewPct: number; // % rơi vào review queue
  skippedPct: number;
  /**
   * Lịch sử thanh toán theo tháng. Quy ước:
   * - DN đang hoạt động & trả phí PHẢI có entry monthsAgo=0 với plan = plan hiện tại.
   * - DN bị khóa dừng thanh toán trước tháng hiện tại (không có monthsAgo=0).
   * - Gói Free không có payment.
   */
  paymentHistory: PaymentHistoryEntry[];
}

const TENANTS: TenantSeedConfig[] = [
  {
    businessName: 'Cửa hàng Tiện Lợi Mini Mart',
    ownerName: 'Trần Thị Mai',
    slug: 'minimart',
    plan: 'free',
    status: 'active',
    monthlyTxCount: 32,
    aiAccuracyTarget: 90,
    reviewPct: 8,
    skippedPct: 2,
    paymentHistory: [],
  },
  {
    businessName: 'Studio Ảnh Cưới Hạnh Phúc',
    ownerName: 'Nguyễn Hoàng Phúc',
    slug: 'hanhphuc-studio',
    plan: 'free',
    status: 'active',
    monthlyTxCount: 12,
    aiAccuracyTarget: 82,
    reviewPct: 15,
    skippedPct: 3,
    paymentHistory: [],
  },
  {
    businessName: 'Phòng khám Nha khoa Sài Gòn',
    ownerName: 'Lê Quang Đạt',
    slug: 'nhakhoa-saigon',
    plan: 'starter',
    status: 'active',
    monthlyTxCount: 410,
    aiAccuracyTarget: 88,
    reviewPct: 10,
    skippedPct: 2,
    paymentHistory: [
      { monthsAgo: 5, plan: 'starter' },
      { monthsAgo: 4, plan: 'starter' },
      { monthsAgo: 3, plan: 'starter' },
      { monthsAgo: 2, plan: 'starter' },
      { monthsAgo: 1, plan: 'starter' },
      { monthsAgo: 0, plan: 'starter' },
    ],
  },
  {
    businessName: 'Xưởng May Đồng Tâm',
    ownerName: 'Phạm Văn Tâm',
    slug: 'may-dongtam',
    plan: 'starter',
    status: 'suspended',
    monthlyTxCount: 180,
    aiAccuracyTarget: 70,
    reviewPct: 22,
    skippedPct: 8,
    // Bị khóa: dừng thanh toán 2 tháng trước, không có payment tháng này.
    paymentHistory: [
      { monthsAgo: 5, plan: 'starter' },
      { monthsAgo: 4, plan: 'starter' },
      { monthsAgo: 3, plan: 'starter' },
      { monthsAgo: 2, plan: 'starter' },
    ],
  },
  {
    businessName: 'Công ty Xây dựng Đại Phát',
    ownerName: 'Vũ Đại Phát',
    slug: 'daiphat-xd',
    plan: 'starter',
    status: 'active',
    monthlyTxCount: 340,
    aiAccuracyTarget: 84,
    reviewPct: 12,
    skippedPct: 3,
    paymentHistory: [
      { monthsAgo: 4, plan: 'starter' },
      { monthsAgo: 3, plan: 'starter' },
      { monthsAgo: 2, plan: 'starter' },
      { monthsAgo: 1, plan: 'starter' },
      { monthsAgo: 0, plan: 'starter' },
    ],
  },
  {
    businessName: 'Quán Cà phê Highlands Nhượng Quyền',
    ownerName: 'Đặng Minh Khoa',
    slug: 'highlands-nq',
    plan: 'pro',
    status: 'active',
    monthlyTxCount: 1750,
    aiAccuracyTarget: 93,
    reviewPct: 6,
    skippedPct: 1,
    // Nâng cấp Starter → Pro cách đây 3 tháng.
    paymentHistory: [
      { monthsAgo: 5, plan: 'starter' },
      { monthsAgo: 4, plan: 'starter' },
      { monthsAgo: 3, plan: 'pro' },
      { monthsAgo: 2, plan: 'pro' },
      { monthsAgo: 1, plan: 'pro' },
      { monthsAgo: 0, plan: 'pro' },
    ],
  },
  {
    businessName: 'Công ty TNHH Vận tải Phương Nam',
    ownerName: 'Bùi Thanh Phương',
    slug: 'phuongnam-vt',
    plan: 'pro',
    status: 'active',
    monthlyTxCount: 1850,
    aiAccuracyTarget: 91,
    reviewPct: 7,
    skippedPct: 2,
    paymentHistory: [
      { monthsAgo: 5, plan: 'pro' },
      { monthsAgo: 4, plan: 'pro' },
      { monthsAgo: 3, plan: 'pro' },
      { monthsAgo: 2, plan: 'pro' },
      { monthsAgo: 1, plan: 'pro' },
      { monthsAgo: 0, plan: 'pro' },
    ],
  },
  {
    businessName: 'Trường Mầm non Ánh Dương',
    ownerName: 'Hoàng Thị Ánh',
    slug: 'anhduong-mn',
    plan: 'pro',
    status: 'suspended',
    monthlyTxCount: 520,
    aiAccuracyTarget: 65,
    reviewPct: 25,
    skippedPct: 10,
    // Bị khóa: dừng thanh toán trước tháng này.
    paymentHistory: [
      { monthsAgo: 4, plan: 'pro' },
      { monthsAgo: 3, plan: 'pro' },
    ],
  },
  {
    businessName: 'Chuỗi Nhà thuốc Long Châu Mini',
    ownerName: 'Ngô Long Châu',
    slug: 'longchau-mini',
    plan: 'enterprise',
    status: 'active',
    monthlyTxCount: 4800,
    aiAccuracyTarget: 95,
    reviewPct: 4,
    skippedPct: 1,
    // Nâng cấp Pro → Enterprise cách đây 3 tháng.
    paymentHistory: [
      { monthsAgo: 5, plan: 'pro' },
      { monthsAgo: 4, plan: 'pro' },
      { monthsAgo: 3, plan: 'enterprise' },
      { monthsAgo: 2, plan: 'enterprise' },
      { monthsAgo: 1, plan: 'enterprise' },
      { monthsAgo: 0, plan: 'enterprise' },
    ],
  },
  {
    businessName: 'Công ty CP Bán lẻ Sài Gòn Xanh',
    ownerName: 'Trương Gia Bảo',
    slug: 'saigonxanh',
    plan: 'enterprise',
    status: 'active',
    monthlyTxCount: 3600,
    aiAccuracyTarget: 89,
    reviewPct: 9,
    skippedPct: 2,
    paymentHistory: [
      { monthsAgo: 5, plan: 'enterprise' },
      { monthsAgo: 4, plan: 'enterprise' },
      { monthsAgo: 3, plan: 'enterprise' },
      { monthsAgo: 2, plan: 'enterprise' },
      { monthsAgo: 1, plan: 'enterprise' },
      { monthsAgo: 0, plan: 'enterprise' },
    ],
  },
];

function randomInt(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function pick<T>(arr: T[]): T {
  return arr[randomInt(0, arr.length - 1)];
}

function randomDayThisMonth(): Date {
  const now = new Date();
  const start = new Date(now.getFullYear(), now.getMonth(), 1);
  const daysElapsed = Math.max(1, now.getDate());
  const day = randomInt(1, daysElapsed);
  const d = new Date(start);
  d.setDate(day);
  d.setHours(randomInt(7, 20), randomInt(0, 59), 0, 0);
  return d;
}

function dateMonthsAgo(monthsAgo: number, day: number): Date {
  const now = new Date();
  const safeDay = monthsAgo === 0 ? Math.min(day, now.getDate()) : day;
  return new Date(now.getFullYear(), now.getMonth() - monthsAgo, safeDay, 10, 0, 0);
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

async function seedTenant(config: TenantSeedConfig): Promise<void> {
  const email = `admin.${config.slug}${EMAIL_SUFFIX}`;
  const existingUser = await prisma.user.findUnique({ where: { email } });

  const pricePerMonth = PLAN_PRICE[config.plan];
  const transactionQuota = PLAN_QUOTA[config.plan];

  let tenantId: string;
  let adminUserId: string;

  if (existingUser?.tenantId) {
    tenantId = existingUser.tenantId;
    adminUserId = existingUser.id;
    console.log(`↺ Tenant đã tồn tại, cập nhật lại dữ liệu: ${config.businessName}`);

    await prisma.transactionClassification.deleteMany({ where: { tenantId } });
    await prisma.transaction.deleteMany({ where: { tenantId } });
    await prisma.paymentOrder.deleteMany({ where: { tenantId } });
    await prisma.subscription.deleteMany({ where: { tenantId } });
  } else {
    const passwordHash = await bcrypt.hash(PASSWORD, 12);
    const tenant = await prisma.tenant.create({
      data: { businessName: config.businessName, ownerName: config.ownerName },
    });
    const adminUser = await prisma.user.create({
      data: {
        tenantId: tenant.id,
        name: config.ownerName,
        email,
        passwordHash,
        role: 'admin',
      },
    });
    tenantId = tenant.id;
    adminUserId = adminUser.id;
    console.log(`✚ Tạo tenant mới: ${config.businessName}`);
  }

  await ensureChartOfAccounts(tenantId);

  const cycleEnd = new Date();
  cycleEnd.setMonth(cycleEnd.getMonth() + 1);
  cycleEnd.setDate(1);

  await prisma.subscription.create({
    data: {
      tenantId,
      plan: config.plan,
      pricePerMonth,
      transactionQuota,
      transactionUsedThisCycle: Math.min(config.monthlyTxCount, transactionQuota),
      status: config.status,
      currentCycleEnd: cycleEnd,
    },
  });

  const existingGrant = await prisma.casGrant.findFirst({ where: { tenantId } });
  if (!existingGrant) {
    await prisma.casGrant.create({
      data: {
        tenantId,
        grantId: `demo-grant-${config.slug}`,
        accessToken: 'demo-access-token',
        accountNumber: String(randomInt(1_000_000_000, 9_999_999_999)),
        accountHolderName: config.businessName.toUpperCase(),
        bankName: pick(BANKS),
        status: 'active',
      },
    });
  }

  for (const p of config.paymentHistory) {
    const paidDate = dateMonthsAgo(p.monthsAgo, randomInt(1, 27));
    await prisma.paymentOrder.create({
      data: {
        tenantId,
        orderCode: `SEED-${config.slug}-${p.monthsAgo}`,
        targetPlan: p.plan,
        amount: PLAN_PRICE[p.plan],
        status: 'paid',
        paidAt: paidDate,
        createdAt: paidDate,
      },
    });
  }

  const txData = Array.from({ length: config.monthlyTxCount }).map((_, i) => {
    const roll = Math.random() * 100;
    const isReview = roll < config.reviewPct;
    const isSkipped = !isReview && roll < config.reviewPct + config.skippedPct;
    const isRevenue = Math.random() < 0.45;
    const pair = isRevenue ? pick(REVENUE_PAIRS) : pick(EXPENSE_PAIRS);
    const content = pick(isRevenue ? CONTENT_SAMPLES.revenue : CONTENT_SAMPLES.expense);
    // Tiền vào (+) cho doanh thu; tiền ra (−) cho chi phí — dấu khớp với loại TK.
    const amount = isRevenue ? randomInt(1_000_000, 20_000_000) : -randomInt(200_000, 12_000_000);
    const txDate = randomDayThisMonth();

    let status: TransactionStatus;
    if (isSkipped) status = 'skipped';
    else if (isReview) status = 'review';
    else status = 'classified';

    return {
      tenantId,
      grantId: `demo-grant-${config.slug}`,
      transactionId: `partner-seed-${config.slug}-${i}`,
      amount,
      senderAccount: isRevenue ? 'KHACH HANG' : content,
      receiverAccount: '0000000000',
      content: `${content} ${i}`,
      transactionDate: txDate,
      createdAt: txDate,
      status,
      _debit: pair.debit,
      _credit: pair.credit,
      _amount: Math.abs(amount),
    };
  });

  const CHUNK = 200;
  for (let i = 0; i < txData.length; i += CHUNK) {
    const chunk = txData.slice(i, i + CHUNK);
    const created = await prisma.transaction.createManyAndReturn({
      data: chunk.map(({ _debit, _credit, _amount, ...rest }) => rest),
    });

    const classifications = created.map((tx, idx) => {
      const meta = chunk[idx];
      const highConfidence = Math.random() * 100 < config.aiAccuracyTarget;
      const confidenceScore =
        tx.status === 'review'
          ? randomInt(50, 84)
          : highConfidence
            ? randomInt(85, 99)
            : randomInt(60, 84);
      const isManual = tx.status === 'classified' && Math.random() < 0.08;

      return {
        tenantId,
        transactionId: tx.id,
        debitAccount: meta._debit,
        creditAccount: meta._credit,
        amount: meta._amount,
        confidenceScore,
        classificationType: (isManual ? 'manual' : 'auto') as ClassificationType,
        classifiedBy: isManual ? adminUserId : 'ai',
        reason: isManual ? 'Kế toán xác nhận thủ công.' : 'AI tự động phân loại theo mẫu TT133.',
        status: tx.status,
        createdAt: tx.createdAt,
      };
    });

    await prisma.transactionClassification.createMany({ data: classifications });
  }

  console.log(
    `  → ${config.monthlyTxCount} giao dịch, gói ${config.plan} (${config.status}), ${config.paymentHistory.length} kỳ thanh toán`,
  );
}

async function ensureCasPartnerAccount(): Promise<void> {
  const email = PARTNER_EMAIL.toLowerCase();
  const passwordHash = await bcrypt.hash(PARTNER_PASSWORD, 12);

  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) {
    await prisma.user.update({
      where: { email },
      data: { name: PARTNER_NAME, passwordHash, role: 'cas_partner', tenantId: null },
    });
    console.log(`↺ Tài khoản Cas Partner đã tồn tại, cập nhật lại: ${email}`);
  } else {
    await prisma.user.create({
      data: {
        name: PARTNER_NAME,
        email,
        passwordHash,
        role: 'cas_partner',
        tenantId: null,
      },
    });
    console.log(`✚ Đã tạo tài khoản Cas Partner demo: ${email}`);
  }
}

async function main(): Promise<void> {
  console.log(`🌱 Seeding ${TENANTS.length} doanh nghiệp demo cho Partner Dashboard...\n`);

  for (const config of TENANTS) {
    await seedTenant(config);
  }

  await ensureCasPartnerAccount();

  // Kiểm chứng "các con số phải khớp": MRR (giá gói DN đang hoạt động) == thực thu tháng hiện tại.
  const activeMrr = TENANTS.filter((t) => t.status === 'active').reduce(
    (sum, t) => sum + PLAN_PRICE[t.plan],
    0,
  );
  const paidThisMonth = TENANTS.reduce(
    (sum, t) =>
      sum +
      t.paymentHistory.filter((p) => p.monthsAgo === 0).reduce((s, p) => s + PLAN_PRICE[p.plan], 0),
    0,
  );
  console.log(`\n📊 MRR (DN đang hoạt động): ${activeMrr.toLocaleString('vi-VN')}đ/tháng`);
  console.log(`📊 Thực thu tháng này: ${paidThisMonth.toLocaleString('vi-VN')}đ`);
  console.log(
    activeMrr === paidThisMonth
      ? '✅ MRR khớp thực thu tháng hiện tại.'
      : '⚠️  MRR KHÔNG khớp thực thu — kiểm tra lại paymentHistory monthsAgo=0.',
  );

  console.log(`\n🔑 Tài khoản Cas Partner: ${PARTNER_EMAIL} / ${PARTNER_PASSWORD}`);
  console.log('\n🎉 Xong — đăng nhập bằng tài khoản Cas Partner để xem Partner Dashboard.');
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
