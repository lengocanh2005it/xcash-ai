import type { CopilotActivity, Role } from '@xcash/shared-types';
import type { BillingService } from '../billing/billing.service';
import type { ChartOfAccountsService } from '../chart-of-accounts/chart-of-accounts.service';
import type { ClassificationService } from '../classification/classification.service';
import type { ReportDataService } from '../report/report-data.service';
import type { ReportExportService } from '../report/report-export.service';
import type { TransactionService } from '../transaction/transaction.service';
import type { CopilotKnowledgeService } from './copilot-knowledge.service';
import type { CopilotTransactionQueryService } from './copilot-tx-query.service';

export interface ToolDeps {
  reportService: ReportDataService;
  classificationService: ClassificationService;
  chartOfAccountsService: ChartOfAccountsService;
  transactionService: TransactionService;
  copilotTxQueryService: CopilotTransactionQueryService;
  knowledgeService: CopilotKnowledgeService;
  billingService: BillingService;
  exportService: ReportExportService;
}

export type ToolActivityMeta = Omit<CopilotActivity, 'urls'>;

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
