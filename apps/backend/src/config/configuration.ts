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
  JWT_REFRESH_SESSION_EXPIRES_IN: process.env.JWT_REFRESH_SESSION_EXPIRES_IN ?? '12h',
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
  OPENAI_API_KEY: process.env.OPENAI_API_KEY ?? '',
  OPENAI_EMBEDDING_MODEL: process.env.OPENAI_EMBEDDING_MODEL ?? 'text-embedding-3-small',
  OPENAI_CHAT_MODEL: process.env.OPENAI_CHAT_MODEL ?? 'gpt-4o-mini',
  AI_CLASSIFICATION_THRESHOLD: Number.parseInt(process.env.AI_CLASSIFICATION_THRESHOLD ?? '85', 10),
  RATE_LIMIT_PER_MINUTE: Number.parseInt(process.env.RATE_LIMIT_PER_MINUTE ?? '120', 10),
  PAYOS_CLIENT_ID: process.env.PAYOS_CLIENT_ID ?? '',
  PAYOS_API_KEY: process.env.PAYOS_API_KEY ?? '',
  PAYOS_CHECKSUM_KEY: process.env.PAYOS_CHECKSUM_KEY ?? '',
  PAYOS_BILLING_WEBHOOK_URL: process.env.PAYOS_BILLING_WEBHOOK_URL ?? '',
  RESEND_API_KEY: process.env.RESEND_API_KEY ?? '',
  RESEND_SENDER_EMAIL: process.env.RESEND_SENDER_EMAIL ?? 'noreply@xcash.ai',
  RESEND_SENDER_NAME: process.env.RESEND_SENDER_NAME ?? 'X-Cash AI',
  EMAIL_OTP_TTL_SECONDS: Number.parseInt(process.env.EMAIL_OTP_TTL_SECONDS ?? '600', 10),
  EMAIL_OTP_RESEND_COOLDOWN_SECONDS: Number.parseInt(
    process.env.EMAIL_OTP_RESEND_COOLDOWN_SECONDS ?? '60',
    10,
  ),
  EMAIL_OTP_MAX_ATTEMPTS: Number.parseInt(process.env.EMAIL_OTP_MAX_ATTEMPTS ?? '5', 10),
  TEAM_INVITE_TTL_SECONDS: Number.parseInt(process.env.TEAM_INVITE_TTL_SECONDS ?? '604800', 10),
  AZURE_STORAGE_CONNECTION_STRING: process.env.AZURE_STORAGE_CONNECTION_STRING ?? '',
  AZURE_STORAGE_CONTAINER_NAME: process.env.AZURE_STORAGE_CONTAINER_NAME ?? 'task-attachments',
  AZURE_STORAGE_MAX_FILE_SIZE: Number.parseInt(
    process.env.AZURE_STORAGE_MAX_FILE_SIZE ?? '5242880',
    10,
  ),
  COPILOT_USE_FUNCTION_CALLING: process.env.COPILOT_USE_FUNCTION_CALLING === '1',
  COPILOT_CONTEXT_CACHE_TTL_SECONDS: Number.parseInt(
    process.env.COPILOT_CONTEXT_CACHE_TTL_SECONDS ?? '300',
    10,
  ),
  COPILOT_CASSO_SEARCH_ENABLED: process.env.COPILOT_CASSO_SEARCH_ENABLED === '1',
  TAVILY_API_KEY: process.env.TAVILY_API_KEY ?? '',
});
