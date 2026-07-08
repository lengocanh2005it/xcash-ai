import type { CopilotActivity, Role } from '@xcash/shared-types';
import type { CopilotToolService } from './copilot-tool.service';

type ToolActivityMeta = Omit<CopilotActivity, 'urls'>;

export interface CopilotToolEntry {
  name: string;
  description: string;
  parameters: object;
  activity: { final: ToolActivityMeta; streaming: ToolActivityMeta };
  execute: (
    service: CopilotToolService,
    tenantId: string,
    args: Record<string, unknown>,
    role?: Role,
  ) => Promise<unknown>;
  /** Feature flag env var name. If undefined, tool is always enabled. */
  enabledBy?: string;
}

export const COPILOT_TOOLS: CopilotToolEntry[] = [
  {
    name: 'get_month_summary',
    description: 'Tổng hợp thu/chi/lãi-lỗ và thống kê giao dịch của tenant trong một tháng cụ thể.',
    parameters: {
      type: 'object',
      properties: {
        year: { type: 'integer', description: 'Năm, vd 2026' },
        month: { type: 'integer', minimum: 1, maximum: 12, description: 'Tháng từ 1 đến 12' },
      },
      required: ['year', 'month'],
      additionalProperties: false,
    },
    activity: {
      final: { kind: 'internal_data', label: 'Báo cáo tháng', source: 'X-Cash AI' },
      streaming: {
        kind: 'internal_data',
        label: 'Đang tra cứu báo cáo tháng…',
        source: 'X-Cash AI',
      },
    },
    execute: (service, tenantId, args) =>
      service.getMonthSummary(tenantId, Number(args.year), Number(args.month)),
  },
  {
    name: 'get_month_comparison',
    description: 'So sánh thu/chi/lãi-lỗ/accuracy của tháng chỉ định với tháng trước đó.',
    parameters: {
      type: 'object',
      properties: {
        year: { type: 'integer', description: 'Năm, vd 2026' },
        month: { type: 'integer', minimum: 1, maximum: 12, description: 'Tháng từ 1 đến 12' },
      },
      required: ['year', 'month'],
      additionalProperties: false,
    },
    activity: {
      final: { kind: 'internal_data', label: 'So sánh tháng', source: 'X-Cash AI' },
      streaming: { kind: 'internal_data', label: 'Đang so sánh tháng…', source: 'X-Cash AI' },
    },
    execute: (service, tenantId, args) =>
      service.getMonthComparison(tenantId, Number(args.year), Number(args.month)),
  },
  {
    name: 'get_top_accounts',
    description: 'Lấy danh sách tài khoản kế toán có phát sinh nhiều nhất trong tháng.',
    parameters: {
      type: 'object',
      properties: {
        year: { type: 'integer', description: 'Năm, vd 2026' },
        month: { type: 'integer', minimum: 1, maximum: 12, description: 'Tháng từ 1 đến 12' },
        limit: {
          type: 'integer',
          minimum: 1,
          maximum: 10,
          description: 'Số lượng tài khoản trả về, mặc định 5',
        },
      },
      required: ['year', 'month', 'limit'],
      additionalProperties: false,
    },
    activity: {
      final: { kind: 'internal_data', label: 'Top tài khoản', source: 'X-Cash AI' },
      streaming: {
        kind: 'internal_data',
        label: 'Đang tra cứu top tài khoản…',
        source: 'X-Cash AI',
      },
    },
    execute: (service, tenantId, args) =>
      service.getTopAccounts(
        tenantId,
        Number(args.year),
        Number(args.month),
        Math.min(10, Number(args.limit ?? 5)),
      ),
  },
  {
    name: 'get_review_queue_count',
    description: 'Đếm số giao dịch đang chờ kế toán xét duyệt (status=review) của toàn tenant.',
    parameters: {
      type: 'object',
      properties: {},
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
    execute: (service, tenantId) => service.getReviewQueueCount(tenantId),
  },
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
    execute: (service, tenantId, args) =>
      service.lookupChartAccount(tenantId, String(args.accountCode)),
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
    execute: (service, tenantId) => service.getBankingStatus(tenantId),
  },
  {
    name: 'search_knowledge_base',
    description:
      'Tìm kiếm thông tin trong knowledge base của X-Cash AI: Casso (sản phẩm, tích hợp, liên kết NH, webhook), TT133 (chuẩn kế toán, định khoản, danh sách tài khoản), tính năng X-Cash AI (Human Review, import Excel, báo cáo, phân quyền, gói dịch vụ). Dùng khi user hỏi khái niệm hoặc hướng dẫn không cần dữ liệu real-time.',
    parameters: {
      type: 'object',
      properties: {
        query: {
          type: 'string',
          description:
            'Câu hỏi hoặc từ khóa cần tra cứu, vd "Casso là gì", "TT133 tài khoản 642", "cách liên kết ngân hàng", "Human Review là gì"',
        },
      },
      required: ['query'],
      additionalProperties: false,
    },
    activity: {
      final: { kind: 'knowledge', label: 'Tài liệu hướng dẫn', source: 'X-Cash AI' },
      streaming: {
        kind: 'knowledge',
        label: 'Đang tra cứu tài liệu hướng dẫn…',
        source: 'X-Cash AI',
      },
    },
    execute: (service, _tenantId, args) => service.searchKnowledge(String(args.query ?? '')),
  },
  {
    name: 'search_transactions',
    description:
      'Tìm kiếm giao dịch theo từ khóa nội dung hoặc tài khoản. Dùng source="cas" để lọc giao dịch từ ngân hàng, source="import" cho giao dịch import Excel, source="all" hoặc bỏ qua để tìm tất cả nguồn.',
    parameters: {
      type: 'object',
      properties: {
        keyword: {
          type: 'string',
          description: 'Từ khóa tìm trong nội dung hoặc số tài khoản gửi',
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
      required: ['keyword', 'source', 'limit'],
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
    execute: (service, tenantId, args) => service.searchTransactions(tenantId, args),
  },
  {
    name: 'propose_confirm_transaction_classification',
    description:
      'Chỉ dùng khi user yêu cầu rõ ràng xác nhận/duyệt một giao dịch cụ thể (đã biết transactionId hoặc vừa tìm ra qua search_transactions). KHÔNG tự ý gợi ý xác nhận khi user chỉ hỏi thông tin chung. Tool này CHỈ đọc dữ liệu và đề xuất — không tự ghi xác nhận, người dùng phải bấm nút xác nhận trên giao diện.',
    parameters: {
      type: 'object',
      properties: {
        transactionId: {
          type: 'string',
          description: 'ID giao dịch cần đề xuất xác nhận',
        },
      },
      required: ['transactionId'],
      additionalProperties: false,
    },
    activity: {
      final: { kind: 'action_card', label: 'Đề xuất xác nhận giao dịch', source: 'X-Cash AI' },
      streaming: {
        kind: 'action_card',
        label: 'Đang chuẩn bị đề xuất xác nhận…',
        source: 'X-Cash AI',
      },
    },
    enabledBy: 'COPILOT_ACTION_TOOLS_ENABLED',
    execute: (service, tenantId, args, role) =>
      service.proposeConfirmTransactionClassification(
        tenantId,
        String(args.transactionId),
        role ?? ('viewer' as Role),
      ),
  },
  {
    name: 'propose_correct_transaction_classification',
    description:
      'Chỉ dùng khi user tự nêu rõ muốn sửa một giao dịch cụ thể thành cặp tài khoản Nợ/Có nào (đã có transactionId, debitAccount, creditAccount do user cung cấp). KHÔNG tự đề xuất định khoản mới thay user, KHÔNG tự ý gợi ý sửa khi user chỉ hỏi thông tin chung. Tool này CHỈ đọc dữ liệu, validate mã tài khoản và đề xuất — không tự ghi sửa, người dùng phải bấm nút trên giao diện.',
    parameters: {
      type: 'object',
      properties: {
        transactionId: {
          type: 'string',
          description: 'ID giao dịch cần đề xuất sửa định khoản',
        },
        debitAccount: {
          type: 'string',
          description: 'Mã tài khoản Nợ mới do user chỉ định, vd "641"',
        },
        creditAccount: {
          type: 'string',
          description: 'Mã tài khoản Có mới do user chỉ định, vd "111"',
        },
      },
      required: ['transactionId', 'debitAccount', 'creditAccount'],
      additionalProperties: false,
    },
    activity: {
      final: { kind: 'action_card', label: 'Đề xuất sửa định khoản', source: 'X-Cash AI' },
      streaming: {
        kind: 'action_card',
        label: 'Đang chuẩn bị đề xuất sửa định khoản…',
        source: 'X-Cash AI',
      },
    },
    enabledBy: 'COPILOT_ACTION_TOOLS_ENABLED',
    execute: (service, tenantId, args, role) =>
      service.proposeCorrectTransactionClassification(
        tenantId,
        String(args.transactionId),
        String(args.debitAccount),
        String(args.creditAccount),
        role ?? ('viewer' as Role),
      ),
  },
  {
    name: 'search_casso_public',
    description:
      'Tìm kiếm thông tin công khai từ website Casso (casso.vn). Chỉ dùng khi user hỏi về sản phẩm Casso như ngân hàng hỗ trợ, giá dịch vụ, tính năng — thông tin không có trong hệ thống X-Cash AI.',
    parameters: {
      type: 'object',
      properties: {
        query: {
          type: 'string',
          description: 'Câu hỏi tìm kiếm, vd "Casso hỗ trợ ngân hàng nào", "giá dịch vụ Casso"',
        },
      },
      required: ['query'],
      additionalProperties: false,
    },
    activity: {
      final: { kind: 'web_search', label: 'Tìm trên web', source: 'casso.vn' },
      streaming: {
        kind: 'web_search',
        label: 'Đang tìm trên web (casso.vn)…',
        source: 'casso.vn',
      },
    },
    enabledBy: 'COPILOT_CASSO_SEARCH_ENABLED',
    execute: (service, _tenantId, args) => service.searchCassoPublic(String(args.query ?? '')),
  },
];

/** Set of tool names that produce action cards in the UI. */
export const ACTION_CARD_TOOLS = new Set(
  COPILOT_TOOLS.filter((t) => t.activity.final.kind === 'action_card').map((t) => t.name),
);
