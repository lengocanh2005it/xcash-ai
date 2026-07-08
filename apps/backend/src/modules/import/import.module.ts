import { Module } from '@nestjs/common';
import { PrismaModule } from '../../prisma/prisma.module';
import { QueueModule } from '../../queue/queue.module';
import { BillingModule } from '../billing/billing.module';
import { NotificationModule } from '../notification/notification.module';
import { ImportController } from './import.controller';
import { ImportService } from './import.service';

@Module({
  imports: [PrismaModule, QueueModule, NotificationModule, BillingModule],
  controllers: [ImportController],
  providers: [ImportService],
  exports: [],
})
export class ImportModule {}
