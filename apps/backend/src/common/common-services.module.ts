import { Global, Module } from '@nestjs/common';
import { NotificationModule } from '../modules/notification/notification.module';
import { CopilotQuotaManager } from './services/copilot-quota-manager';
import { QuotaNotificationService } from './services/quota-notification.service';
import { SubscriptionQueryAdapter } from './services/subscription-query.adapter';

@Global()
@Module({
  imports: [NotificationModule],
  providers: [QuotaNotificationService, SubscriptionQueryAdapter, CopilotQuotaManager],
  exports: [QuotaNotificationService, SubscriptionQueryAdapter, CopilotQuotaManager],
})
export class CommonServicesModule {}
