import { BullModule } from '@nestjs/bullmq';
import { Module } from '@nestjs/common';
import { CopilotQuotaGuard } from '../../common/guards/copilot-quota.guard';
import { CopilotThrottlerGuard } from '../../common/guards/copilot-throttler.guard';
import { PlanGuard } from '../../common/guards/plan.guard';
import { PrismaModule } from '../../prisma/prisma.module';
import { WEBHOOK_QUEUE } from '../../queue/queue.module';
import { BillingModule } from '../billing/billing.module';
import { NotificationModule } from '../notification/notification.module';
import { OnboardingModule } from '../onboarding/onboarding.module';
import { ReportModule } from '../report/report.module';
import { AiUsageLogService } from './ai-usage-log.service';
import { ClassificationProcessor } from './classification.processor';
import { ClassificationService } from './classification.service';
import { CopilotController } from './copilot.controller';
import { CopilotBillingService } from './copilot-billing.service';
import { CopilotContextService } from './copilot-context.service';
import { CopilotConversationService } from './copilot-conversation.service';
import { CopilotKnowledgeService } from './copilot-knowledge.service';
import { CopilotQuotaService } from './copilot-quota.service';
import { CopilotStreamService } from './copilot-stream.service';
import { CopilotToolService } from './copilot-tool.service';
import { CopilotTransactionQueryService } from './copilot-tx-query.service';
import { EmbeddingService } from './embedding.service';
import { OpenAiService } from './openai.service';

@Module({
  imports: [
    BullModule.registerQueue({ name: WEBHOOK_QUEUE }),
    PrismaModule,
    NotificationModule,
    ReportModule,
    OnboardingModule,
    BillingModule,
  ],
  controllers: [CopilotController],
  providers: [
    AiUsageLogService,
    OpenAiService,
    EmbeddingService,
    ClassificationService,
    ClassificationProcessor,
    CopilotContextService,
    CopilotConversationService,
    CopilotKnowledgeService,
    CopilotTransactionQueryService,
    CopilotQuotaService,
    CopilotStreamService,
    CopilotToolService,
    CopilotBillingService,
    PlanGuard,
    CopilotQuotaGuard,
    CopilotThrottlerGuard,
  ],
  exports: [AiUsageLogService, OpenAiService, EmbeddingService, ClassificationService],
})
export class AiModule {}
