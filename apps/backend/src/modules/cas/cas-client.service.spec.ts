import { ConfigService } from '@nestjs/config';
import {
  CasClientService,
  mapGrantExchangeResponse,
  mapGrantTokenResponse,
} from './cas-client.service';

describe('CasClientService.parseIdentity', () => {
  const service = new CasClientService({ get: () => '' } as unknown as ConfigService);

  it('maps camelCase identity at top level', () => {
    expect(
      service.parseIdentity({
        accountNumber: '123456789',
        accountHolderName: 'Nguyen Van A',
        bankName: 'Vietcombank',
      }),
    ).toEqual({
      accountNumber: '123456789',
      accountHolderName: 'Nguyen Van A',
      bankName: 'Vietcombank',
      bankLogo: null,
    });
  });

  it('maps snake_case identity from accounts array', () => {
    expect(
      service.parseIdentity({
        accounts: [
          {
            account_number: '987654321',
            account_holder_name: 'Tran Thi B',
            brand_name: 'ACB',
          },
        ],
      }),
    ).toEqual({
      accountNumber: '987654321',
      accountHolderName: 'Tran Thi B',
      bankName: 'ACB',
      bankLogo: null,
    });
  });

  it('reads bank name from nested bank object', () => {
    expect(
      service.parseIdentity({
        accounts: [{ accountNumber: '111', name: 'Le Van C', bank: { shortName: 'TPBank' } }],
      }),
    ).toEqual({
      accountNumber: '111',
      accountHolderName: 'Le Van C',
      bankName: 'TPBank',
      bankLogo: null,
    });
  });

  it('maps Cas sandbox /identity shape (accounts + owner + fiService + logo)', () => {
    expect(
      service.parseIdentity({
        requestId: 'DIR4s3HgvLnTw5mO',
        accounts: [
          {
            accountNumber: '123456789',
            accountName: 'NGUYEN VAN A 1',
            balance: 37034096,
            currency: 'VND',
          },
        ],
        owner: {
          name: 'NGUYEN VAN A 1',
          legalId: '011022033044',
        },
        company: null,
        fiService: {
          code: 'vietcombank',
          name: 'VCB Digibank',
          type: 'PERSONAL',
          logo: 'https://img.bankhub.dev/rounded/vietcombank.png',
        },
      }),
    ).toEqual({
      accountNumber: '123456789',
      accountHolderName: 'NGUYEN VAN A 1',
      bankName: 'VCB Digibank',
      bankLogo: 'https://img.bankhub.dev/rounded/vietcombank.png',
    });
  });

  it('returns nulls when nothing matches', () => {
    expect(service.parseIdentity({})).toEqual({
      accountNumber: null,
      accountHolderName: null,
      bankName: null,
      bankLogo: null,
    });
  });
});

describe('CasClientService mappers', () => {
  it('maps camelCase grant exchange response', () => {
    expect(
      mapGrantExchangeResponse({
        accessToken: 'access-1',
        grantId: 'grant-1',
      }),
    ).toEqual({
      accessToken: 'access-1',
      grantId: 'grant-1',
    });
  });

  it('maps snake_case grant exchange response', () => {
    expect(
      mapGrantExchangeResponse({
        access_token: 'access-2',
        grant_id: 'grant-2',
      }),
    ).toEqual({
      accessToken: 'access-2',
      grantId: 'grant-2',
    });
  });

  it('maps nested grant token response', () => {
    expect(
      mapGrantTokenResponse({
        data: {
          grantToken: 'token-1',
          expiresAt: '2026-07-01T00:00:00.000Z',
        },
      }),
    ).toEqual({
      grantToken: 'token-1',
      expiresAt: '2026-07-01T00:00:00.000Z',
    });
  });
});
