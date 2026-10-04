import { envSchema, type Env } from './schema';

export type { Env } from './schema';

/**
 * Structured, typed configuration derived from the validated environment.
 * The rest of the app depends on this shape, not on process.env.
 */
export interface AppConfig {
  env: Env['NODE_ENV'];
  isProduction: boolean;
  isTest: boolean;
  api: { port: number; url: string; publicUrl: string; corsOrigins: string[] };
  data: { region: string; auditRetentionDays: number };
  database: { url: string };
  redis: { url: string };
  jobs: { enabled: boolean; slaSweepCron: string };
  drivers: {
    storage: Env['VOP_STORAGE_DRIVER'];
    secrets: Env['VOP_SECRETS_DRIVER'];
    email: Env['VOP_EMAIL_DRIVER'];
    sms: Env['VOP_SMS_DRIVER'];
    queue: Env['VOP_QUEUE_DRIVER'];
    scan: Env['VOP_SCAN_DRIVER'];
    key: Env['VOP_KEY_DRIVER'];
    verification: Env['VOP_VERIFICATION_DRIVER'];
  };
  storage: {
    endpoint: string;
    bucket: string;
    accessKey?: string;
    secretKey?: string;
    region: string;
  };
  vault: { addr?: string; token?: string };
  crypto: { masterKey?: string; blindIndexKey?: string };
  email: {
    smtpHost: string;
    smtpPort: number;
    smtpSecure: boolean;
    smtpUser?: string;
    smtpPassword?: string;
    from: string;
  };
  scan: { host: string; port: number };
  uploads: { maxBytes: number };
  session: {
    cookieName: string;
    idleMinutes: number;
    absoluteHours: number;
    cookieSecure: boolean;
  };
  identity: {
    oidc: { issuer?: string; clientId?: string; clientSecret?: string; redirectUri?: string };
    saml: { enabled: boolean; entryPoint?: string; issuer?: string; cert?: string };
    localLoginEnabled: boolean;
  };
  auth: {
    driver: Env['VOP_AUTH_DRIVER'];
    supabase: { url?: string; anonKey?: string; jwtSecret?: string; serviceRoleKey?: string };
  };
  observability: { logLevel: Env['VOP_LOG_LEVEL']; otelEnabled: boolean; otelEndpoint?: string };
  panVerify: {
    enabled: boolean;
    baseUrl: string;
    username?: string;
    password?: string;
    token?: string;
    serviceTypeId: string;
    gstServiceTypeId: string;
    gstVerifyServiceTypeId: string;
    bankVerifyServiceTypeId: string;
    msmeServiceTypeId: string;
  };
}

