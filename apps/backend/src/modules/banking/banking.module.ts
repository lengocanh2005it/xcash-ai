import { BullModule } from '@nestjs/bullmq';
import { Module } from '@nestjs/common';
import { PrismaModule } from '../../prisma/prisma.module';
import { WEBHOOK_QUEUE } from '../../queue/queue.module';
import { RedisModule } from '../../redis/redis.module';
import { NotificationModule } from '../notification/notification.module';
import { BankingService } from './banking.service';
import { CasWebhookHandler } from './cas-webhook.handler';
import { WebhookController } from './webhook.controller';

@Module({
  imports: [
    BullModule.registerQueue({ name: WEBHOOK_QUEUE }),
    PrismaModule,
    RedisModule,
    NotificationModule,
  ],
  controllers: [WebhookController],
  providers: [BankingService, CasWebhookHandler],
  exports: [BankingService],
})
export class BankingModule {}
