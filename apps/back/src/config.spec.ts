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

  it('defaults France Travail URLs/scope to their real platform values, and credentials to empty strings, when unset', () => {
    const config = loadConfig({
      DATABASE_URL: 'postgresql://QJFit:password@db:5432/QJFit',
      NODE_ENV: 'development',
      PORT: '3000',
      CORS_ORIGIN: 'http://localhost:5173'
    });

    expect(config.FRANCE_TRAVAIL_BASE_URL).toBe(
      'https://api.francetravail.io/partenaire/offresdemploi/v2'
    );
    expect(config.FRANCE_TRAVAIL_AUTH_URL).toBe(
      'https://entreprise.francetravail.fr/connexion/oauth2/access_token?realm=/partenaire'
    );
    expect(config.FRANCE_TRAVAIL_SCOPE).toBe('api_offresdemploiv2 o2dsoffre');
    expect(config.FRANCE_TRAVAIL_CLIENT_ID).toBe('');
    expect(config.FRANCE_TRAVAIL_CLIENT_SECRET).toBe('');
  });

  it('defaults FRANCE_TRAVAIL_RESULTS_RANGE to the first page of 150 results when unset', () => {
    const config = loadConfig({
      DATABASE_URL: 'postgresql://QJFit:password@db:5432/QJFit',
      NODE_ENV: 'development',
      PORT: '3000',
      CORS_ORIGIN: 'http://localhost:5173'
    });

    expect(config.FRANCE_TRAVAIL_RESULTS_RANGE).toBe('0-149');
  });

  it('accepts a custom FRANCE_TRAVAIL_RESULTS_RANGE', () => {
    const config = loadConfig({
      DATABASE_URL: 'postgresql://QJFit:password@db:5432/QJFit',
      NODE_ENV: 'development',
      PORT: '3000',
      CORS_ORIGIN: 'http://localhost:5173',
      FRANCE_TRAVAIL_RESULTS_RANGE: '150-299'
    });

    expect(config.FRANCE_TRAVAIL_RESULTS_RANGE).toBe('150-299');
  });

  it('rejects an invalid FRANCE_TRAVAIL_RESULTS_RANGE format', () => {
    expect(() => {
      loadConfig({
        DATABASE_URL: 'postgresql://QJFit:password@db:5432/QJFit',
        NODE_ENV: 'development',
        PORT: '3000',
        CORS_ORIGIN: 'http://localhost:5173',
        FRANCE_TRAVAIL_RESULTS_RANGE: 'not-a-range'
      });
    }).toThrow('Invalid environment configuration');
  });

  it('defaults WTTJ_RSS_FEED_URL to an empty string when unset', () => {
    const config = loadConfig({
      DATABASE_URL: 'postgresql://QJFit:password@db:5432/QJFit',
      NODE_ENV: 'development',
      PORT: '3000',
      CORS_ORIGIN: 'http://localhost:5173'
    });

    expect(config.WTTJ_RSS_FEED_URL).toBe('');
  });
});
