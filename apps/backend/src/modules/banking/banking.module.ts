import { BullModule } from '@nestjs/bullmq';
import { Module } from '@nestjs/common';
import { PrismaModule } from '../../prisma/prisma.module';
import { WEBHOOK_QUEUE } from '../../queue/queue.module';
import { RedisModule } from '../../redis/redis.module';
import { BillingModule } from '../billing/billing.module';
import { OnboardingModule } from '../onboarding/onboarding.module';
import { BankingService } from './banking.service';
import { CasWebhookHandler } from './cas-webhook.handler';
import { WebhookController } from './webhook.controller';

@Module({
  imports: [
    BullModule.registerQueue({ name: WEBHOOK_QUEUE }),
    PrismaModule,
    RedisModule,
    BillingModule,
    OnboardingModule,
  ],
  controllers: [WebhookController],
  providers: [BankingService, CasWebhookHandler],
  exports: [BankingService],
})
export class BankingModule {}
