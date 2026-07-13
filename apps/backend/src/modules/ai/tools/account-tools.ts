import type { CopilotToolEntry } from '../copilot-tool.types';

export const accountTools: CopilotToolEntry[] = [
  {
    name: 'lookup_chart_account',
    description: 'Tra cứu tên và loại tài khoản kế toán TT133 theo mã tài khoản.',
    parameters: {
      type: 'object',
      properties: {
        accountCode: { type: 'string', description: 'Mã tài khoản, vd "642"' },
      },
      required: ['accountCode'],
      additionalProperties: false,
    },
    activity: {
      final: { kind: 'internal_data', label: 'Hệ thống tài khoản TT133', source: 'X-Cash AI' },
      streaming: {
        kind: 'internal_data',
        label: 'Đang tra cứu tài khoản TT133…',
        source: 'X-Cash AI',
      },
    },
    execute: (deps, tenantId, args) =>
      deps.chartOfAccountsService.findByCode(tenantId, String(args.accountCode)),
    formatSnippet: (data) => {
      if (data == null) return undefined;
      const d = data as {
        accountCode?: string;
        accountName?: string;
        accountType?: string;
      } | null;
      if (!d) return 'Không tìm thấy tài khoản';
      return `TK ${d.accountCode} — ${d.accountName}\nLoại: ${d.accountType}`;
    },
  },
  {
    name: 'list_chart_accounts',
    description:
      'Liệt kê danh sách tài khoản kế toán TT133 của doanh nghiệp. Có thể lọc theo loại tài khoản (asset, liability, equity, revenue, expense). Dùng khi user hỏi danh sách tài khoản hoặc muốn xem hệ thống tài khoản.',
    parameters: {
      type: 'object',
      properties: {
        accountType: {
          type: 'string',
          enum: ['asset', 'liability', 'equity', 'revenue', 'expense'],
          description: 'Lọc theo loại tài khoản (tùy chọn)',
        },
        limit: {
          type: 'integer',
          minimum: 1,
          maximum: 100,
          description: 'Số lượng tài khoản trả về, mặc định 50',
        },
      },
      required: [],
      additionalProperties: false,
    },
    activity: {
      final: { kind: 'internal_data', label: 'Hệ thống tài khoản', source: 'X-Cash AI' },
      streaming: {
        kind: 'internal_data',
        label: 'Đang lấy danh sách tài khoản…',
        source: 'X-Cash AI',
      },
    },
    execute: (deps, tenantId, args) =>
      deps.chartOfAccountsService.listFiltered(
        tenantId,
        args.accountType as string | undefined,
        Number(args.limit ?? 50),
      ),
    formatSnippet: (data) => {
      if (data == null) return undefined;
      const d = data as Array<{
        accountCode: string;
        accountName: string;
        accountType: string;
      }>;
      if (!Array.isArray(d) || d.length === 0) return undefined;
      const preview = d.slice(0, 10);
      return preview
        .map((a) => `TK ${a.accountCode} — ${a.accountName} (${a.accountType})`)
        .join('\n');
    },
  },
  {
    name: 'get_banking_status',
    description:
      'Kiểm tra trạng thái liên kết ngân hàng (Cas Link) và hoạt động giao dịch từ Casso gần đây của tenant.',
    parameters: {
      type: 'object',
      properties: {},
      required: [],
      additionalProperties: false,
    },
    activity: {
      final: { kind: 'internal_data', label: 'Liên kết ngân hàng', source: 'X-Cash AI' },
      streaming: {
        kind: 'internal_data',
        label: 'Đang kiểm tra liên kết ngân hàng…',
        source: 'X-Cash AI',
      },
    },
    execute: (deps, tenantId) => deps.bankingStatusService.getBankingStatus(tenantId),
    formatSnippet: (data) => {
      if (data == null) return undefined;
      const d = data as {
        bankingLinked?: boolean;
        grants?: Array<{ bankName: string; accountNumber: string; status: string }>;
        recentCasActivity?: { countLast7Days: number };
      };
      if (!d.bankingLinked) return 'Chưa liên kết ngân hàng qua Cas Link';
      const grantList = d.grants?.map((g) => `${g.bankName} ${g.accountNumber}`).join(', ') ?? '';
      return `Đã liên kết: ${grantList}\n7 ngày qua: ${d.recentCasActivity?.countLast7Days ?? 0} giao dịch từ Casso`;
    },
  },
];
