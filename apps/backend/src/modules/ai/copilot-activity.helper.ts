import type { CopilotActivity } from '@xcash/shared-types';
import { ACTION_CARD_TOOLS, COPILOT_TOOLS } from './copilot-tool.registry';

export type { CopilotActivity };

type ToolActivityMeta = Omit<CopilotActivity, 'urls'>;

const ACTIVITY_MAP: Record<string, ToolActivityMeta> = Object.fromEntries(
  COPILOT_TOOLS.map((t) => [t.name, t.activity.final]),
);

const STREAMING_ACTIVITY_MAP: Record<string, ToolActivityMeta> = Object.fromEntries(
  COPILOT_TOOLS.map((t) => [t.name, t.activity.streaming]),
);

export function getStreamingActivityMeta(toolName: string): ToolActivityMeta | undefined {
  return STREAMING_ACTIVITY_MAP[toolName];
}

function formatSnippet(name: string, data: unknown): string | undefined {
  if (data == null) return undefined;
  try {
    switch (name) {
      case 'get_month_summary': {
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
      }
      case 'get_month_comparison': {
        const d = data as {
          current?: { summary?: { totalRevenue?: number; totalExpense?: number; net?: number } };
          previous?: { summary?: { totalRevenue?: number; totalExpense?: number; net?: number } };
        };
        const fmt = (n?: number) => (n != null ? `${Math.abs(n).toLocaleString('vi-VN')}đ` : '—');
        return `Tháng này: thu ${fmt(d.current?.summary?.totalRevenue)}, chi ${fmt(d.current?.summary?.totalExpense)}\nTháng trước: thu ${fmt(d.previous?.summary?.totalRevenue)}, chi ${fmt(d.previous?.summary?.totalExpense)}`;
      }
      case 'get_top_accounts': {
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
      }
      case 'get_review_queue_count': {
        const d = data as { count: number };
        return `${d.count} giao dịch đang chờ xét duyệt`;
      }
      case 'lookup_chart_account': {
        const d = data as {
          accountCode?: string;
          accountName?: string;
          accountType?: string;
        } | null;
        if (!d) return 'Không tìm thấy tài khoản';
        return `TK ${d.accountCode} — ${d.accountName}\nLoại: ${d.accountType}`;
      }
      case 'get_banking_status': {
        const d = data as {
          bankingLinked?: boolean;
          grants?: Array<{ bankName: string; accountNumber: string; status: string }>;
          recentCasActivity?: { countLast7Days: number };
        };
        if (!d.bankingLinked) return 'Chưa liên kết ngân hàng qua Cas Link';
        const grantList = d.grants?.map((g) => `${g.bankName} ${g.accountNumber}`).join(', ') ?? '';
        return `Đã liên kết: ${grantList}\n7 ngày qua: ${d.recentCasActivity?.countLast7Days ?? 0} giao dịch từ Casso`;
      }
      case 'search_knowledge_base': {
        const d = data as { sections?: Array<{ title: string; content: string }> } | null;
        if (!d?.sections?.length) return undefined;
        const first = d.sections[0];
        return `${first.title}\n${first.content.slice(0, 250)}`;
      }
      case 'search_transactions': {
        const d = data as {
          total: number;
          items: Array<{ content: string; amount: number; transactionDate: string }>;
        };
        const preview = d.items
          .slice(0, 3)
          .map(
            (t) => `• ${t.content?.slice(0, 50)} — ${Math.abs(t.amount).toLocaleString('vi-VN')}đ`,
          )
          .join('\n');
        return `${d.total} kết quả\n${preview}`;
      }
      case 'search_casso_public': {
        const d = data as {
          answer?: string;
          results?: Array<{ title: string; url: string; snippet: string }>;
          disclaimer?: string;
        };
        const text = d.answer ?? d.results?.[0]?.snippet ?? '';
        return text.slice(0, 300);
      }
      default:
        return undefined;
    }
  } catch {
    return undefined;
  }
}

function sectionCategoryLabel(id: string): string {
  if (id.startsWith('casso_')) return 'Casso';
  if (id.startsWith('tt133_')) return 'TT133';
  if (id.startsWith('xcash_')) return 'X-Cash AI';
  return 'Kiến thức';
}

export function buildActivities(
  calledTools: string[],
  resultsCapture?: Map<string, unknown>,
): CopilotActivity[] {
  const seen = new Set<string>();
  const result: CopilotActivity[] = [];

  for (const name of calledTools) {
    if (ACTION_CARD_TOOLS.has(name)) {
      const key = `action_card:${name}`;
      if (seen.has(key)) continue;
      seen.add(key);
      const meta = ACTIVITY_MAP[name];
      const data = resultsCapture?.get(name) as
        | Omit<NonNullable<CopilotActivity['actionCard']>, 'tool'>
        | undefined;
      if (meta && data)
        result.push({
          ...meta,
          actionCard: { ...data, tool: name } as CopilotActivity['actionCard'],
        });
      continue;
    }

    if (name === 'search_knowledge_base') {
      const data = resultsCapture?.get(name) as
        | { sections?: Array<{ id: string; title: string; content: string }> }
        | undefined;
      if (data?.sections?.length) {
        for (const section of data.sections) {
          const key = `knowledge:${section.id}`;
          if (seen.has(key)) continue;
          seen.add(key);
          result.push({
            kind: 'knowledge',
            label: section.title,
            source: sectionCategoryLabel(section.id),
            snippet: section.content.slice(0, 350),
          });
        }
      }
      continue;
    }

    const meta = ACTIVITY_MAP[name];
    if (!meta) continue;
    const key = `${meta.kind}:${meta.label}`;
    if (seen.has(key)) continue;
    seen.add(key);
    const snippet = resultsCapture ? formatSnippet(name, resultsCapture.get(name)) : undefined;
    result.push({ ...meta, snippet });
  }
  return result;
}
