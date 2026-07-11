import { BadRequestException } from '@nestjs/common';
import type { Role } from '@xcash/shared-types';
import { BillingService } from '../billing/billing.service';
import { ReportDataService } from '../report/report-data.service';
import { CopilotKnowledgeService } from './copilot-knowledge.service';
import { COPILOT_TOOLS, type CopilotToolEntry } from './copilot-tool.registry';
import { CopilotTransactionQueryService } from './copilot-tx-query.service';

export interface ToolDeps {
  reportService: ReportDataService;
  txQueryService: CopilotTransactionQueryService;
  knowledgeService: CopilotKnowledgeService;
  billingService: BillingService;
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
