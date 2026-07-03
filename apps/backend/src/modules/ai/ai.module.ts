import { BullModule } from '@nestjs/bullmq';
import { Module } from '@nestjs/common';
import { PlanGuard } from '../../common/guards/plan.guard';
import { PrismaModule } from '../../prisma/prisma.module';
import { WEBHOOK_QUEUE } from '../../queue/queue.module';
import { ClassificationProcessor } from './classification.processor';
import { ClassificationService } from './classification.service';
import { CopilotController } from './copilot.controller';
import { EmbeddingService } from './embedding.service';
import { OpenAiService } from './openai.service';

@Module({
  imports: [BullModule.registerQueue({ name: WEBHOOK_QUEUE }), PrismaModule],
  controllers: [CopilotController],
  providers: [
    OpenAiService,
    EmbeddingService,
    ClassificationService,
    ClassificationProcessor,
    PlanGuard,
  ],
  exports: [OpenAiService, EmbeddingService, ClassificationService],
})
export class AiModule {}
