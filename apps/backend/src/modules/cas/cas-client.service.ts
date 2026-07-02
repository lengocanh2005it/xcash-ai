import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

export const CAS_DEFAULT_GRANT_SCOPES = 'identity,transaction';

export interface CasGrantTokenRequest {
  scopes: string;
  language?: string;
  redirectUri: string;
}

export interface CasGrantTokenResponse {
  grantToken: string;
  expiresAt?: string;
}

export interface CasGrantExchangeResponse {
  accessToken: string;
  grantId: string;
}

export interface CasIdentityAccount {
  accountNumber?: string;
  bankName?: string;
  fiName?: string;
  accountHolderName?: string;
  holderName?: string;
  accountName?: string;
}

export interface CasIdentityResponse {
  accountNumber?: string;
  bankName?: string;
  accountHolderName?: string;
  holderName?: string;
  accountName?: string;
  legalName?: string;
  accounts?: CasIdentityAccount[];
}

function extractCasErrorMessage(data: unknown, status: number): string {
  if (typeof data === 'object' && data !== null) {
    const record = data as Record<string, unknown>;
    const message = record.errorMessage ?? record.message ?? record.error ?? record.errorCode;
    if (message) {
      return String(message);
    }
    if ('raw' in record && record.raw) {
      return String(record.raw);
    }
  }

  return `Cas API error ${status}`;
}

function unwrapCasPayload(data: unknown): Record<string, unknown> {
  if (typeof data !== 'object' || data === null) {
    return {};
  }

  const record = data as Record<string, unknown>;
  if (typeof record.data === 'object' && record.data !== null) {
    return record.data as Record<string, unknown>;
  }

  return record;
}

export function mapGrantExchangeResponse(data: unknown): CasGrantExchangeResponse {
  const payload = unwrapCasPayload(data);
  const accessToken = payload.accessToken ?? payload.access_token;
  const grantId = payload.grantId ?? payload.grant_id;

  if (!accessToken || !grantId) {
    throw new Error('Cas /grant/exchange response thiếu accessToken hoặc grantId');
  }

  return {
    accessToken: String(accessToken),
    grantId: String(grantId),
  };
}

export function mapGrantTokenResponse(data: unknown): CasGrantTokenResponse {
  const payload = unwrapCasPayload(data);
  const grantToken = payload.grantToken ?? payload.grant_token ?? payload.linkToken;

  if (!grantToken) {
    throw new Error('Cas /grant/token response thiếu grantToken');
  }

  const expiresAt = payload.expiresAt ?? payload.expires_at;
  return {
    grantToken: String(grantToken),
    expiresAt: expiresAt ? String(expiresAt) : undefined,
  };
}

@Injectable()
export class CasClientService {
  private readonly logger = new Logger(CasClientService.name);
  private readonly baseUrl: string;
  private readonly apiVersion: string;
  private readonly clientId: string;
  private readonly secretKey: string;

  constructor(private readonly configService: ConfigService) {
    this.baseUrl = this.configService.get<string>(
      'CAS_API_BASE_URL',
      'https://sandbox.bankhub.dev',
    );
    this.apiVersion = this.configService.get<string>('CAS_API_VERSION', '2023-01-01');
    this.clientId = this.configService.get<string>('CAS_CLIENT_ID', '');
    this.secretKey = this.configService.get<string>('CAS_SECRET_KEY', '');
  }

  isConfigured(): boolean {
    return Boolean(this.clientId && this.secretKey);
  }

  async createGrantToken(payload: CasGrantTokenRequest): Promise<CasGrantTokenResponse> {
    const data = await this.request<unknown>('/grant/token', {
      method: 'POST',
      body: JSON.stringify({
        scopes: payload.scopes,
        language: payload.language ?? 'vi',
        redirectUri: payload.redirectUri,
      }),
    });

    return mapGrantTokenResponse(data);
  }

  async exchangeGrant(publicToken: string): Promise<CasGrantExchangeResponse> {
    const data = await this.request<unknown>('/grant/exchange', {
      method: 'POST',
      body: JSON.stringify({ publicToken }),
    });

    return mapGrantExchangeResponse(data);
  }

