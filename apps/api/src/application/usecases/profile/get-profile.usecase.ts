import type { Profile } from "../../../domain/profile/profile.entity.js";
import type { ProfileRepositoryPort } from "../../ports/output/profile-repository.port.js";

export class GetProfileUseCase {
  constructor(private readonly profileRepository: ProfileRepositoryPort) {}

  async execute(): Promise<Profile | null> {
    return this.profileRepository.get();
  }
}
