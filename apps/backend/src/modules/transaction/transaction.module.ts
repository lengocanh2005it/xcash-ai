import { BullModule } from '@nestjs/bullmq';
import { Module } from '@nestjs/common';
import { WEBHOOK_QUEUE } from '../../queue/queue.module';
import { NotificationModule } from '../notification/notification.module';
import { TransactionController } from './transaction.controller';
import { TransactionService } from './transaction.service';

@Module({
  imports: [BullModule.registerQueue({ name: WEBHOOK_QUEUE }), NotificationModule],
  controllers: [TransactionController],
  providers: [TransactionService],
  exports: [TransactionService],
})
export class TransactionModule {}
