import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import type { Role } from '@xcash/shared-types';
import { ReportService } from '../report/report.service';
import { CopilotBillingService } from './copilot-billing.service';
import { CopilotKnowledgeService } from './copilot-knowledge.service';
import { COPILOT_TOOLS, type CopilotToolEntry } from './copilot-tool.registry';
import { CopilotTransactionQueryService } from './copilot-tx-query.service';

type MonthSummary = Awaited<ReturnType<ReportService['getSummary']>>;

/**
 * Thin facade over domain services. Owns only:
 * - Tool dispatch (execute)
 * - Reporting delegation (getMonthSummary/Comparison/TopAccounts)
 * - Registry accessors
 */
@Injectable()
export class CopilotToolService {
  private readonly logger = new Logger(CopilotToolService.name);
  private readonly registry: Map<string, CopilotToolEntry>;

  constructor(
    private readonly reportService: ReportService,
    private readonly knowledgeService: CopilotKnowledgeService,
    private readonly txQueryService: CopilotTransactionQueryService,
    private readonly billingService: CopilotBillingService,
  ) {
    this.registry = new Map(COPILOT_TOOLS.map((t) => [t.name, t]));
  }

  // ── Reporting (delegates to ReportService) ─────────────────────────────────

  async getMonthSummary(tenantId: string, year: number, month: number): Promise<MonthSummary> {
    return this.reportService.getSummary(tenantId, year, month);
  }

  async getMonthComparison(tenantId: string, year: number, month: number) {
    return this.reportService.getComparison(tenantId, year, month);
  }

  async getTopAccounts(tenantId: string, year: number, month: number, limit: number) {
    return this.reportService.getTopAccounts(tenantId, year, month, limit);
  }

  async getPeriodSummary(tenantId: string, startDate: string, endDate: string) {
    return this.reportService.getSummaryByDateRange(tenantId, startDate, endDate);
  }

  // ── Review queue (delegates to CopilotTransactionQueryService) ─────────────

  async getReviewQueueCount(tenantId: string, year?: number, month?: number) {
    return this.txQueryService.getReviewQueueCount(tenantId, year, month);
  }

  async listReviewQueue(tenantId: string, limit = 10, year?: number, month?: number) {
    return this.txQueryService.listReviewQueue(tenantId, limit, year, month);
  }

  // ── Chart of accounts (delegates) ──────────────────────────────────────────

  async lookupChartAccount(tenantId: string, accountCode: string) {
    return this.txQueryService.lookupChartAccount(tenantId, accountCode);
  }

  // ── Banking status (delegates) ─────────────────────────────────────────────

  async getBankingStatus(tenantId: string) {
    return this.txQueryService.getBankingStatus(tenantId);
  }

  // ── Transaction search (delegates) ─────────────────────────────────────────

  async searchTransactions(tenantId: string, args: Record<string, unknown>) {
    return this.txQueryService.searchTransactions(tenantId, args);
  }

  // ── Classification validation (delegates) ──────────────────────────────────

  async proposeConfirmTransactionClassification(
    tenantId: string,
    transactionId: string,
    role: Role,
  ) {
    return this.txQueryService.proposeConfirmTransactionClassification(
      tenantId,
      transactionId,
      role,
    );
  }

  async proposeCorrectTransactionClassification(
    tenantId: string,
    transactionId: string,
    debitAccount: string,
    creditAccount: string,
    role: Role,
  ) {
    return this.txQueryService.proposeCorrectTransactionClassification(
      tenantId,
      transactionId,
      debitAccount,
      creditAccount,
      role,
    );
  }

  // ── Knowledge (delegates) ──────────────────────────────────────────────────

  async searchKnowledge(query: string) {
    return this.knowledgeService.searchKnowledge(query);
  }

  async searchCassoPublic(query: string) {
    return this.knowledgeService.searchCassoPublic(query);
  }

  // ── Billing (delegates) ────────────────────────────────────────────────────

  async getBillingCurrentPlan(tenantId: string) {
    return this.billingService.getCurrentPlan(tenantId);
  }

  async getPaymentHistory(tenantId: string) {
    return this.billingService.getPaymentHistory(tenantId);
  }

  // ── Chart of accounts list (delegates) ─────────────────────────────────────

  async listChartAccounts(tenantId: string, accountType?: string, limit = 50) {
    return this.txQueryService.listChartAccounts(tenantId, accountType, limit);
  }

  // ── Dispatcher ─────────────────────────────────────────────────────────────

  async execute(
    tenantId: string,
    name: string,
    args: Record<string, unknown>,
    role?: Role,
  ): Promise<unknown> {
    const entry = this.registry.get(name);
    if (!entry) throw new BadRequestException(`Unknown copilot tool: ${name}`);
    return entry.execute(this, tenantId, args, role);
  }

  // ── Registry accessors (used by factory + activity helper) ─────────────────

  getRegistry(): Map<string, CopilotToolEntry> {
    return this.registry;
  }
}
