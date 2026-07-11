import { ConfigService } from '@nestjs/config';
import { Test, TestingModule } from '@nestjs/testing';
import { CasWebhookHandler } from './cas-webhook.handler';
import type { CasWebhookDto } from './dto/banking.dto';

describe('CasWebhookHandler', () => {
  let handler: CasWebhookHandler;

  const configService = {
    get: jest.fn().mockReturnValue(undefined),
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    configService.get.mockReturnValue(undefined);

    const module: TestingModule = await Test.createTestingModule({
      providers: [CasWebhookHandler, { provide: ConfigService, useValue: configService }],
    }).compile();

    handler = module.get<CasWebhookHandler>(CasWebhookHandler);
  });

  describe('parsePayload', () => {
    it('returns null for probe payload (no transaction)', () => {
      const probeDto: CasWebhookDto = {
        webhookType: 'TRANSACTIONS',
        grantId: '',
      };

      const result = handler.parsePayload(probeDto);
      expect(result).toBeNull();
    });

    it('parses valid transaction payload', () => {
      const dto: CasWebhookDto = {
        webhookType: 'TRANSACTIONS',
        grantId: 'grant-1',
        transaction: {
          id: 'txn-1',
          amount: 100000,
          description: 'Test payment',
          transactionDateTime: '2026-07-01T10:00:00.000Z',
          counterAccountName: 'Nguyen Van A',
          fiName: 'Test Bank',
        },
      };

      const result = handler.parsePayload(dto);

      expect(result).toEqual({
        transactionId: 'txn-1',
        grantId: 'grant-1',
        amount: 100000,
        description: 'Test payment',
        transactionDateTime: '2026-07-01T10:00:00.000Z',
        counterAccountName: 'Nguyen Van A',
        fiName: 'Test Bank',
        isProbe: false,
      });
    });

    it('handles missing optional fields', () => {
      const dto: CasWebhookDto = {
        transaction: {
          id: 'txn-2',
          amount: -50000,
          transactionDateTime: '2026-07-01T11:00:00.000Z',
        },
      };

      const result = handler.parsePayload(dto);

      expect(result).toEqual({
        transactionId: 'txn-2',
        grantId: '',
        amount: -50000,
        description: '',
        transactionDateTime: '2026-07-01T11:00:00.000Z',
        counterAccountName: '',
        fiName: '',
        isProbe: false,
      });
    });
  });

  describe('verifySignature', () => {
    it('skips verification when WEBHOOK_SKIP_SIGNATURE_VERIFY is true', () => {
      configService.get.mockImplementation((key: string) => {
        if (key === 'WEBHOOK_SKIP_SIGNATURE_VERIFY') return 'true';
        return undefined;
      });

      expect(() => handler.verifySignature('body', undefined, undefined)).not.toThrow();
    });
  });
});
