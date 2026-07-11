/**
 * Eval độc lập cho "Quy tắc gọi tool" trong system prompt Copilot.
 *
 * KHÔNG chạy trong pnpm verify — gọi OpenAI API thật (tốn phí, không
 * deterministic 100%). Chạy thủ công mỗi khi sửa buildCopilotSystemPrompt()
 * trong openai.service.ts, để xác nhận model vẫn gọi đúng tool theo rule cũ
 * trước khi merge — tránh prompt phình to theo thời gian mà không ai phát
 * hiện rule cũ đã bị "quên"/mâu thuẫn với rule mới.
 *
 * Chạy: pnpm --filter @xcash/backend eval:copilot-tools
 * Cần OPENAI_API_KEY export sẵn trong shell.
 */

import type { ConfigService } from '@nestjs/config';
import type { Role } from '@xcash/shared-types';
import type { AiUsageLogService } from '../modules/ai/ai-usage-log.service';
import type { ToolDeps } from '../modules/ai/copilot-tool.executor';
import { OpenAiService } from '../modules/ai/openai.service';

interface EvalCase {
  question: string;
  /** Tool bắt buộc phải xuất hiện trong số tool được gọi (mảng rỗng = không kỳ vọng gọi tool nào). */
  expectedTools: string[];
  note: string;
}

const CASES: EvalCase[] = [
  {
    question: 'Doanh thu tháng này là bao nhiêu?',
    expectedTools: ['get_month_summary'],
    note: 'báo cáo tháng',
  },
  {
    question: 'So sánh doanh thu tháng này với tháng trước',
    expectedTools: ['get_month_comparison'],
    note: 'so sánh tháng',
  },
  {
    question: 'Tài khoản nào chi nhiều nhất tháng này?',
    expectedTools: ['get_top_accounts'],
    note: 'top account, không cần search_transactions',
  },
  {
    question: 'TT133 là gì, tôi mới dùng X-Cash AI?',
    expectedTools: ['search_knowledge_base'],
    note: 'khái niệm/hướng dẫn',
  },
  {
    question: 'Tôi muốn liên hệ hỗ trợ Casso, số điện thoại là gì?',
    expectedTools: ['search_knowledge_base'],
    note: 'liên hệ Casso',
  },
  {
    question: 'Sao tôi không thấy giao dịch nào từ ngân hàng cả?',
    expectedTools: ['get_banking_status'],
    note: 'không thấy GD từ NH',
  },
  {
    question: 'Có bao nhiêu giao dịch đang chờ duyệt?',
    expectedTools: ['get_review_queue_count'],
    note: 'đếm review queue',
  },
  {
    question: 'Cho tôi xem danh sách các giao dịch đang chờ duyệt',
    expectedTools: ['list_review_queue'],
    note: 'xem chi tiết review queue',
  },
  {
    question: 'Tìm giúp tôi giao dịch có nội dung "tiền điện"',
    expectedTools: ['search_transactions'],
    note: 'tìm GD theo nội dung',
  },
  {
    question: 'AI Copilot làm được những gì?',
    expectedTools: ['search_knowledge_base'],
    note: 'giới thiệu tính năng Copilot',
  },
  {
    question: 'Chào bạn!',
    expectedTools: [],
    note: 'xã giao thuần, không cần tool',
  },
];

function fakeConfigService(): ConfigService {
  return {
    get: (key: string, defaultValue?: unknown) => process.env[key] ?? defaultValue,
  } as unknown as ConfigService;
}

function dummyResultFor(name: string): unknown {
  switch (name) {
    case 'get_month_summary':
    case 'get_month_comparison':
      return { totalIn: 0, totalOut: 0, netIncome: 0, transactionCount: 0 };
    case 'get_top_accounts':
      return { accounts: [] };
    case 'search_knowledge_base':
      return { sections: [], query: '', totalFound: 0 };
    case 'get_banking_status':
      return { linked: false };
    case 'get_review_queue_count':
      return { count: 0 };
    case 'list_review_queue':
      return { items: [] };
    case 'search_transactions':
      return { items: [], total: 0 };
    default:
      return { ok: true };
  }
}

function fakeToolDeps(): { toolDeps: ToolDeps; calls: string[] } {
  const calls: string[] = [];
  const track =
    (name: string) =>
    (..._args: unknown[]) => {
      calls.push(name);
      return dummyResultFor(name);
    };
  const toolDeps: ToolDeps = {
    reportService: {
      getSummary: track('get_month_summary'),
      getComparison: track('get_month_comparison'),
      getTopAccounts: track('get_top_accounts'),
      getSummaryByDateRange: track('get_period_summary'),
    } as never,
    txQueryService: {
      getReviewQueueCount: track('get_review_queue_count'),
      listReviewQueue: track('list_review_queue'),
      lookupChartAccount: track('lookup_chart_account'),
      getBankingStatus: track('get_banking_status'),
      searchTransactions: track('search_transactions'),
      proposeConfirmTransactionClassification: track('propose_confirm_transaction_classification'),
      proposeCorrectTransactionClassification: track('propose_correct_transaction_classification'),
      listChartAccounts: track('list_chart_accounts'),
    } as never,
    knowledgeService: {
      searchKnowledge: track('search_knowledge_base'),
      searchCassoPublic: track('search_casso_public'),
    } as never,
    billingService: {
      getCurrentPlan: track('get_billing_current_plan'),
      getUsageHistory: track('get_payment_history'),
    } as never,
  };
  return { toolDeps, calls };
}

async function runCase(
  openAiService: OpenAiService,
  c: EvalCase,
): Promise<{ pass: boolean; actual: string[] }> {
  const { toolDeps, calls } = fakeToolDeps();
  const runner = openAiService.createCopilotRunner(
    'eval-tenant',
    c.question,
    [],
    toolDeps,
    new Map(),
    'admin' as Role,
  );
  if (!runner) throw new Error('OPENAI_API_KEY chưa cấu hình — không thể chạy eval');

  await runner.finalContent();

  const pass =
    c.expectedTools.length === 0
      ? calls.length === 0
      : c.expectedTools.every((t) => calls.includes(t));
  return { pass, actual: calls };
}

async function main(): Promise<void> {
  if (!process.env.OPENAI_API_KEY) {
    console.error('Thiếu OPENAI_API_KEY trong env — export trước khi chạy eval.');
    process.exit(1);
  }

  const openAiService = new OpenAiService(fakeConfigService(), {
    record: () => {},
  } as unknown as AiUsageLogService);

  let failCount = 0;
  for (const c of CASES) {
    const { pass, actual } = await runCase(openAiService, c);
    const icon = pass ? '✅' : '❌';
    console.log(`${icon} [${c.note}] "${c.question}"`);
    console.log(`   expected: [${c.expectedTools.join(', ')}]  actual: [${actual.join(', ')}]`);
    if (!pass) failCount++;
  }

  console.log(`\n${CASES.length - failCount}/${CASES.length} case đúng.`);
  if (failCount > 0) {
    console.error(
      `${failCount} case SAI — kiểm tra lại "Quy tắc gọi tool" trong buildCopilotSystemPrompt() (openai.service.ts).`,
    );
    process.exit(1);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
