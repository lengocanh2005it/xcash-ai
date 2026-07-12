import { Module } from '@nestjs/common';
import { CopilotQuotaGuard } from '../../common/guards/copilot-quota.guard';
import { CopilotThrottlerGuard } from '../../common/guards/copilot-throttler.guard';
import { PlanGuard } from '../../common/guards/plan.guard';
import { BankingModule } from '../banking/banking.module';
import { BillingModule } from '../billing/billing.module';
import { ChartOfAccountsModule } from '../chart-of-accounts/chart-of-accounts.module';
import { ClassificationModule } from '../classification/classification.module';
import { NotificationModule } from '../notification/notification.module';
import { OnboardingModule } from '../onboarding/onboarding.module';
import { ReportModule } from '../report/report.module';
import { TransactionModule } from '../transaction/transaction.module';
import { AiCoreModule } from './ai-core.module';
import { CopilotController } from './copilot.controller';
import { CopilotContextService } from './copilot-context.service';
import { CopilotConversationService } from './copilot-conversation.service';
import { CopilotConversationSetupService } from './copilot-conversation-setup.service';
import { CopilotKnowledgeService } from './copilot-knowledge.service';
import { CopilotStreamService } from './copilot-stream.service';

@Module({
  imports: [
    AiCoreModule,
    ReportModule,
    OnboardingModule,
    BillingModule,
    NotificationModule,
    ClassificationModule,
    ChartOfAccountsModule,
    TransactionModule,
    BankingModule,
  ],
  controllers: [CopilotController],
  providers: [
    CopilotContextService,
    CopilotConversationService,
    CopilotConversationSetupService,
    CopilotKnowledgeService,
    CopilotStreamService,
    PlanGuard,
    CopilotQuotaGuard,
    CopilotThrottlerGuard,
  ],
})
export class CopilotModule {}
