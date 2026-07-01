import { Body, Controller, Headers, Logger, Post, Req } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import type { Request } from 'express';
import { BankingService } from './banking.service';
import type { CasWebhookDto } from './dto/banking.dto';

@ApiTags('Webhook')
@Controller('webhook')
export class WebhookController {
  private readonly logger = new Logger(WebhookController.name);

  constructor(
    private readonly bankingService: BankingService,
    private readonly configService: ConfigService,
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

    const configuredHeader = this.configService.get<string>(
      'WEBHOOK_SIGNATURE_HEADER',
      'X-Cas-Signature',
    );
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

    this.bankingService.verifyWebhookSignature(rawBody, signatureHeader, timestamp);
    return this.bankingService.handleCasWebhook(normalizedPayload);
  }
}
