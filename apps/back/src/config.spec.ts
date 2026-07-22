import { loadConfig } from './config';

describe('loadConfig', () => {
  it('throws when required variables are missing', () => {
    expect(() => {
      loadConfig({});
    }).toThrow('Invalid environment configuration');
  });

  it('parses valid environment variables', () => {
    const config = loadConfig({
      DATABASE_URL: 'postgresql://QJFit:password@db:5432/QJFit',
      NODE_ENV: 'development',
      PORT: '3000',
      CORS_ORIGIN: 'http://localhost:5173'
    });

    expect(config.PORT).toBe(3000);
  });

  it('defaults FETCH_RUN_CRON_SCHEDULE to every 4 hours when unset', () => {
    const config = loadConfig({
      DATABASE_URL: 'postgresql://QJFit:password@db:5432/QJFit',
      NODE_ENV: 'development',
      PORT: '3000',
      CORS_ORIGIN: 'http://localhost:5173'
    });

    expect(config.FETCH_RUN_CRON_SCHEDULE).toBe('0 */4 * * *');
  });

  it('accepts a custom FETCH_RUN_CRON_SCHEDULE cron expression', () => {
    const config = loadConfig({
      DATABASE_URL: 'postgresql://QJFit:password@db:5432/QJFit',
      NODE_ENV: 'development',
      PORT: '3000',
      CORS_ORIGIN: 'http://localhost:5173',
      FETCH_RUN_CRON_SCHEDULE: '*/15 * * * *'
    });

    expect(config.FETCH_RUN_CRON_SCHEDULE).toBe('*/15 * * * *');
  });

  it('rejects an invalid FETCH_RUN_CRON_SCHEDULE cron expression', () => {
    expect(() => {
      loadConfig({
        DATABASE_URL: 'postgresql://QJFit:password@db:5432/QJFit',
        NODE_ENV: 'development',
        PORT: '3000',
        CORS_ORIGIN: 'http://localhost:5173',
        FETCH_RUN_CRON_SCHEDULE: 'not-a-cron-expression'
      });
    }).toThrow('Invalid environment configuration');
  });

  it('defaults connector config to empty strings when unset', () => {
    const config = loadConfig({
      DATABASE_URL: 'postgresql://QJFit:password@db:5432/QJFit',
      NODE_ENV: 'development',
      PORT: '3000',
      CORS_ORIGIN: 'http://localhost:5173'
    });

    expect(config.FRANCE_TRAVAIL_BASE_URL).toBe('');
    expect(config.FRANCE_TRAVAIL_ACCESS_TOKEN).toBe('');
    expect(config.WTTJ_RSS_FEED_URL).toBe('');
  });
});
