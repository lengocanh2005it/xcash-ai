import { Injectable } from '@nestjs/common';
import { BillingService } from '../billing/billing.service';
import { ChartOfAccountsService } from '../chart-of-accounts/chart-of-accounts.service';
import { ClassificationService } from '../classification/classification.service';
import { ReportDataService } from '../report/report-data.service';
import { ReportExportService } from '../report/report-export.service';
import { TransactionService } from '../transaction/transaction.service';
import { CopilotBankingStatusService } from './copilot-banking-status.service';
import { CopilotKnowledgeService } from './copilot-knowledge.service';
import type { ToolDeps } from './copilot-tool.types';

@Injectable()
export class CopilotToolDepsProvider {
  constructor(
    private readonly reportService: ReportDataService,
    private readonly exportService: ReportExportService,
    private readonly classificationService: ClassificationService,
    private readonly chartOfAccountsService: ChartOfAccountsService,
    private readonly transactionService: TransactionService,
    private readonly bankingStatusService: CopilotBankingStatusService,
    private readonly knowledgeService: CopilotKnowledgeService,
    private readonly billingService: BillingService,
  ) {}

  getToolDeps(): ToolDeps {
    return {
      reportService: this.reportService,
      exportService: this.exportService,
      classificationService: this.classificationService,
      chartOfAccountsService: this.chartOfAccountsService,
      transactionService: this.transactionService,
      bankingStatusService: this.bankingStatusService,
      knowledgeService: this.knowledgeService,
      billingService: this.billingService,
    };
  }
}
