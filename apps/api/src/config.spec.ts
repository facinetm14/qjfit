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
});
