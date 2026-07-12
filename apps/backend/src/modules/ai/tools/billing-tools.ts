import type { CopilotToolEntry } from '../copilot-tool.types';

export const billingTools: CopilotToolEntry[] = [
  {
    name: 'get_billing_current_plan',
    description:
      'Lấy thông tin gói dịch vụ hiện tại của doanh nghiệp: tên gói, giá, quota giao dịch, quota AI Copilot, số đã dùng, trạng thái. Dùng khi user hỏi về gói dịch vụ, quota, hoặc tình trạng thanh toán.',
    parameters: {
      type: 'object',
      properties: {},
      required: [],
      additionalProperties: false,
    },
    activity: {
      final: { kind: 'internal_data', label: 'Gói dịch vụ', source: 'X-Cash AI' },
      streaming: {
        kind: 'internal_data',
        label: 'Đang tra cứu gói dịch vụ…',
        source: 'X-Cash AI',
      },
    },
    execute: (deps, tenantId) => deps.billingService.getCurrentPlan(tenantId),
    formatSnippet: (data) => {
      if (data == null) return undefined;
      const d = data as {
        plan?: string;
        pricePerMonth?: number;
        transactionQuota?: number;
        transactionUsed?: number;
        copilotQuota?: number;
        copilotUsed?: number;
        status?: string;
        currentCycleEnd?: Date | string;
      };
      if (!d.plan) return undefined;
      const fmt = (n?: number) => (n != null ? n.toLocaleString('vi-VN') : '∞');
      const cycleEnd = d.currentCycleEnd
        ? new Date(d.currentCycleEnd).toLocaleDateString('vi-VN')
        : '—';
      return [
        `Gói: ${d.plan} — ${fmt(d.pricePerMonth)}đ/tháng`,
        `GD: ${fmt(d.transactionUsed)}/${fmt(d.transactionQuota)} | Copilot: ${fmt(d.copilotUsed)}/${fmt(d.copilotQuota)}`,
        `Trạng thái: ${d.status} · Hết hạn: ${cycleEnd}`,
      ].join('\n');
    },
  },
  {
    name: 'get_payment_history',
    description:
      'Lấy lịch sử sử dụng (usage history) của doanh nghiệp trong 90 ngày gần nhất. Dùng khi user hỏi về lịch sử thanh toán, số giao dịch đã xử lý theo thời gian.',
    parameters: {
      type: 'object',
      properties: {},
      required: [],
      additionalProperties: false,
    },
    activity: {
      final: { kind: 'internal_data', label: 'Lịch sử thanh toán', source: 'X-Cash AI' },
      streaming: {
        kind: 'internal_data',
        label: 'Đang lấy lịch sử thanh toán…',
        source: 'X-Cash AI',
      },
    },
    execute: (deps, tenantId) => deps.billingService.getUsageHistory(tenantId),
    formatSnippet: (data) => {
      if (data == null) return undefined;
      const d = data as Array<{ metric: string; value: number; recordedAt: Date | string }>;
      if (!Array.isArray(d) || d.length === 0) return undefined;
      const recent = d.slice(0, 5);
      return recent
        .map((h) => {
          const date = new Date(h.recordedAt).toLocaleDateString('vi-VN');
          return `${date}: ${h.metric} = ${h.value.toLocaleString('vi-VN')}`;
        })
        .join('\n');
    },
  },
];
