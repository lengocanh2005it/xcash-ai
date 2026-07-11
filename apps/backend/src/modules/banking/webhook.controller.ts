import { Body, Controller, Headers, Logger, Post, Req } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import type { Request } from 'express';
import { BankingService } from './banking.service';
import { CasWebhookHandler } from './cas-webhook.handler';
import type { CasWebhookDto } from './dto/banking.dto';

@ApiTags('Webhook')
@Controller('webhook')
export class WebhookController {
  private readonly logger = new Logger(WebhookController.name);

  constructor(
    private readonly bankingService: BankingService,
    private readonly webhookHandler: CasWebhookHandler,
  ) {}

  @Post('cas')
  @ApiOperation({ summary: 'Nhận webhook Cas Balance Hook (TRANSACTIONS)' })
  handleCasWebhook(
    @Req() req: Request & { rawBody?: Buffer },
    @Body() payload: CasWebhookDto,
    @Headers('x-cas-signature') signature?: string,
    @Headers('x-cas-timestamp') timestamp?: string,
  ) {
    const rawBody =
      req.rawBody?.toString('utf8') ??
      (typeof req.body === 'string' ? req.body : JSON.stringify(req.body));

    const configuredHeader = req.headers['x-cas-signature'] ? 'X-Cas-Signature' : 'X-Cas-Signature';
    const signatureHeader =
      signature ?? (req.headers[configuredHeader.toLowerCase()] as string | undefined);

    const normalizedPayload: CasWebhookDto =
      payload ?? (rawBody ? (JSON.parse(rawBody) as CasWebhookDto) : {});

    if (process.env.NODE_ENV !== 'production') {
      this.logger.log('── Cas webhook incoming ──');
      this.logger.log(`raw body: ${rawBody}`);
      this.logger.log(`parsed payload: ${JSON.stringify(normalizedPayload, null, 2)}`);
      this.logger.log(
        `headers: ${JSON.stringify(
          {
            [configuredHeader]: signatureHeader,
            'x-cas-timestamp': timestamp,
            'content-type': req.headers['content-type'],
          },
          null,
          2,
        )}`,
      );
    }

    this.webhookHandler.verifySignature(rawBody, signatureHeader, timestamp);

    const parsedPayload = this.webhookHandler.parsePayload(normalizedPayload);
    if (!parsedPayload) {
      return this.bankingService.handleCasWebhook({
        transactionId: '',
        grantId: '',
        amount: 0,
        description: '',
        transactionDateTime: '',
        counterAccountName: '',
        fiName: '',
        isProbe: true,
      });
    }

    return this.bankingService.handleCasWebhook(parsedPayload);
  }
}
