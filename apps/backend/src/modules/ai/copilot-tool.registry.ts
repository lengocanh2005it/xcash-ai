import type { CopilotActivity, Role } from '@xcash/shared-types';
import type { ToolDeps } from './copilot-tool.executor';

type ToolActivityMeta = Omit<CopilotActivity, 'urls'>;

export interface CopilotToolEntry {
  name: string;
  description: string;
  parameters: object;
  activity: { final: ToolActivityMeta; streaming: ToolActivityMeta };
  execute: (
    deps: ToolDeps,
    tenantId: string,
    args: Record<string, unknown>,
    role?: Role,
  ) => Promise<unknown>;
  /** Format result data into a short snippet for UI display. */
  formatSnippet?: (data: unknown) => string | undefined;
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
    execute: (deps, tenantId, args) =>
      deps.reportService.getSummary(tenantId, Number(args.year), Number(args.month)),
    formatSnippet: (data) => {
      if (data == null) return undefined;
      const d = data as {
        period?: { year: number; month: number };
        summary?: { totalRevenue?: number; totalExpense?: number; net?: number };
        stats?: { totalCount?: number; reviewCount?: number; aiAccuracy?: number };
      };
      const fmt = (n?: number) => (n != null ? `${Math.abs(n).toLocaleString('vi-VN')}đ` : '—');
      const s = d.summary;
      const st = d.stats;
      return [
        `Thu: ${fmt(s?.totalRevenue)} · Chi: ${fmt(s?.totalExpense)} · Lãi/lỗ: ${fmt(s?.net)}`,
        st
          ? `${st.totalCount ?? 0} giao dịch · ${st.reviewCount ?? 0} chờ duyệt · AI ${st.aiAccuracy ?? 0}%`
          : '',
      ]
        .filter(Boolean)
        .join('\n');
    },
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
    execute: (deps, tenantId, args) =>
      deps.reportService.getComparison(tenantId, Number(args.year), Number(args.month)),
    formatSnippet: (data) => {
      if (data == null) return undefined;
      const d = data as {
        current?: { summary?: { totalRevenue?: number; totalExpense?: number; net?: number } };
        previous?: { summary?: { totalRevenue?: number; totalExpense?: number; net?: number } };
      };
      const fmt = (n?: number) => (n != null ? `${Math.abs(n).toLocaleString('vi-VN')}đ` : '—');
      return `Tháng này: thu ${fmt(d.current?.summary?.totalRevenue)}, chi ${fmt(d.current?.summary?.totalExpense)}\nTháng trước: thu ${fmt(d.previous?.summary?.totalRevenue)}, chi ${fmt(d.previous?.summary?.totalExpense)}`;
    },
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
    execute: (deps, tenantId, args) =>
      deps.reportService.getTopAccounts(
        tenantId,
        Number(args.year),
        Number(args.month),
        Math.min(10, Number(args.limit ?? 5)),
      ),
    formatSnippet: (data) => {
      if (data == null) return undefined;
      const d = data as Array<{
        accountCode: string;
        accountName?: string;
        totalDebit?: number;
        totalCredit?: number;
      }>;
      if (!Array.isArray(d)) return undefined;
      return d
        .slice(0, 3)
        .map((a) => {
          const total = Math.abs((a.totalDebit ?? 0) - (a.totalCredit ?? 0));
          return `TK ${a.accountCode}${a.accountName ? ` (${a.accountName})` : ''}: ${total.toLocaleString('vi-VN')}đ`;
        })
        .join('\n');
    },
  },
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
      deps.txQueryService.getReviewQueueCount(
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
      deps.txQueryService.listReviewQueue(
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
      deps.txQueryService.lookupChartAccount(tenantId, String(args.accountCode)),
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
    execute: (deps, tenantId) => deps.txQueryService.getBankingStatus(tenantId),
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
    execute: (deps, _tenantId, args) =>
      deps.knowledgeService.searchKnowledge(String(args.query ?? '')),
    formatSnippet: (data) => {
      if (data == null) return undefined;
      const d = data as { sections?: Array<{ title: string; content: string }> } | null;
      if (!d?.sections?.length) return undefined;
      const first = d.sections[0];
      return `${first.title}\n${first.content.slice(0, 250)}`;
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
    execute: (deps, tenantId, args) => deps.txQueryService.searchTransactions(tenantId, args),
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
  {
    name: 'propose_confirm_transaction_classification',
    description:
      'Chỉ dùng khi user yêu cầu rõ ràng xác nhận/duyệt một giao dịch cụ thể. transactionId = field id (UUID nội bộ) từ list_review_queue hoặc search_transactions — KHÔNG dùng bankTransactionId. KHÔNG tự ý gợi ý xác nhận khi user chỉ hỏi thông tin chung. Tool này CHỈ đọc dữ liệu và đề xuất — không tự ghi xác nhận, người dùng phải bấm nút xác nhận trên giao diện.',
    parameters: {
      type: 'object',
      properties: {
        transactionId: {
          type: 'string',
          description:
            'Mã GD nội bộ (UUID) — field id từ list_review_queue hoặc search_transactions',
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
    execute: (deps, tenantId, args, role) =>
      deps.txQueryService.proposeConfirmTransactionClassification(
        tenantId,
        String(args.transactionId),
        role ?? ('viewer' as Role),
      ),
  },
  {
    name: 'propose_correct_transaction_classification',
    description:
      'Chỉ dùng khi user tự nêu rõ muốn sửa một giao dịch cụ thể thành cặp tài khoản Nợ/Có mới. transactionId = field id (UUID nội bộ) từ list_review_queue hoặc search_transactions. KHÔNG tự đề xuất định khoản mới thay user. Tool này CHỈ đọc dữ liệu, validate mã tài khoản và đề xuất — không tự ghi sửa, người dùng phải bấm nút trên giao diện.',
    parameters: {
      type: 'object',
      properties: {
        transactionId: {
          type: 'string',
          description:
            'Mã GD nội bộ (UUID) — field id từ list_review_queue hoặc search_transactions',
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
    execute: (deps, tenantId, args, role) =>
      deps.txQueryService.proposeCorrectTransactionClassification(
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
    execute: (deps, _tenantId, args) =>
      deps.knowledgeService.searchCassoPublic(String(args.query ?? '')),
    formatSnippet: (data) => {
      if (data == null) return undefined;
      const d = data as {
        answer?: string;
        results?: Array<{ title: string; url: string; snippet: string }>;
        disclaimer?: string;
      };
      const text = d.answer ?? d.results?.[0]?.snippet ?? '';
      return text.slice(0, 300);
    },
  },
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
      deps.txQueryService.listChartAccounts(
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
    name: 'get_period_summary',
    description:
      'Tổng hợp thu/chi/lãi-lỗ và thống kê giao dịch trong một khoảng thời gian tùy chỉnh (từ ngày đến ngày). Dùng khi user hỏi về doanh thu/chi phí/lãi lỗ của một khoảng thời gian cụ thể (vd: "từ đầu năm đến nay", "quý trước", "tuần trước").',
    parameters: {
      type: 'object',
      properties: {
        startDate: {
          type: 'string',
          format: 'date',
          description: 'Ngày bắt đầu (YYYY-MM-DD), vd "2026-01-01"',
        },
        endDate: {
          type: 'string',
          format: 'date',
          description: 'Ngày kết thúc (YYYY-MM-DD), vd "2026-06-30"',
        },
      },
      required: ['startDate', 'endDate'],
      additionalProperties: false,
    },
    activity: {
      final: { kind: 'internal_data', label: 'Báo cáo kỳ', source: 'X-Cash AI' },
      streaming: {
        kind: 'internal_data',
        label: 'Đang tổng hợp báo cáo kỳ…',
        source: 'X-Cash AI',
      },
    },
    execute: (deps, tenantId, args) =>
      deps.reportService.getSummaryByDateRange(
        tenantId,
        String(args.startDate),
        String(args.endDate),
      ),
    formatSnippet: (data) => {
      if (data == null) return undefined;
      const d = data as {
        period?: { startDate: string; endDate: string };
        summary?: { totalRevenue?: number; totalExpense?: number; net?: number };
        stats?: { totalCount?: number; reviewCount?: number; aiAccuracy?: number };
      };
      const fmt = (n?: number) => (n != null ? `${Math.abs(n).toLocaleString('vi-VN')}đ` : '—');
      const s = d.summary;
      const st = d.stats;
      const period = d.period
        ? `Từ ${d.period.startDate} đến ${d.period.endDate}`
        : 'Khoảng thời gian tùy chỉnh';
      return [
        period,
        `Thu: ${fmt(s?.totalRevenue)} · Chi: ${fmt(s?.totalExpense)} · Lãi/lỗ: ${fmt(s?.net)}`,
        st
          ? `${st.totalCount ?? 0} giao dịch · ${st.reviewCount ?? 0} chờ duyệt · AI ${st.aiAccuracy ?? 0}%`
          : '',
      ]
        .filter(Boolean)
        .join('\n');
    },
  },
];

/** Set of tool names that produce action cards in the UI. */
export const ACTION_CARD_TOOLS = new Set(
  COPILOT_TOOLS.filter((t) => t.activity.final.kind === 'action_card').map((t) => t.name),
);
