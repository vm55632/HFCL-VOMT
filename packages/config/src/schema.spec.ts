import { loadConfig, ConfigError } from './index';

const base: NodeJS.ProcessEnv = {
  NODE_ENV: 'development',
  DATABASE_URL: 'postgresql://vop:pw@localhost:5432/vop',
  VOP_MASTER_KEY: 'dev-master-key',
};

describe('loadConfig', () => {
  it('parses a minimal valid environment with sensible defaults', () => {
    const cfg = loadConfig(base);
    expect(cfg.env).toBe('development');
    expect(cfg.api.port).toBe(3000);
    expect(cfg.drivers.storage).toBe('minio');
    expect(cfg.api.corsOrigins).toEqual(['http://localhost:3001']);
    expect(cfg.data.auditRetentionDays).toBe(2920);
  });

  it('throws ConfigError when DATABASE_URL is missing', () => {
    const { DATABASE_URL: _omit, ...noDb } = base;
    expect(() => loadConfig(noDb)).toThrow(ConfigError);
  });

  it('rejects a CORS wildcard', () => {
    expect(() => loadConfig({ ...base, VOP_CORS_ORIGINS: 'https://a.example,*' })).toThrow(
      /wildcard/,
    );
  });

  it('forbids the env secrets driver in production', () => {
    expect(() =>
      loadConfig({
        ...base,
        NODE_ENV: 'production',
        VOP_SECRETS_DRIVER: 'env',
        VOP_KEY_DRIVER: 'vault-transit',
        VOP_COOKIE_SECURE: 'true',
      }),
    ).toThrow(/dev-only/);
  });

  it('requires a master key when the key driver is local', () => {
    const { VOP_MASTER_KEY: _omit, ...noKey } = base;
    expect(() => loadConfig({ ...noKey, VOP_KEY_DRIVER: 'local' })).toThrow(/VOP_MASTER_KEY/);
  });

  it('coerces booleans and numbers from strings', () => {
    const cfg = loadConfig({ ...base, VOP_SMTP_SECURE: 'true', VOP_API_PORT: '4000' });
    expect(cfg.email.smtpSecure).toBe(true);
    expect(cfg.api.port).toBe(4000);
  });
});
