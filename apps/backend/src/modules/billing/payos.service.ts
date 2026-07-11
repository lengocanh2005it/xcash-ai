import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PayOS } from '@payos/node';

interface CreatePaymentLinkParams {
  orderCode: number;
  amount: number;
  description: string;
  returnUrl: string;
  cancelUrl: string;
}

interface PaymentLinkResult {
  checkoutUrl: string;
  qrCode: string;
  isMock: boolean;
}

@Injectable()
export class PayosService {
  private readonly logger = new Logger(PayosService.name);
  private readonly payos: InstanceType<typeof PayOS> | null = null;

  constructor(config: ConfigService) {
    const clientId = config.get<string>('PAYOS_CLIENT_ID') ?? '';
    const apiKey = config.get<string>('PAYOS_API_KEY') ?? '';
    const checksumKey = config.get<string>('PAYOS_CHECKSUM_KEY') ?? '';

    if (clientId && apiKey && checksumKey) {
      this.payos = new PayOS({ clientId, apiKey, checksumKey });
      this.logger.log('PayOS client initialized');
    } else {
      this.logger.warn('PayOS keys not set — running in MOCK mode');
    }
  }

  isMockMode(): boolean {
    return this.payos === null;
  }

  async createPaymentLink(params: CreatePaymentLinkParams): Promise<PaymentLinkResult> {
    if (this.payos === null) {
      return {
        checkoutUrl: `/mock-payos-checkout?orderCode=${params.orderCode}&amount=${params.amount}`,
        qrCode: '',
        isMock: true,
      };
    }

    const link = await this.payos.paymentRequests.create({
      orderCode: params.orderCode,
      amount: params.amount,
      description: params.description,
      returnUrl: params.returnUrl,
      cancelUrl: params.cancelUrl,
    });

    return {
      checkoutUrl: link.checkoutUrl ?? '',
      qrCode: link.qrCode ?? '',
      isMock: false,
    };
  }

  async verifyWebhookData(body: unknown): Promise<{ orderCode: string; code: string }> {
    if (this.payos === null) {
      throw new Error('PayOS not configured — cannot verify webhook');
    }
    // biome-ignore lint/suspicious/noExplicitAny: @payos/node lacks typed webhook verification
    const data = await this.payos.webhooks.verify(body as any);
    return {
      // biome-ignore lint/suspicious/noExplicitAny: @payos/node lacks typed webhook verification
      orderCode: String((data as any).orderCode ?? (data as any).data?.orderCode ?? ''),
      // biome-ignore lint/suspicious/noExplicitAny: @payos/node lacks typed webhook verification
      code: String((data as any).code ?? '00'),
    };
  }
}
