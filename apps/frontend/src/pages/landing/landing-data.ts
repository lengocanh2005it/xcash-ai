import { SubscriptionPlan } from '@xcash/shared-types';
import type { LucideIcon } from 'lucide-react';
import {
  ArrowRightLeft,
  Bot,
  FileSpreadsheet,
  ShieldCheck,
  Sparkles,
  UserCheck,
  Zap,
} from 'lucide-react';
import { formatCopilotQuota, formatTransactionQuota, PLAN_LABEL } from '@/lib/plan';

export interface LandingPlan {
  plan: SubscriptionPlan;
  pricePerMonth: number;
  transactionQuota: number;
  copilotQuota: number;
  overageHint?: string;
  highlight?: boolean;
  features: string[];
}

export const LANDING_PLANS: LandingPlan[] = [
  {
    plan: SubscriptionPlan.FREE,
    pricePerMonth: 0,
    transactionQuota: 50,
    copilotQuota: 0,
    features: [
      'Liên kết ngân hàng Cas Link',
      'AI định khoản TT133',
      'Dashboard & Human Review',
      'Danh mục tài khoản TT133',
    ],
  },
  {
    plan: SubscriptionPlan.STARTER,
    pricePerMonth: 299_000,
    transactionQuota: 500,
    copilotQuota: 200,
    overageHint: 'Phí vượt 800đ/GD',
    features: [
      'Mọi tính năng gói Free',
      'AI Copilot hỏi đáp tài chính',
      'Phân tích thu/chi nâng cao',
      'Thông báo qua Email',
    ],
  },
  {
    plan: SubscriptionPlan.PRO,
    pricePerMonth: 799_000,
    transactionQuota: 2_000,
    copilotQuota: 1000,
    overageHint: 'Phí vượt 600đ/GD',
    highlight: true,
    features: [
      'Mọi tính năng gói Starter',
      'Báo cáo & xuất Excel',
      'Thông báo qua Slack',
      'Vượt quota có phí linh hoạt',
    ],
  },
  {
    plan: SubscriptionPlan.ENTERPRISE,
    pricePerMonth: 2_500_000,
    transactionQuota: 999_999,
    copilotQuota: -1,
    features: [
      'Mọi tính năng gói Pro',
      'Giao dịch & Copilot không giới hạn',
      'Hỗ trợ ưu tiên từ Cas Partner',
      'Đồng hành triển khai doanh nghiệp',
    ],
  },
];

export const DEMO_TRANSACTIONS = [
  {
    content: 'CONG TY ABC CK TIEN HANG THANG 6',
    amount: '+15.800.000đ',
    debit: '112',
    credit: '511',
    label: 'Doanh thu bán hàng',
    confidence: 94,
  },
  {
    content: 'THANH TOAN HOA DON DIEN THANG 6',
    amount: '-2.450.000đ',
    debit: '627',
    credit: '112',
    label: 'Chi phí điện',
    confidence: 91,
  },
  {
    content: 'TRA LUONG NV NGUYEN VAN A',
    amount: '-12.000.000đ',
    debit: '334',
    credit: '112',
    label: 'Chi phí lương',
    confidence: 88,
  },
  {
    content: 'MUA VAN PHONG PHAM',
    amount: '-850.000đ',
    debit: '642',
    credit: '112',
    label: 'Chi phí văn phòng phẩm',
    confidence: 86,
  },
] as const;

export const LANDING_STEPS = [
  {
    step: '01',
    title: 'Kết nối ngân hàng',
    description:
      'Liên kết tài khoản ngân hàng một lần — giao dịch tự động đổ về ngay khi phát sinh, không cần nhập tay hay tải file.',
  },
  {
    step: '02',
    title: 'AI tự động định khoản',
    description:
      'AI đọc nội dung giao dịch và gợi ý tài khoản Nợ/Có theo chuẩn kế toán TT133. Giao dịch rõ ràng được ghi nhận tự động.',
  },
  {
    step: '03',
    title: 'Xác nhận & báo cáo',
    description:
      'Kế toán xác nhận hoặc sửa các mục chưa chắc chắn. Cuối tháng xuất báo cáo Excel đầy đủ chỉ với một cú nhấp.',
  },
] as const;

export interface LandingFeature {
  icon: LucideIcon;
  title: string;
  description: string;
  className?: string;
}

export const LANDING_FEATURES: LandingFeature[] = [
  {
    icon: Sparkles,
    title: 'AI định khoản thông minh',
    description:
      'AI học từ chính lịch sử định khoản của doanh nghiệp bạn — càng dùng lâu càng hiểu và càng chính xác.',
    className: 'md:col-span-2',
  },
  {
    icon: UserCheck,
    title: 'Kế toán duyệt lại',
    description:
      'Hàng chờ xét duyệt trực quan — vuốt để xác nhận trên điện thoại, sửa nhanh trên máy tính.',
  },
  {
    icon: FileSpreadsheet,
    title: 'Báo cáo Excel',
    description: 'Tổng hợp thu/chi theo từng tài khoản TT133, xuất file Excel chỉ với một cú nhấp.',
  },
  {
    icon: Bot,
    title: 'Trợ lý AI',
    description:
      'Hỏi đáp tự nhiên: "Tháng này chi nhiều nhất vào đâu?" — trả lời ngay từ số liệu thật.',
  },
  {
    icon: ArrowRightLeft,
    title: 'Đồng bộ tức thì',
    description:
      'Giao dịch từ ngân hàng được cập nhật ngay khi phát sinh — không bỏ sót, không trùng lặp.',
  },
  {
    icon: ShieldCheck,
    title: 'Bảo mật & phân quyền',
    description:
      'Dữ liệu mỗi doanh nghiệp tách biệt hoàn toàn, phân quyền rõ ràng cho từng vai trò trong đội ngũ kế toán.',
    className: 'md:col-span-2',
  },
  {
    icon: Zap,
    title: 'Dùng được ngay',
    description:
      'Không cần dữ liệu lịch sử — hoạt động ngay từ giao dịch đầu tiên sau khi kết nối.',
  },
];

export function planDisplayName(plan: SubscriptionPlan): string {
  return PLAN_LABEL[plan];
}

export { formatCopilotQuota, formatTransactionQuota as formatPlanQuota };

export interface LandingStat {
  value: string;
  label: string;
}

export const LANDING_STATS: LandingStat[] = [
  { value: '80%', label: 'Giảm thời gian nhập liệu thủ công' },
  { value: '< 3 giây', label: 'AI định khoản mỗi giao dịch' },
  { value: 'TT133', label: 'Đúng chuẩn kế toán cho SME' },
  { value: '24/7', label: 'Tự động đồng bộ giao dịch ngân hàng' },
];
