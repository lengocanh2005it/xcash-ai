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
): ToolDefinition[] {
  const bind =
    (name: string) =>
    (args: Record<string, unknown>): Promise<unknown> =>
      toolService.execute(tenantId, name, args);

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
        name: 'get_cas_integration_help',
        description:
          'Lấy hướng dẫn tích hợp Casso / Cas Link theo chủ đề: tổng quan, cách liên kết, mất giao dịch, giải thích webhook.',
        strict: true,
        parameters: {
          type: 'object',
          properties: {
            topic: {
              type: 'string',
              enum: ['overview', 'how_to_link', 'missing_transactions', 'webhook_explained'],
              description:
                'overview = tổng quan; how_to_link = cách liên kết; missing_transactions = không thấy GD; webhook_explained = webhook Cas Balance Hook',
            },
          },
          required: ['topic'],
          additionalProperties: false,
        },
        parse: JSON.parse,
        function: bind('get_cas_integration_help'),
      },
    },
    {
      type: 'function',
      function: {
        name: 'search_transactions',
        description:
          'Tìm kiếm giao dịch theo từ khóa nội dung hoặc tài khoản. Dùng source="cas" để lọc giao dịch từ ngân hàng, source="import" cho giao dịch import Excel.',
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
              enum: ['cas', 'import'],
              description: 'Lọc theo nguồn: cas = ngân hàng, import = Excel',
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
        parse: JSON.parse,
        function: bind('search_transactions'),
      },
    },
  ];
}
