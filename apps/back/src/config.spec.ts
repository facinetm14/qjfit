import { loadConfig } from './config';

describe('loadConfig', () => {
  it('throws when required variables are missing', () => {
    expect(() => {
      loadConfig({});
    }).toThrow('Invalid environment configuration');
  });

  it('throws when REDIS_URL is missing', () => {
    expect(() => {
      loadConfig({
        DATABASE_URL: 'postgresql://QJFit:password@db:5432/QJFit',
        NODE_ENV: 'development',
        PORT: '3000',
        CORS_ORIGIN: 'http://localhost:5173'
      });
    }).toThrow('Invalid environment configuration');
  });

  it('parses valid environment variables', () => {
    const config = loadConfig({
      DATABASE_URL: 'postgresql://QJFit:password@db:5432/QJFit',
      REDIS_URL: 'redis://localhost:6379',
      NODE_ENV: 'development',
      PORT: '3000',
      CORS_ORIGIN: 'http://localhost:5173'
    });

    expect(config.PORT).toBe(3000);
  });

  it('defaults FETCH_RUN_CRON_SCHEDULE to every 4 hours when unset', () => {
    const config = loadConfig({
      DATABASE_URL: 'postgresql://QJFit:password@db:5432/QJFit',
      REDIS_URL: 'redis://localhost:6379',
      NODE_ENV: 'development',
      PORT: '3000',
      CORS_ORIGIN: 'http://localhost:5173'
    });

    expect(config.FETCH_RUN_CRON_SCHEDULE).toBe('0 */4 * * *');
  });

  it('accepts a custom FETCH_RUN_CRON_SCHEDULE cron expression', () => {
    const config = loadConfig({
      DATABASE_URL: 'postgresql://QJFit:password@db:5432/QJFit',
      REDIS_URL: 'redis://localhost:6379',
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
      REDIS_URL: 'redis://localhost:6379',
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

  it('defaults FRANCE_TRAVAIL_PAGE_SIZE to 150 when unset', () => {
    const config = loadConfig({
      DATABASE_URL: 'postgresql://QJFit:password@db:5432/QJFit',
      REDIS_URL: 'redis://localhost:6379',
      NODE_ENV: 'development',
      PORT: '3000',
      CORS_ORIGIN: 'http://localhost:5173'
    });

    expect(config.FRANCE_TRAVAIL_PAGE_SIZE).toBe(150);
  });

  it('accepts a custom FRANCE_TRAVAIL_PAGE_SIZE', () => {
    const config = loadConfig({
      DATABASE_URL: 'postgresql://QJFit:password@db:5432/QJFit',
      REDIS_URL: 'redis://localhost:6379',
      NODE_ENV: 'development',
      PORT: '3000',
      CORS_ORIGIN: 'http://localhost:5173',
      FRANCE_TRAVAIL_PAGE_SIZE: '50'
    });

    expect(config.FRANCE_TRAVAIL_PAGE_SIZE).toBe(50);
  });

  it('rejects a FRANCE_TRAVAIL_PAGE_SIZE above the API max span of 150', () => {
    expect(() => {
      loadConfig({
        DATABASE_URL: 'postgresql://QJFit:password@db:5432/QJFit',
        NODE_ENV: 'development',
        PORT: '3000',
        CORS_ORIGIN: 'http://localhost:5173',
        FRANCE_TRAVAIL_PAGE_SIZE: '151'
      });
    }).toThrow('Invalid environment configuration');
  });

  it('defaults WTTJ_RSS_FEED_URL to an empty string when unset', () => {
    const config = loadConfig({
      DATABASE_URL: 'postgresql://QJFit:password@db:5432/QJFit',
      REDIS_URL: 'redis://localhost:6379',
      NODE_ENV: 'development',
      PORT: '3000',
      CORS_ORIGIN: 'http://localhost:5173'
    });

    expect(config.WTTJ_RSS_FEED_URL).toBe('');
  });

  it('defaults SCORING_CANDIDATE_LIMIT to 50 and SCORING_DECAY_DAYS to 14 when unset', () => {
    const config = loadConfig({
      DATABASE_URL: 'postgresql://QJFit:password@db:5432/QJFit',
      REDIS_URL: 'redis://localhost:6379',
      NODE_ENV: 'development',
      PORT: '3000',
      CORS_ORIGIN: 'http://localhost:5173'
    });

    expect(config.SCORING_CANDIDATE_LIMIT).toBe(50);
    expect(config.SCORING_DECAY_DAYS).toBe(14);
  });

  it('accepts custom SCORING_CANDIDATE_LIMIT and SCORING_DECAY_DAYS values', () => {
    const config = loadConfig({
      DATABASE_URL: 'postgresql://QJFit:password@db:5432/QJFit',
      REDIS_URL: 'redis://localhost:6379',
      NODE_ENV: 'development',
      PORT: '3000',
      CORS_ORIGIN: 'http://localhost:5173',
      SCORING_CANDIDATE_LIMIT: '25',
      SCORING_DECAY_DAYS: '7'
    });

    expect(config.SCORING_CANDIDATE_LIMIT).toBe(25);
    expect(config.SCORING_DECAY_DAYS).toBe(7);
  });

  it('defaults ROLE_SIMILARITY_THRESHOLD to 0.25 when unset', () => {
    const config = loadConfig({
      DATABASE_URL: 'postgresql://QJFit:password@db:5432/QJFit',
      REDIS_URL: 'redis://localhost:6379',
      NODE_ENV: 'development',
      PORT: '3000',
      CORS_ORIGIN: 'http://localhost:5173'
    });

    expect(config.ROLE_SIMILARITY_THRESHOLD).toBe(0.25);
  });

  it('accepts a custom ROLE_SIMILARITY_THRESHOLD', () => {
    const config = loadConfig({
      DATABASE_URL: 'postgresql://QJFit:password@db:5432/QJFit',
      REDIS_URL: 'redis://localhost:6379',
      NODE_ENV: 'development',
      PORT: '3000',
      CORS_ORIGIN: 'http://localhost:5173',
      ROLE_SIMILARITY_THRESHOLD: '0.4'
    });

    expect(config.ROLE_SIMILARITY_THRESHOLD).toBe(0.4);
  });

  it('rejects a ROLE_SIMILARITY_THRESHOLD outside [0, 1]', () => {
    expect(() => {
      loadConfig({
        DATABASE_URL: 'postgresql://QJFit:password@db:5432/QJFit',
        NODE_ENV: 'development',
        PORT: '3000',
        CORS_ORIGIN: 'http://localhost:5173',
        ROLE_SIMILARITY_THRESHOLD: '1.5'
      });
    }).toThrow('Invalid environment configuration');
  });
});