  async getIdentity(accessToken: string): Promise<CasIdentityResponse> {
    return this.requestWithAccessToken<CasIdentityResponse>(
      '/identity',
      { method: 'GET' },
      accessToken,
    );
  }

  parseIdentity(identity: CasIdentityResponse): {
    accountNumber: string | null;
    accountHolderName: string | null;
    bankName: string | null;
  } {
    const firstAccount = identity.accounts?.[0];
    const accountHolderName =
      identity.accountHolderName ??
      identity.holderName ??
      identity.accountName ??
      identity.legalName ??
      firstAccount?.accountHolderName ??
      firstAccount?.holderName ??
      firstAccount?.accountName ??
      null;

    return {
      accountNumber: identity.accountNumber ?? firstAccount?.accountNumber ?? null,
      accountHolderName: accountHolderName ? String(accountHolderName) : null,
      bankName: identity.bankName ?? firstAccount?.bankName ?? firstAccount?.fiName ?? null,
    };
  }

  async ping(): Promise<{ ok: boolean; message: string }> {
    if (!this.isConfigured()) {
      return {
        ok: false,
        message: 'Thiếu CAS_CLIENT_ID hoặc CAS_SECRET_KEY trong biến môi trường',
      };
    }

    try {
      await this.createGrantToken({
        scopes: CAS_DEFAULT_GRANT_SCOPES,
        redirectUri: this.configService.get<string>(
          'CAS_GRANT_REDIRECT_URI',
          'http://localhost:5173/onboarding/callback',
        ),
      });
      return { ok: true, message: 'Kết nối Cas sandbox thành công' };
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Không thể kết nối Cas sandbox';
      this.logger.warn(`Cas ping failed: ${message}`);
      return { ok: false, message };
    }
  }

  private async request<T>(path: string, init: RequestInit): Promise<T> {
    if (!this.isConfigured()) {
      throw new Error('Thiếu CAS_CLIENT_ID hoặc CAS_SECRET_KEY trong biến môi trường');
    }

    const response = await fetch(`${this.baseUrl}${path}`, {
      ...init,
      headers: {
        'Content-Type': 'application/json',
        'x-client-id': this.clientId,
        'x-secret-key': this.secretKey,
        'X-BankHub-Api-Version': this.apiVersion,
        ...(init.headers ?? {}),
      },
    });

    const text = await response.text();
    let data: unknown = {};
    if (text) {
      try {
        data = JSON.parse(text);
      } catch {
        data = { raw: text };
      }
    }

    if (!response.ok) {
      const errorMessage = extractCasErrorMessage(data, response.status);
      this.logger.warn(`Cas ${init.method ?? 'GET'} ${path} failed: ${errorMessage}`);
      throw new Error(errorMessage);
    }

    return data as T;
  }

  private async requestWithAccessToken<T>(
    path: string,
    init: RequestInit,
    accessToken: string,
  ): Promise<T> {
    if (!this.isConfigured()) {
      throw new Error('Thiếu CAS_CLIENT_ID hoặc CAS_SECRET_KEY trong biến môi trường');
    }

    const response = await fetch(`${this.baseUrl}${path}`, {
      ...init,
      headers: {
        'x-client-id': this.clientId,
        'x-secret-key': this.secretKey,
        'X-BankHub-Api-Version': this.apiVersion,
        // Cas quickstart: Authorization header is the raw access token (no Bearer prefix).
        Authorization: accessToken,
        ...(init.headers ?? {}),
      },
    });

    const text = await response.text();
    let data: unknown = {};
    if (text) {
      try {
        data = JSON.parse(text);
      } catch {
        data = { raw: text };
      }
    }

    if (!response.ok) {
      const errorMessage = extractCasErrorMessage(data, response.status);
      this.logger.warn(`Cas ${init.method ?? 'GET'} ${path} failed: ${errorMessage}`);
      throw new Error(errorMessage);
    }

    const payload = unwrapCasPayload(data);
    return payload as T;
  }
}
