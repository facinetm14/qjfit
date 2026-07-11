import { beforeEach, describe, expect, it, vi } from "vitest";
import { useProfileApi } from "./useProfileApi.js";
import type { Profile } from "../types/profile.js";

function buildProfile(overrides: Partial<Profile> = {}): Profile {
  return {
    id: "profile-1",
    targetRole: "Backend Engineer",
    targetCompanyIndustry: ["Tech"],
    techStack: ["TypeScript"],
    seniorityMin: 3,
    seniorityMax: 8,
    location: "Paris",
    excludedKeywords: [],
    contractTypes: ["CDI"],
    salaryMin: 50000,
    bio: null,
    availability: null,
    createdAt: "2026-05-01T00:00:00.000Z",
    updatedAt: "2026-05-01T00:00:00.000Z",
    ...overrides,
  };
}

describe("useProfileApi", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("getProfile returns the profile data on a successful response", async () => {
    const profile = buildProfile();
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ data: profile }),
      }),
    );

    const { getProfile, error } = useProfileApi();
    const result = await getProfile();

    expect(result).toEqual(profile);
    expect(error.value).toBeNull();
  });

  it("getProfile sets an error and returns null when the request fails", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({ ok: false, json: async () => ({ data: null }) }),
    );

    const { getProfile, error } = useProfileApi();
    const result = await getProfile();

    expect(result).toBeNull();
    expect(error.value).toBe("Unable to load profile.");
  });

  it("saveProfile PUTs the payload and returns the updated profile", async () => {
    const updated = buildProfile({ targetRole: "Staff Engineer" });
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ data: updated }),
    });
    vi.stubGlobal("fetch", fetchMock);

    const { saveProfile } = useProfileApi();
    const { id, createdAt, updatedAt, ...payload } = updated;
    const result = await saveProfile(payload);

    expect(result).toEqual(updated);
    expect(fetchMock).toHaveBeenCalledWith(
      expect.stringContaining("/api/profile"),
      expect.objectContaining({ method: "PUT" }),
    );
  });
});
