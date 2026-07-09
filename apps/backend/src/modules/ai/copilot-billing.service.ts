import { Injectable, Logger } from '@nestjs/common';
import { BillingService } from '../billing/billing.service';

@Injectable()
export class CopilotBillingService {
  private readonly logger = new Logger(CopilotBillingService.name);

  constructor(private readonly billingService: BillingService) {}

  async getCurrentPlan(tenantId: string) {
    try {
      return await this.billingService.getCurrentPlan(tenantId);
    } catch (error) {
      this.logger.error(
        'Failed to get current plan',
        error instanceof Error ? error.message : String(error),
      );
      return null;
    }
  }

  async getPaymentHistory(tenantId: string) {
    try {
      return await this.billingService.getUsageHistory(tenantId);
    } catch (error) {
      this.logger.error(
        'Failed to get payment history',
        error instanceof Error ? error.message : String(error),
      );
      return null;
    }
  }
}
