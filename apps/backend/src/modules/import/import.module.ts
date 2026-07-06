import { Module } from '@nestjs/common';
import { PrismaModule } from '../../prisma/prisma.module';
import { QueueModule } from '../../queue/queue.module';
import { TransactionQuotaService } from '../billing/transaction-quota.service';
import { NotificationModule } from '../notification/notification.module';
import { ImportController } from './import.controller';
import { ImportService } from './import.service';

@Module({
  imports: [PrismaModule, QueueModule, NotificationModule],
  controllers: [ImportController],
  providers: [ImportService, TransactionQuotaService],
  exports: [TransactionQuotaService],
})
export class ImportModule {}
