import { UpsertProfileUseCase } from "./upsert-profile.usecase";
import type { ProfileRepositoryPort } from "../../ports/output/profile-repository.port.js";
import type {
  Profile,
  UpsertProfileInput,
} from "../../../domain/profile/profile.entity.js";

class FakeProfileRepository implements ProfileRepositoryPort {
  public stored: Profile | null = null;

  async get(): Promise<Profile | null> {
    return this.stored;
  }

  async upsert(input: UpsertProfileInput): Promise<Profile> {
    const now = new Date("2026-05-23T12:00:00.000Z");
    this.stored = {
      id: this.stored?.id ?? "profile-1",
      createdAt: this.stored?.createdAt ?? now,
      updatedAt: now,
      ...input,
    };

    return this.stored;
  }
}

describe("UpsertProfileUseCase", () => {
  it("upserts a profile", async () => {
    const repo = new FakeProfileRepository();
    const usecase = new UpsertProfileUseCase(repo);

    const result = await usecase.execute({
      targetRole: "Senior Backend Engineer",
      targetCompanyIndustry: ["Tech"],
      techStack: ["TypeScript", "PostgreSQL"],
      seniorityMin: 4,
      seniorityMax: 9,
      location: "Paris",
      excludedKeywords: ["WordPress"],
      contractTypes: ["CDI"],
      salaryMin: 70000,
      bio: null,
      availability: null,
    });

    expect(result.id).toBe("profile-1");
    expect(result.targetRole).toBe("Senior Backend Engineer");
  });
});
