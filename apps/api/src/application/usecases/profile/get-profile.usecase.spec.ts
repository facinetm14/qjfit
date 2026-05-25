import { GetProfileUseCase } from "./get-profile.usecase";
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

  async upsert(_input: UpsertProfileInput): Promise<Profile> {
    throw new Error("Not implemented in this test");
  }
}

describe("GetProfileUseCase", () => {
  it("returns profile when available", async () => {
    const repo = new FakeProfileRepository();
    repo.stored = {
      id: "profile-1",
      targetRole: "Senior Backend Engineer",
      targetCompanyIndustry: ["Tech"],
      techStack: ["TypeScript"],
      seniorityMin: 3,
      seniorityMax: 8,
      location: "Paris",
      excludedKeywords: [],
      contractTypes: ["CDI"],
      salaryMin: 70000,
      bio: null,
      availability: null,
      createdAt: new Date("2026-05-23T00:00:00.000Z"),
      updatedAt: new Date("2026-05-23T00:00:00.000Z"),
    };

    const usecase = new GetProfileUseCase(repo);

    const result = await usecase.execute();

    expect(result?.id).toBe("profile-1");
  });
});
