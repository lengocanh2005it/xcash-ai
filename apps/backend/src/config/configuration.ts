function resolveCasLinkBaseUrl(): string {
  if (process.env.CAS_LINK_BASE_URL) {
    return process.env.CAS_LINK_BASE_URL;
  }

  const apiBaseUrl = process.env.CAS_API_BASE_URL ?? 'https://sandbox.bankhub.dev';
  return apiBaseUrl.includes('sandbox')
    ? 'https://dev.link.bankhub.dev'
    : 'https://link.bankhub.dev';
}

export default () => ({
  NODE_ENV: process.env.NODE_ENV ?? 'development',
  PORT: Number.parseInt(process.env.PORT ?? '3000', 10),
  APP_URL: process.env.APP_URL ?? 'http://localhost:3000',
  FRONTEND_URL: process.env.FRONTEND_URL ?? 'http://localhost:5173',
  DATABASE_URL: process.env.DATABASE_URL,
  REDIS_URL: process.env.REDIS_URL ?? 'redis://localhost:6379',
  JWT_ACCESS_SECRET: process.env.JWT_ACCESS_SECRET ?? 'dev-access-secret-change-me',
  JWT_ACCESS_EXPIRES_IN: process.env.JWT_ACCESS_EXPIRES_IN ?? '15m',
  JWT_REFRESH_SECRET: process.env.JWT_REFRESH_SECRET ?? 'dev-refresh-secret-change-me',
  JWT_REFRESH_EXPIRES_IN: process.env.JWT_REFRESH_EXPIRES_IN ?? '7d',
  CAS_API_BASE_URL: process.env.CAS_API_BASE_URL ?? 'https://sandbox.bankhub.dev',
  CAS_LINK_BASE_URL: resolveCasLinkBaseUrl(),
  CAS_API_VERSION: process.env.CAS_API_VERSION ?? '2023-01-01',
  CAS_CLIENT_ID: process.env.CAS_CLIENT_ID ?? '',
  CAS_SECRET_KEY: process.env.CAS_SECRET_KEY ?? '',
  CAS_GRANT_REDIRECT_URI:
    process.env.CAS_GRANT_REDIRECT_URI ?? 'http://localhost:5173/onboarding/callback',
  CORS_ORIGIN: process.env.CORS_ORIGIN ?? 'http://localhost:5173',
  WEBHOOK_SIGNATURE_HEADER: process.env.WEBHOOK_SIGNATURE_HEADER ?? 'X-Cas-Signature',
  WEBHOOK_TIMESTAMP_TOLERANCE_SECONDS: Number.parseInt(
    process.env.WEBHOOK_TIMESTAMP_TOLERANCE_SECONDS ?? '300',
    10,
  ),
  WEBHOOK_IDEMPOTENCY_TTL_SECONDS: Number.parseInt(
    process.env.WEBHOOK_IDEMPOTENCY_TTL_SECONDS ?? '86400',
    10,
  ),
  WEBHOOK_SKIP_SIGNATURE_VERIFY: process.env.WEBHOOK_SKIP_SIGNATURE_VERIFY ?? 'false',
});
