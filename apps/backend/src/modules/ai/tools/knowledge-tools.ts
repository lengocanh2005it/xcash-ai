import type { CopilotToolEntry } from '../copilot-tool.types';

export function truncateAtSentenceBoundary(content: string, maxLength = 800): string {
  if (content.length <= maxLength) return content;

  const window = content.slice(0, maxLength);
  const lastPeriod = window.lastIndexOf('.');

  if (lastPeriod === -1) {
    return `${window}…`;
  }

  return `${window.slice(0, lastPeriod + 1)}…`;
}

export const knowledgeTools: CopilotToolEntry[] = [
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
    execute: async (deps, _tenantId, args) => {
      const result = await deps.knowledgeService.searchKnowledge(String(args.query ?? ''));
      return {
        ...result,
        sections: result.sections.map((section) => ({
          ...section,
          content: truncateAtSentenceBoundary(section.content),
        })),
      };
    },
    formatSnippet: (data) => {
      if (data == null) return undefined;
      const d = data as { sections?: Array<{ title: string; content: string }> } | null;
      if (!d?.sections?.length) return undefined;
      const first = d.sections[0];
      return `${first.title}\n${first.content.slice(0, 250)}`;
    },
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
];
