import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { PrismaModule } from '../../prisma/prisma.module';
import { BillingController } from './billing.controller';
import { BillingService } from './billing.service';
import { PayosService } from './payos.service';
import { PayosWebhookController } from './payos-webhook.controller';

@Module({
  imports: [PrismaModule, ConfigModule],
  controllers: [BillingController, PayosWebhookController],
  providers: [BillingService, PayosService],
})
export class BillingModule {}
