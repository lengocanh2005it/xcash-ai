import { BullModule } from '@nestjs/bullmq';
import { Module } from '@nestjs/common';
import { CopilotQuotaGuard } from '../../common/guards/copilot-quota.guard';
import { CopilotThrottlerGuard } from '../../common/guards/copilot-throttler.guard';
import { PlanGuard } from '../../common/guards/plan.guard';
import { PrismaModule } from '../../prisma/prisma.module';
import { WEBHOOK_QUEUE } from '../../queue/queue.module';
import { NotificationModule } from '../notification/notification.module';
import { OnboardingModule } from '../onboarding/onboarding.module';
import { ReportModule } from '../report/report.module';
import { ClassificationProcessor } from './classification.processor';
import { ClassificationService } from './classification.service';
import { CopilotController } from './copilot.controller';
import { CopilotContextService } from './copilot-context.service';
import { CopilotConversationService } from './copilot-conversation.service';
import { CopilotToolService } from './copilot-tool.service';
import { EmbeddingService } from './embedding.service';
import { OpenAiService } from './openai.service';

@Module({
  imports: [
    BullModule.registerQueue({ name: WEBHOOK_QUEUE }),
    PrismaModule,
    NotificationModule,
    ReportModule,
    OnboardingModule,
  ],
  controllers: [CopilotController],
  providers: [
    OpenAiService,
    EmbeddingService,
    ClassificationService,
    ClassificationProcessor,
    CopilotContextService,
    CopilotConversationService,
    CopilotToolService,
    PlanGuard,
    CopilotQuotaGuard,
    CopilotThrottlerGuard,
  ],
  exports: [OpenAiService, EmbeddingService, ClassificationService],
})
export class AiModule {}
