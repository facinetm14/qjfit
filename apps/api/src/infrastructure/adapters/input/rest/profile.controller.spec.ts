import express from 'express';
import request from 'supertest';
import { createProfileRouter } from './profile.controller.js';
import { GetProfileUseCase } from '../../../../application/usecases/profile/get-profile.usecase.js';
import { UpsertProfileUseCase } from '../../../../application/usecases/profile/upsert-profile.usecase.js';
import type { ProfileRepositoryPort } from '../../../../application/ports/output/profile-repository.port.js';
import type { Profile, UpsertProfileInput } from '../../../../domain/profile/profile.entity.js';

const canBindLocalPort = process.env.ALLOW_LOCAL_BIND === '1';
const maybeIt = canBindLocalPort ? it : it.skip;

class FakeProfileRepository implements ProfileRepositoryPort {
  public stored: Profile | null = null;

  async get(): Promise<Profile | null> {
    return this.stored;
  }

  async upsert(input: UpsertProfileInput): Promise<Profile> {
    const now = new Date('2026-05-23T12:00:00.000Z');
    this.stored = {
      id: this.stored?.id ?? 'profile-1',
      createdAt: this.stored?.createdAt ?? now,
      updatedAt: now,
      ...input
    };
    return this.stored;
  }
}

function buildApp(repo: ProfileRepositoryPort) {
  const app = express();
  app.use(express.json());
  app.use('/api', createProfileRouter({
    getProfileService: new GetProfileUseCase(repo),
    upsertProfileService: new UpsertProfileUseCase(repo)
  }));
  return app;
}

describe('profile routes', () => {
  maybeIt('GET /api/profile returns null when no profile', async () => {
    const app = buildApp(new FakeProfileRepository());

    const response = await request(app).get('/api/profile');

    expect(response.status).toBe(200);
    expect(response.body.data).toBeNull();
  });

  maybeIt('PUT /api/profile upserts and returns profile', async () => {
    const app = buildApp(new FakeProfileRepository());

    const response = await request(app).put('/api/profile').send({
      targetRole: 'Senior Backend Engineer',
      targetCompanyIndustry: ['Tech'],
      techStack: ['TypeScript', 'PostgreSQL'],
      seniorityMin: 3,
      seniorityMax: 8,
      location: 'Paris',
      excludedKeywords: ['WordPress'],
      contractTypes: ['CDI'],
      salaryMin: 70000,
      bio: null,
      availability: null
    });

    expect(response.status).toBe(200);
    expect(response.body.data.targetRole).toBe('Senior Backend Engineer');
  });
});
