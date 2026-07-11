import { Module } from '@nestjs/common';
import { CopilotQuotaGuard } from '../../common/guards/copilot-quota.guard';
import { CopilotThrottlerGuard } from '../../common/guards/copilot-throttler.guard';
import { PlanGuard } from '../../common/guards/plan.guard';
import { BillingModule } from '../billing/billing.module';
import { NotificationModule } from '../notification/notification.module';
import { OnboardingModule } from '../onboarding/onboarding.module';
import { ReportModule } from '../report/report.module';
import { AiCoreModule } from './ai-core.module';
import { CopilotController } from './copilot.controller';
import { CopilotContextService } from './copilot-context.service';
import { CopilotConversationService } from './copilot-conversation.service';
import { CopilotKnowledgeService } from './copilot-knowledge.service';
import { CopilotStreamService } from './copilot-stream.service';
import { CopilotTransactionQueryService } from './copilot-tx-query.service';

@Module({
  imports: [AiCoreModule, ReportModule, OnboardingModule, BillingModule, NotificationModule],
  controllers: [CopilotController],
  providers: [
    CopilotContextService,
    CopilotConversationService,
    CopilotKnowledgeService,
    CopilotTransactionQueryService,
    CopilotStreamService,
    PlanGuard,
    CopilotQuotaGuard,
    CopilotThrottlerGuard,
  ],
})
export class CopilotModule {}
