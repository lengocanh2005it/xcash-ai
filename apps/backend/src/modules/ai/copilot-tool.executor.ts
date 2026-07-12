import { BadRequestException } from '@nestjs/common';
import type { Role } from '@xcash/shared-types';
import { BankingService } from '../banking/banking.service';
import { BillingService } from '../billing/billing.service';
import { ChartOfAccountsService } from '../chart-of-accounts/chart-of-accounts.service';
import { ClassificationService } from '../classification/classification.service';
import { ReportDataService } from '../report/report-data.service';
import { ReportExportService } from '../report/report-export.service';
import { TransactionService } from '../transaction/transaction.service';
import { CopilotKnowledgeService } from './copilot-knowledge.service';
import { COPILOT_TOOLS, type CopilotToolEntry } from './copilot-tool.registry';

export interface ToolDeps {
  reportService: ReportDataService;
  classificationService: ClassificationService;
  chartOfAccountsService: ChartOfAccountsService;
  transactionService: TransactionService;
  bankingService: BankingService;
  knowledgeService: CopilotKnowledgeService;
  billingService: BillingService;
  exportService: ReportExportService;
}

const registry = new Map(COPILOT_TOOLS.map((t) => [t.name, t]));

export async function executeTool(
  deps: ToolDeps,
  name: string,
  tenantId: string,
  args: Record<string, unknown>,
  role?: Role,
): Promise<unknown> {
  const entry = registry.get(name);
  if (!entry) throw new BadRequestException(`Unknown copilot tool: ${name}`);
  return entry.execute(deps, tenantId, args, role);
}

export function getToolRegistry(): Map<string, CopilotToolEntry> {
  return registry;
}
