import type { Profile } from '../profile/profile.entity.js';
import type { ProfileRepositoryPort } from '../ports/driven/profile-repository.port.js';

export class GetProfileService {
  constructor(private readonly profileRepository: ProfileRepositoryPort) {}

  async execute(): Promise<Profile | null> {
    return this.profileRepository.get();
  }
}