function shape(env: Env): AppConfig {
  return {
    env: env.NODE_ENV,
    isProduction: env.NODE_ENV === 'production',
    isTest: env.NODE_ENV === 'test',
    api: {
      port: env.VOP_API_PORT,
      url: env.VOP_API_URL,
      publicUrl: env.VOP_PUBLIC_URL,
      corsOrigins: env.VOP_CORS_ORIGINS.split(',')
        .map((o) => o.trim())
        .filter(Boolean),
    },
    data: { region: env.VOP_DATA_REGION, auditRetentionDays: env.VOP_AUDIT_RETENTION_DAYS },
    database: { url: env.DATABASE_URL },
    redis: { url: env.REDIS_URL },
    jobs: { enabled: env.VOP_JOBS_ENABLED, slaSweepCron: env.VOP_SLA_SWEEP_CRON },
    drivers: {
      storage: env.VOP_STORAGE_DRIVER,
      secrets: env.VOP_SECRETS_DRIVER,
      email: env.VOP_EMAIL_DRIVER,
      sms: env.VOP_SMS_DRIVER,
      queue: env.VOP_QUEUE_DRIVER,
      scan: env.VOP_SCAN_DRIVER,
      key: env.VOP_KEY_DRIVER,
      verification: env.VOP_VERIFICATION_DRIVER,
    },
    storage: {
      endpoint: env.VOP_STORAGE_ENDPOINT,
      bucket: env.VOP_STORAGE_BUCKET,
      accessKey: env.VOP_STORAGE_ACCESS_KEY,
      secretKey: env.VOP_STORAGE_SECRET_KEY,
      region: env.VOP_STORAGE_REGION,
    },
    vault: { addr: env.VOP_VAULT_ADDR, token: env.VOP_VAULT_TOKEN },
    crypto: { masterKey: env.VOP_MASTER_KEY, blindIndexKey: env.VOP_BLIND_INDEX_KEY },
    email: {
      smtpHost: env.VOP_SMTP_HOST,
      smtpPort: env.VOP_SMTP_PORT,
      smtpSecure: env.VOP_SMTP_SECURE,
      smtpUser: env.VOP_SMTP_USER,
      smtpPassword: env.VOP_SMTP_PASSWORD,
      from: env.VOP_EMAIL_FROM,
    },
    scan: { host: env.VOP_CLAMAV_HOST, port: env.VOP_CLAMAV_PORT },
    uploads: { maxBytes: env.VOP_MAX_UPLOAD_MB * 1024 * 1024 },
    session: {
      cookieName: env.VOP_SESSION_COOKIE_NAME,
      idleMinutes: env.VOP_SESSION_IDLE_MINUTES,
      absoluteHours: env.VOP_SESSION_ABSOLUTE_HOURS,
      cookieSecure: env.VOP_COOKIE_SECURE,
    },
    identity: {
      oidc: {
        issuer: env.VOP_OIDC_ISSUER,
        clientId: env.VOP_OIDC_CLIENT_ID,
        clientSecret: env.VOP_OIDC_CLIENT_SECRET,
        redirectUri: env.VOP_OIDC_REDIRECT_URI,
      },
      saml: {
        enabled: env.VOP_SAML_ENABLED,
        entryPoint: env.VOP_SAML_ENTRY_POINT,
        issuer: env.VOP_SAML_ISSUER,
        cert: env.VOP_SAML_CERT,
      },
      localLoginEnabled: env.VOP_LOCAL_LOGIN_ENABLED,
    },
    auth: {
      driver: env.VOP_AUTH_DRIVER,
      supabase: {
        url: env.VOP_SUPABASE_URL,
        anonKey: env.VOP_SUPABASE_ANON_KEY,
        jwtSecret: env.VOP_SUPABASE_JWT_SECRET,
        serviceRoleKey: env.VOP_SUPABASE_SERVICE_ROLE_KEY,
      },
    },
    observability: {
      logLevel: env.VOP_LOG_LEVEL,
      otelEnabled: env.VOP_OTEL_ENABLED,
      otelEndpoint: env.VOP_OTEL_EXPORTER_OTLP_ENDPOINT,
    },
    panVerify: {
      enabled: env.VOP_PAN_VERIFY_ENABLED,
      baseUrl: env.VOP_EY_NEXUS_BASE_URL,
      username: env.VOP_EY_NEXUS_USERNAME,
      password: env.VOP_EY_NEXUS_PASSWORD,
      token: env.VOP_EY_NEXUS_TOKEN,
      serviceTypeId: env.VOP_EY_PAN_SERVICE_TYPE_ID,
      gstServiceTypeId: env.VOP_EY_GST_BY_PAN_SERVICE_TYPE_ID,
      gstVerifyServiceTypeId: env.VOP_EY_GST_VERIFY_SERVICE_TYPE_ID,
      bankVerifyServiceTypeId: env.VOP_EY_BANK_VERIFY_SERVICE_TYPE_ID,
      msmeServiceTypeId: env.VOP_EY_MSME_SERVICE_TYPE_ID,
    },
  };
}

/** Thrown when the environment fails validation. Message is human-readable and safe to print. */
export class ConfigError extends Error {
  constructor(public readonly issues: string[]) {
    super(`Invalid environment configuration:\n  - ${issues.join('\n  - ')}`);
    this.name = 'ConfigError';
  }
}

/**
 * Validate `source` (default process.env) and return structured config.
 * Throws {@link ConfigError} listing every problem — call this once at boot and let it fail loudly.
 */
export function loadConfig(source: NodeJS.ProcessEnv = process.env): AppConfig {
  const parsed = envSchema.safeParse(source);
  if (!parsed.success) {
    const issues = parsed.error.issues.map((i) => `${i.path.join('.') || '(root)'}: ${i.message}`);
    throw new ConfigError(issues);
  }
  return shape(parsed.data);
}
