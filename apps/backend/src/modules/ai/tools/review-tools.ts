import type { CopilotToolEntry } from '../copilot-tool.types';

export const reviewTools: CopilotToolEntry[] = [
  {
    name: 'get_review_queue_count',
    description:
      'Đếm số giao dịch đang chờ kế toán xét duyệt (status=review). Mặc định đếm toàn bộ hàng đợi; truyền year+month nếu user hỏi GD chờ duyệt trong một tháng cụ thể (khớp reviewCount trong báo cáo tháng).',
    parameters: {
      type: 'object',
      properties: {
        year: { type: 'integer', description: 'Tùy chọn — lọc theo năm giao dịch' },
        month: {
          type: 'integer',
          minimum: 1,
          maximum: 12,
          description: 'Tùy chọn — lọc theo tháng GD',
        },
      },
      required: [],
      additionalProperties: false,
    },
    activity: {
      final: { kind: 'internal_data', label: 'Hàng đợi xét duyệt', source: 'X-Cash AI' },
      streaming: {
        kind: 'internal_data',
        label: 'Đang đếm hàng đợi xét duyệt…',
        source: 'X-Cash AI',
      },
    },
    execute: (deps, tenantId, args) =>
      deps.classificationService.getCopilotReviewQueueCount(
        tenantId,
        args.year != null ? Number(args.year) : undefined,
        args.month != null ? Number(args.month) : undefined,
      ),
    formatSnippet: (data) => {
      if (data == null) return undefined;
      const d = data as { count?: number };
      return d.count != null ? `${d.count} giao dịch chờ duyệt` : undefined;
    },
  },
  {
    name: 'list_review_queue',
    description:
      'Liệt kê chi tiết giao dịch đang chờ kế toán xét duyệt (status=review). Dùng khi user hỏi xem danh sách/chi tiết GD chờ duyệt — KHÔNG dùng search_transactions cho mục đích này. Truyền year+month nếu ngữ cảnh là báo cáo tháng cụ thể.',
    parameters: {
      type: 'object',
      properties: {
        limit: {
          type: 'integer',
          minimum: 1,
          maximum: 20,
          description: 'Số giao dịch tối đa trả về, mặc định 10',
        },
        year: { type: 'integer', description: 'Tùy chọn — lọc theo năm giao dịch' },
        month: {
          type: 'integer',
          minimum: 1,
          maximum: 12,
          description: 'Tùy chọn — lọc theo tháng GD',
        },
      },
      required: [],
      additionalProperties: false,
    },
    activity: {
      final: { kind: 'internal_data', label: 'Giao dịch chờ duyệt', source: 'X-Cash AI' },
      streaming: {
        kind: 'internal_data',
        label: 'Đang lấy danh sách chờ duyệt…',
        source: 'X-Cash AI',
      },
    },
    execute: (deps, tenantId, args) =>
      deps.classificationService.listCopilotReviewQueue(
        tenantId,
        Number(args.limit ?? 10),
        args.year != null ? Number(args.year) : undefined,
        args.month != null ? Number(args.month) : undefined,
      ),
    formatSnippet: (data) => {
      if (data == null) return undefined;
      const d = data as {
        total: number;
        items: Array<{
          id: string;
          content: string;
          amount: number;
          debitAccount: string;
          creditAccount: string;
          confidence: number;
        }>;
      };
      const preview = d.items
        .slice(0, 5)
        .map(
          (t) =>
            `• ${t.content?.slice(0, 40)} — Nợ ${t.debitAccount}/Có ${t.creditAccount} (${t.confidence}%)`,
        )
        .join('\n');
      return `${d.total} giao dịch chờ duyệt\n${preview}`;
    },
  },
  {
    name: 'search_transactions',
    description:
      'Tìm giao dịch theo từ khóa nội dung, mã TK Nợ/Có, hoặc trạng thái định khoản. KHÔNG dùng để liệt kê hàng đợi Human Review — dùng list_review_queue. Field id trong kết quả là mã GD nội bộ (dùng cho thẻ duyệt/sửa).',
    parameters: {
      type: 'object',
      properties: {
        keyword: {
          type: 'string',
          description:
            'Từ khóa tìm trong nội dung hoặc số tài khoản gửi — để trống nếu lọc theo accountCode/classificationStatus',
        },
        accountCode: {
          type: 'string',
          description: 'Lọc GD có định khoản Nợ hoặc Có khớp mã TK, vd "642"',
        },
        classificationStatus: {
          type: 'string',
          enum: ['review', 'classified', 'pending', 'all'],
          description: 'Lọc theo trạng thái định khoản; mặc định all',
        },
        source: {
          type: 'string',
          enum: ['cas', 'import', 'all'],
          description: 'Lọc theo nguồn: cas = ngân hàng, import = Excel, all = tất cả (mặc định)',
        },
        limit: {
          type: 'integer',
          minimum: 1,
          maximum: 20,
          description: 'Số kết quả, mặc định 10',
        },
      },
      required: [],
      additionalProperties: false,
    },
    activity: {
      final: { kind: 'internal_data', label: 'Giao dịch', source: 'X-Cash AI' },
      streaming: {
        kind: 'internal_data',
        label: 'Đang tìm kiếm giao dịch…',
        source: 'X-Cash AI',
      },
    },
    execute: (deps, tenantId, args) => deps.transactionService.searchForCopilot(tenantId, args),
    formatSnippet: (data) => {
      if (data == null) return undefined;
      const d = data as {
        total: number;
        items: Array<{
          id: string;
          content: string;
          amount: number;
          debitAccount?: string | null;
          creditAccount?: string | null;
        }>;
      };
      const preview = d.items
        .slice(0, 3)
        .map(
          (t) =>
            `• [${t.id.slice(0, 8)}…] ${t.content?.slice(0, 40)} — ${Math.abs(t.amount).toLocaleString('vi-VN')}đ` +
            (t.debitAccount ? ` (Nợ ${t.debitAccount}/Có ${t.creditAccount})` : ''),
        )
        .join('\n');
      return `${d.total} kết quả\n${preview}`;
    },
  },
];
