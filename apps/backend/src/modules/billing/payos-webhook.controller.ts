import { BadRequestException, Body, Controller, Logger, Post } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { BillingService } from './billing.service';
import { PayosService } from './payos.service';

@ApiTags('webhook')
@Controller('webhook')
export class PayosWebhookController {
  private readonly logger = new Logger(PayosWebhookController.name);

  constructor(
    private readonly billingService: BillingService,
    private readonly payosService: PayosService,
  ) {}

  @Post('payos-billing')
  async handlePayosWebhook(@Body() body: unknown) {
    let orderCode: string;
    let code: string;

    try {
      const verified = await this.payosService.verifyWebhookData(body);
      orderCode = verified.orderCode;
      code = verified.code;
    } catch {
      throw new BadRequestException('Chữ ký PayOS không hợp lệ');
    }

    // Chỉ xử lý khi thanh toán thành công (code = '00')
    if (code !== '00') {
      this.logger.warn(`PayOS webhook code=${code} for orderCode=${orderCode} — skipped`);
      return { success: true };
    }

    await this.billingService.confirmPayment(orderCode);
    this.logger.log(`Payment confirmed for orderCode=${orderCode}`);
    return { success: true };
  }
}
