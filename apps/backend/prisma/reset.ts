/**
 * Xoá sạch dữ liệu trong TẤT CẢ các bảng (về trạng thái trắng), rồi khôi phục lại
 * bảng cấu hình `plan_pricing` với giá mặc định để billing/upgrade vẫn hoạt động.
 *
 * Dùng trước khi seed lại demo:
 *   pnpm --filter @xcash/backend run prisma:reset
 *   pnpm --filter @xcash/backend run prisma:seed:partners
 *   pnpm --filter @xcash/backend run prisma:seed:demo
 *
 * ⚠️  CẢNH BÁO: xoá toàn bộ tenant/user/giao dịch/thanh toán thật lẫn demo. Không hoàn tác được.
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

// Giá & quota mặc định — PHẢI khớp migration `add_plan_pricing` và seed demo.
const DEFAULT_PLAN_PRICING = [
  {
    plan: 'free' as const,
    pricePerMonth: 0,
    transactionQuota: 50,
    overagePricePerTransaction: null,
  },
  {
    plan: 'starter' as const,
    pricePerMonth: 299_000,
    transactionQuota: 500,
    overagePricePerTransaction: 800,
  },
  {
    plan: 'pro' as const,
    pricePerMonth: 799_000,
    transactionQuota: 2_000,
    overagePricePerTransaction: 600,
  },
  {
    plan: 'enterprise' as const,
    pricePerMonth: 2_500_000,
    transactionQuota: 999_999,
    overagePricePerTransaction: null,
  },
];

async function main(): Promise<void> {
  console.log('🗑️  Đang xoá sạch dữ liệu tất cả các bảng...\n');

  // Xoá theo thứ tự an toàn khoá ngoại: bảng con trước, bảng cha sau.
  const steps: Array<[string, () => Promise<{ count: number }>]> = [
    ['transaction_classifications', () => prisma.transactionClassification.deleteMany()],
    ['transactions', () => prisma.transaction.deleteMany()],
    ['payment_orders', () => prisma.paymentOrder.deleteMany()],
    ['usage_logs', () => prisma.usageLog.deleteMany()],
    ['audit_logs', () => prisma.auditLog.deleteMany()],
    ['subscriptions', () => prisma.subscription.deleteMany()],
    ['cas_grants', () => prisma.casGrant.deleteMany()],
    ['chart_of_accounts', () => prisma.chartOfAccount.deleteMany()],
    ['users', () => prisma.user.deleteMany()],
    ['tenants', () => prisma.tenant.deleteMany()],
    ['plan_pricing', () => prisma.planPricing.deleteMany()],
  ];

  for (const [name, run] of steps) {
    const { count } = await run();
    console.log(`   - ${name}: xoá ${count} bản ghi`);
  }

  console.log('\n♻️  Khôi phục cấu hình giá gói mặc định (plan_pricing)...');
  for (const p of DEFAULT_PLAN_PRICING) {
    await prisma.planPricing.create({ data: p });
  }
  console.log(`   - plan_pricing: tạo lại ${DEFAULT_PLAN_PRICING.length} gói`);

  console.log('\n✅ Đã xoá sạch dữ liệu. Giờ có thể chạy seed lại.');
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
