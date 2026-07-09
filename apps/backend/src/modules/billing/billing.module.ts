import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ScheduleModule } from '@nestjs/schedule';
import { PrismaModule } from '../../prisma/prisma.module';
import { NotificationModule } from '../notification/notification.module';
import { BillingController } from './billing.controller';
import { BillingService } from './billing.service';
import { BillingCycleService } from './billing-cycle.service';
import { BillingOverageService } from './billing-overage.service';
import { PayosService } from './payos.service';
import { PayosWebhookController } from './payos-webhook.controller';
import { TransactionQuotaService } from './transaction-quota.service';

@Module({
  imports: [PrismaModule, ConfigModule, ScheduleModule.forRoot(), NotificationModule],
  controllers: [BillingController, PayosWebhookController],
  providers: [
    BillingService,
    BillingOverageService,
    PayosService,
    BillingCycleService,
    TransactionQuotaService,
  ],
  exports: [BillingService, BillingOverageService, TransactionQuotaService],
})
export class BillingModule {}
