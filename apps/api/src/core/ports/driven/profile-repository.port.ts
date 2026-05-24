import type { Profile, UpsertProfileInput } from '../../profile/profile.entity.js';

export interface ProfileRepositoryPort {
  get(): Promise<Profile | null>;
  upsert(input: UpsertProfileInput): Promise<Profile>;
}
