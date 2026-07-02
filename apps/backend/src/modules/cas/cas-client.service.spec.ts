import { mapGrantExchangeResponse, mapGrantTokenResponse } from './cas-client.service';

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
