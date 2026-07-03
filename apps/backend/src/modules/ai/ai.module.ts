import { BullModule } from '@nestjs/bullmq';
import { Module } from '@nestjs/common';
import { WEBHOOK_QUEUE } from '../../queue/queue.module';
import { ClassificationProcessor } from './classification.processor';
import { ClassificationService } from './classification.service';
import { EmbeddingService } from './embedding.service';
import { OpenAiService } from './openai.service';

@Module({
  imports: [BullModule.registerQueue({ name: WEBHOOK_QUEUE })],
  providers: [OpenAiService, EmbeddingService, ClassificationService, ClassificationProcessor],
  exports: [OpenAiService, EmbeddingService, ClassificationService],
})
export class AiModule {}
