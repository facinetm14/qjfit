/** @type {import('jest').Config} */
const path = require('node:path');

module.exports = {
  preset: 'ts-jest/presets/default-esm',
  testEnvironment: 'node',
  roots: ['<rootDir>/src'],
  testMatch: ['**/*.spec.ts'],
  extensionsToTreatAsEsm: ['.ts'],
  setupFiles: ['reflect-metadata'],
  transform: {
    '^.+\\.ts$': [
      'ts-jest',
      {
        useESM: true,
        tsconfig: path.join(__dirname, 'tsconfig.jest.json'),
        diagnostics: { ignoreCodes: [151002] }
      }
    ],
    // inversify and @inversifyjs/* ship ESM-only builds with no CommonJS
    // entry point; Jest's default require()-based loader can't load them
    // as-is, so they're downleveled via babel instead (see babel.config.cjs).
    '^.+\\.jsx?$': 'babel-jest'
  },
  transformIgnorePatterns: ['/node_modules/(?!(inversify|@inversifyjs)/)'],
  moduleNameMapper: {
    '^@cv/(.*)\\.js$': '<rootDir>/src/cv/$1',
    '^@fetch-runs/(.*)\\.js$': '<rootDir>/src/fetch-runs/$1',
    '^@jobs/(.*)\\.js$': '<rootDir>/src/jobs/$1',
    '^@match/(.*)\\.js$': '<rootDir>/src/match/$1',
    '^@rate-limiting/(.*)\\.js$': '<rootDir>/src/rate-limiting/$1',
    '^@scoring/(.*)\\.js$': '<rootDir>/src/scoring/$1',
    '^@shared/(.*)\\.js$': '<rootDir>/src/shared/$1',
    '^@composition-root/(.*)\\.js$': '<rootDir>/src/composition-root/$1',
    '^(\\.{1,2}/.*)\\.js$': '$1'
  }
};
