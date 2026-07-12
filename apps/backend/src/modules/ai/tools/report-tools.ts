import { BadRequestException } from '@nestjs/common';
import type { CopilotToolEntry } from '../copilot-tool.types';

export const reportTools: CopilotToolEntry[] = [
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
  {
    name: 'export_report',
    description:
      'Xuất báo cáo định khoản ra file Excel hoặc PDF theo tháng hoặc khoảng ngày tùy chỉnh. Chỉ dùng khi user yêu cầu rõ ràng xuất/tải file báo cáo.',
    parameters: {
      type: 'object',
      properties: {
        format: {
          type: 'string',
          enum: ['excel', 'pdf'],
          description: 'Định dạng file: excel hoặc pdf',
        },
        year: { type: 'integer', description: 'Năm, vd 2026 — dùng cùng month' },
        month: {
          type: 'integer',
          minimum: 1,
          maximum: 12,
          description: 'Tháng từ 1 đến 12 — dùng cùng year',
        },
        startDate: {
          type: 'string',
          format: 'date',
          description: 'Ngày bắt đầu (YYYY-MM-DD) — dùng cùng endDate, thay cho year/month',
        },
        endDate: {
          type: 'string',
          format: 'date',
          description: 'Ngày kết thúc (YYYY-MM-DD) — dùng cùng startDate, thay cho year/month',
        },
      },
      required: ['format'],
      additionalProperties: false,
    },
    activity: {
      final: { kind: 'file_export', label: 'Xuất báo cáo', source: 'X-Cash AI' },
      streaming: { kind: 'file_export', label: 'Đang xuất báo cáo…', source: 'X-Cash AI' },
    },
    execute: (deps, tenantId, args) => {
      const format = args.format as 'excel' | 'pdf';
      const hasMonth = args.year != null && args.month != null;
      const hasRange = args.startDate != null && args.endDate != null;

      if (hasMonth === hasRange) {
        throw new BadRequestException(
          'Cần truyền đúng 1 trong 2: (year và month) HOẶC (startDate và endDate), không được thiếu cả hai hoặc cả hai cùng lúc.',
        );
      }

      let fromDate: string;
      let toDate: string;
      if (hasMonth) {
        const year = Number(args.year);
        const month = Number(args.month);
        const pad = (n: number) => String(n).padStart(2, '0');
        const lastDay = new Date(year, month, 0).getDate();
        fromDate = `${year}-${pad(month)}-01`;
        toDate = `${year}-${pad(month)}-${pad(lastDay)}`;
      } else {
        fromDate = String(args.startDate);
        toDate = String(args.endDate);
      }

      return deps.exportService.createExport(tenantId, format, fromDate, toDate);
    },
  },
];
