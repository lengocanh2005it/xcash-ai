import type { ConfigService } from '@nestjs/config';
import type { CopilotToolService } from './copilot-tool.service';

type ToolDefinition = {
  type: 'function';
  function: {
    name: string;
    description: string;
    strict: boolean;
    parameters: object;
    parse: (text: string) => unknown;
    function: (args: Record<string, unknown>) => Promise<unknown>;
  };
};

export function buildCopilotTools(
  tenantId: string,
  toolService: CopilotToolService,
  configService?: ConfigService,
  resultsCapture?: Map<string, unknown>,
): ToolDefinition[] {
  const cassoSearchEnabled = configService?.get<boolean>('COPILOT_CASSO_SEARCH_ENABLED') ?? false;
  const bind =
    (name: string) =>
    async (args: Record<string, unknown>): Promise<unknown> => {
      const result = await toolService.execute(tenantId, name, args);
      resultsCapture?.set(name, result);
      return result;
    };

  return [
    {
      type: 'function',
      function: {
        name: 'get_month_summary',
        description:
          'Tổng hợp thu/chi/lãi-lỗ và thống kê giao dịch của tenant trong một tháng cụ thể.',
        strict: true,
        parameters: {
          type: 'object',
          properties: {
            year: { type: 'integer', description: 'Năm, vd 2026' },
            month: { type: 'integer', minimum: 1, maximum: 12, description: 'Tháng từ 1 đến 12' },
          },
          required: ['year', 'month'],
          additionalProperties: false,
        },
        parse: JSON.parse,
        function: bind('get_month_summary'),
      },
    },
    {
      type: 'function',
      function: {
        name: 'get_month_comparison',
        description: 'So sánh thu/chi/lãi-lỗ/accuracy của tháng chỉ định với tháng trước đó.',
        strict: true,
        parameters: {
          type: 'object',
          properties: {
            year: { type: 'integer', description: 'Năm, vd 2026' },
            month: { type: 'integer', minimum: 1, maximum: 12, description: 'Tháng từ 1 đến 12' },
          },
          required: ['year', 'month'],
          additionalProperties: false,
        },
        parse: JSON.parse,
        function: bind('get_month_comparison'),
      },
    },
    {
      type: 'function',
      function: {
        name: 'get_top_accounts',
        description: 'Lấy danh sách tài khoản kế toán có phát sinh nhiều nhất trong tháng.',
        strict: true,
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
        parse: JSON.parse,
        function: bind('get_top_accounts'),
      },
    },
    {
      type: 'function',
      function: {
        name: 'get_review_queue_count',
        description: 'Đếm số giao dịch đang chờ kế toán xét duyệt (status=review) của toàn tenant.',
        strict: true,
        parameters: {
          type: 'object',
          properties: {},
          required: [],
          additionalProperties: false,
        },
        parse: JSON.parse,
        function: bind('get_review_queue_count'),
      },
    },
    {
      type: 'function',
      function: {
        name: 'lookup_chart_account',
        description: 'Tra cứu tên và loại tài khoản kế toán TT133 theo mã tài khoản.',
        strict: true,
        parameters: {
          type: 'object',
          properties: {
            accountCode: { type: 'string', description: 'Mã tài khoản, vd "642"' },
          },
          required: ['accountCode'],
          additionalProperties: false,
        },
        parse: JSON.parse,
        function: bind('lookup_chart_account'),
      },
    },
    {
      type: 'function',
      function: {
        name: 'get_banking_status',
        description:
          'Kiểm tra trạng thái liên kết ngân hàng (Cas Link) và hoạt động giao dịch từ Casso gần đây của tenant.',
        strict: true,
        parameters: {
          type: 'object',
          properties: {},
          required: [],
          additionalProperties: false,
        },
        parse: JSON.parse,
        function: bind('get_banking_status'),
      },
    },
    {
      type: 'function',
      function: {
        name: 'search_knowledge_base',
        description:
          'Tìm kiếm thông tin trong knowledge base của X-Cash AI: Casso (sản phẩm, tích hợp, liên kết NH, webhook), TT133 (chuẩn kế toán, định khoản, danh sách tài khoản), tính năng X-Cash AI (Human Review, import Excel, báo cáo, phân quyền, gói dịch vụ). Dùng khi user hỏi khái niệm hoặc hướng dẫn không cần dữ liệu real-time.',
        strict: true,
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
        parse: JSON.parse,
        function: bind('search_knowledge_base'),
      },
    },
    {
      type: 'function',
      function: {
        name: 'search_transactions',
        description:
          'Tìm kiếm giao dịch theo từ khóa nội dung hoặc tài khoản. Dùng source="cas" để lọc giao dịch từ ngân hàng, source="import" cho giao dịch import Excel, source="all" hoặc bỏ qua để tìm tất cả nguồn.',
        strict: true,
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
              description:
                'Lọc theo nguồn: cas = ngân hàng, import = Excel, all = tất cả (mặc định)',
            },
            limit: {
              type: 'integer',
              minimum: 1,
              maximum: 20,
              description: 'Số kết quả, mặc định 10',
            },
          },
          required: ['keyword', 'limit'],
          additionalProperties: false,
        },
        parse: JSON.parse,
        function: bind('search_transactions'),
      },
    },
    ...(cassoSearchEnabled
      ? [
          {
            type: 'function' as const,
            function: {
              name: 'search_casso_public',
              description:
                'Tìm kiếm thông tin công khai từ website Casso (casso.vn). Chỉ dùng khi user hỏi về sản phẩm Casso như ngân hàng hỗ trợ, giá dịch vụ, tính năng — thông tin không có trong hệ thống X-Cash AI.',
              strict: true,
              parameters: {
                type: 'object',
                properties: {
                  query: {
                    type: 'string',
                    description:
                      'Câu hỏi tìm kiếm, vd "Casso hỗ trợ ngân hàng nào", "giá dịch vụ Casso"',
                  },
                },
                required: ['query'],
                additionalProperties: false,
              },
              parse: JSON.parse,
              function: bind('search_casso_public'),
            },
          },
        ]
      : []),
  ];
}
