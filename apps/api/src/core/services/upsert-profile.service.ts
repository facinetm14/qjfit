import type { Profile, UpsertProfileInput } from '../profile/profile.entity.js';
import type { ProfileRepositoryPort } from '../ports/driven/profile-repository.port.js';

export class UpsertProfileService {
  constructor(private readonly profileRepository: ProfileRepositoryPort) {}

  async execute(input: UpsertProfileInput): Promise<Profile> {
    return this.profileRepository.upsert(input);
  }
}
