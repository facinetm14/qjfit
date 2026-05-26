import type { PrismaClient } from '@prisma/client';
import type { Profile, UpsertProfileInput } from '../../../../domain/profile/profile.entity.js';
import type { ProfileRepositoryPort } from '../../../../application/ports/output/profile-repository.port.js';

function toPrismaProfileInput(input: UpsertProfileInput) {
  return {
    targetRole: input.targetRole,
    targetCompanyIndustry: [...input.targetCompanyIndustry],
    techStack: [...input.techStack],
    seniorityMin: input.seniorityMin,
    seniorityMax: input.seniorityMax,
    location: input.location,
    excludedKeywords: [...input.excludedKeywords],
    contractTypes: [...input.contractTypes],
    salaryMin: input.salaryMin,
    bio: input.bio,
    availability: input.availability
  };
}

export class PrismaProfileRepository implements ProfileRepositoryPort {
  constructor(private readonly prisma: PrismaClient) {}

  async get(): Promise<Profile | null> {
    const profile = await this.prisma.profile.findFirst({
      orderBy: { createdAt: 'asc' }
    });

    return profile;
  }

  async upsert(input: UpsertProfileInput): Promise<Profile> {
    const existing = await this.prisma.profile.findFirst({
      orderBy: { createdAt: 'asc' }
    });

    if (!existing) {
      return this.prisma.profile.create({ data: toPrismaProfileInput(input) });
    }

    return this.prisma.profile.update({
      where: { id: existing.id },
      data: toPrismaProfileInput(input)
    });
  }
}
