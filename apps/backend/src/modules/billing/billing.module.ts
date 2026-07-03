import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ScheduleModule } from '@nestjs/schedule';
import { PrismaModule } from '../../prisma/prisma.module';
import { BillingController } from './billing.controller';
import { BillingService } from './billing.service';
import { BillingCycleService } from './billing-cycle.service';
import { PayosService } from './payos.service';
import { PayosWebhookController } from './payos-webhook.controller';

@Module({
  imports: [PrismaModule, ConfigModule, ScheduleModule.forRoot()],
  controllers: [BillingController, PayosWebhookController],
  providers: [BillingService, PayosService, BillingCycleService],
  exports: [BillingService],
})
export class BillingModule {}
