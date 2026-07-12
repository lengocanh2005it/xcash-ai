import { BullModule } from '@nestjs/bullmq';
import { Module } from '@nestjs/common';
import { PrismaModule } from '../../prisma/prisma.module';
import { WEBHOOK_QUEUE } from '../../queue/queue.module';
import { NotificationModule } from '../notification/notification.module';
import { AiCoreModule } from './ai-core.module';
import { ClassificationProcessor } from './classification.processor';
import { EmbeddingService } from './embedding.service';
import { TransactionClassifierService } from './transaction-classifier.service';

@Module({
  imports: [
    BullModule.registerQueue({ name: WEBHOOK_QUEUE }),
    PrismaModule,
    NotificationModule,
    AiCoreModule,
  ],
  providers: [EmbeddingService, TransactionClassifierService, ClassificationProcessor],
  exports: [EmbeddingService, TransactionClassifierService],
})
export class ClassificationPipelineModule {}
