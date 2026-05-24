import request from 'supertest';
import pino from 'pino';
import { createApp } from './app';
import { GetProfileService } from './core/services/get-profile.service.js';
import { UpsertProfileService } from './core/services/upsert-profile.service.js';
import type { ProfileRepositoryPort } from './core/ports/driven/profile-repository.port.js';
import type { Profile, UpsertProfileInput } from './core/profile/profile.entity.js';

const canBindLocalPort = process.env.ALLOW_LOCAL_BIND === '1';
const maybeIt = canBindLocalPort ? it : it.skip;

class FakeProfileRepository implements ProfileRepositoryPort {
  async get(): Promise<Profile | null> {
    return null;
  }

  async upsert(input: UpsertProfileInput): Promise<Profile> {
    const now = new Date('2026-05-23T00:00:00.000Z');
    return {
      id: 'profile-1',
      createdAt: now,
      updatedAt: now,
      ...input
    };
  }
}

describe('createApp', () => {
  maybeIt('returns 200 for health endpoint', async () => {
    const logger = pino({ enabled: false });
    const profileRepo = new FakeProfileRepository();
    const app = createApp(logger, {
      getProfileService: new GetProfileService(profileRepo),
      upsertProfileService: new UpsertProfileService(profileRepo)
    });

    const response = await request(app).get('/health');

    expect(response.status).toBe(200);
    expect(response.body).toEqual({ status: 'ok' });
  });
});
