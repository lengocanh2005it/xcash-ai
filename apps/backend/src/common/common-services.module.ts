import { Global, Module } from '@nestjs/common';
import { NotificationModule } from '../modules/notification/notification.module';
import { CopilotQuotaManager } from './services/copilot-quota-manager';
import { OtpFlowService } from './services/otp-flow.service';
import { QuotaNotificationService } from './services/quota-notification.service';
import { SubscriptionQueryAdapter } from './services/subscription-query.adapter';

@Global()
@Module({
  imports: [NotificationModule],
  providers: [
    QuotaNotificationService,
    SubscriptionQueryAdapter,
    CopilotQuotaManager,
    OtpFlowService,
  ],
  exports: [
    QuotaNotificationService,
    SubscriptionQueryAdapter,
    CopilotQuotaManager,
    OtpFlowService,
  ],
})
export class CommonServicesModule {}
