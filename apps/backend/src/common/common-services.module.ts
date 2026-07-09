import { Global, Module } from '@nestjs/common';
import { NotificationModule } from '../modules/notification/notification.module';
import { QuotaNotificationService } from './services/quota-notification.service';

@Global()
@Module({
  imports: [NotificationModule],
  providers: [QuotaNotificationService],
  exports: [QuotaNotificationService],
})
export class CommonServicesModule {}
