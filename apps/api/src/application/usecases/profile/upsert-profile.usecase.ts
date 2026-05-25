import type {
  Profile,
  UpsertProfileInput,
} from "../../../domain/profile/profile.entity.js";
import type { ProfileRepositoryPort } from "../../ports/output/profile-repository.port.js";

export class UpsertProfileUseCase {
  constructor(private readonly profileRepository: ProfileRepositoryPort) {}

  async execute(input: UpsertProfileInput): Promise<Profile> {
    return this.profileRepository.upsert(input);
  }
}
