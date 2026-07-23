import fs from "node:fs";
import path from "node:path";
import { FranceTravailConnector } from "./france-travail.connector.js";
import type { FranceTravailAuthClient } from "./france-travail-auth.client.js";

const fixturesDir = path.resolve(
  process.cwd(),
  "src",
  "infrastructure",
  "adapters",
  "output",
  "connectors",
  "fixtures",
  "france-travail",
);

function loadFixture(name: string): unknown {
  const filePath = path.resolve(fixturesDir, name);
  return JSON.parse(fs.readFileSync(filePath, "utf8"));
}

function buildAuthClient(
  overrides: Partial<FranceTravailAuthClient> = {},
): FranceTravailAuthClient {
  return {
    getAccessToken: async () => "token",
    ...overrides,
  } as unknown as FranceTravailAuthClient;
}

function offer(id: string): unknown {
  return {
    id,
    intitule: `Job ${id}`,
    description: "Some description.",
    dateCreation: "2026-05-01T10:00:00.000Z",
    lieuTravail: { libelle: "Paris" },
    entreprise: { nom: "Acme" },
    origineOffre: { urlOrigine: `https://example.com/jobs/${id}` },
  };
}

async function noopSleep(): Promise<void> {}

function pageOf(count: number, offset = 0): unknown {
  return {
    resultats: Array.from({ length: count }, (_, i) => offer(`FT-${offset + i}`)),
  };
}

function response(
  payload: unknown,
  options: { readonly ok?: boolean; readonly status?: number; readonly contentRange?: string | null } = {},
) {
  return {
    ok: options.ok ?? true,
    status: options.status ?? 200,
    headers: {
      get: (name: string) =>
        name === "Content-Range" ? options.contentRange ?? null : null,
    },
    json: async () => payload,
  };
}

describe("FranceTravailConnector", () => {
  it("maps valid responses to raw jobs", async () => {
    const payload = loadFixture("success-minimal.json");
    const fetcher = async () => response(payload);
    const connector = new FranceTravailConnector(
      { baseUrl: "https://api.test", pageSize: 150, fetcher },
      buildAuthClient(),
    );

    const result = await connector.fetch("run-1");

    expect(result.jobs).toHaveLength(1);
    expect(result.jobs[0]).toMatchObject({
      source: "france-travail",
      sourceJobId: "FT-123",
      title: "Backend Developer",
      company: "Acme",
      location: "Paris",
      url: "https://example.com/jobs/ft-123",
    });
  });

  it("fills missing optional fields", async () => {
    const payload = loadFixture("partial-fields.json");
    const fetcher = async () => response(payload);
    const connector = new FranceTravailConnector(
      { baseUrl: "https://api.test", pageSize: 150, fetcher },
      buildAuthClient(),
    );

    const result = await connector.fetch("run-1");

    expect(result.jobs).toHaveLength(1);
    expect(result.jobs[0]).toMatchObject({
      company: "Unknown",
      description: "",
      location: "Marseille",
    });
  });

  it("throws when response is not ok", async () => {
    const fetcher = async () =>
      response(loadFixture("error-rate-limit.json"), { ok: false, status: 429 });
    const connector = new FranceTravailConnector(
      { baseUrl: "https://api.test", pageSize: 150, fetcher },
      buildAuthClient(),
    );

    await expect(connector.fetch("run-1")).rejects.toThrow(
      "France Travail request failed with status 429",
    );
  });

  it("throws when the search endpoint rejects the bearer token", async () => {
    const fetcher = async () =>
      response(loadFixture("error-auth.json"), { ok: false, status: 401 });
    const connector = new FranceTravailConnector(
      { baseUrl: "https://api.test", pageSize: 150, fetcher },
      buildAuthClient(),
    );

    await expect(connector.fetch("run-1")).rejects.toThrow(
      "France Travail request failed with status 401",
    );
  });

  it("throws on invalid payload", async () => {
    const fetcher = async () => response({ invalid: true });
    const connector = new FranceTravailConnector(
      { baseUrl: "https://api.test", pageSize: 150, fetcher },
      buildAuthClient(),
    );

    await expect(connector.fetch("run-1")).rejects.toThrow(
      "France Travail response payload is invalid",
    );
  });

  it("sends the auth client's bearer token on the search request", async () => {
    const payload = loadFixture("success-minimal.json");
    const calls: Array<{ url: string; init: unknown }> = [];
    const fetcher = async (url: string, init: unknown) => {
      calls.push({ url, init });
      return response(payload);
    };
    const connector = new FranceTravailConnector(
      { baseUrl: "https://api.test", pageSize: 150, fetcher },
      buildAuthClient({ getAccessToken: async () => "fresh-token" }),
    );

    await connector.fetch("run-1");

    expect(calls).toHaveLength(1);
    expect(calls[0]?.url).toBe("https://api.test/offres/search?range=0-149");
    expect(calls[0]?.init).toMatchObject({
      headers: { Authorization: "Bearer fresh-token" },
    });
  });

  it("caps the requested window to the France Travail max span of 150", async () => {
    const calls: string[] = [];
    const fetcher = async (url: string) => {
      calls.push(url);
      return response(pageOf(1));
    };
    const connector = new FranceTravailConnector(
      { baseUrl: "https://api.test", pageSize: 999, fetcher },
      buildAuthClient(),
    );

    await connector.fetch("run-1");

    expect(calls).toEqual(["https://api.test/offres/search?range=0-149"]);
  });

  it("propagates errors from the auth client without calling the search endpoint", async () => {
    const fetcher = jest.fn();
    const authFailure = new Error("France Travail client_id/client_secret missing");
    const connector = new FranceTravailConnector(
      { baseUrl: "https://api.test", pageSize: 150, fetcher },
      buildAuthClient({
        getAccessToken: async () => {
          throw authFailure;
        },
      }),
    );

    await expect(connector.fetch("run-1")).rejects.toThrow(authFailure);
    expect(fetcher).not.toHaveBeenCalled();
  });

  describe("pagination", () => {
    it("stops after a single page when fewer results than the page size come back", async () => {
      const calls: string[] = [];
      const fetcher = async (url: string) => {
        calls.push(url);
        return response(pageOf(2), { contentRange: "offres 0-1/2" });
      };
      const connector = new FranceTravailConnector(
        { baseUrl: "https://api.test", pageSize: 50, fetcher },
        buildAuthClient(),
      );

      const result = await connector.fetch("run-1");

      expect(calls).toEqual(["https://api.test/offres/search?range=0-49"]);
      expect(result.jobs).toHaveLength(2);
    });

    it("follows full pages and stops once Content-Range reports the total is reached", async () => {
      const calls: string[] = [];
      const fetcher = async (url: string) => {
        calls.push(url);
        const offset = calls.length === 1 ? 0 : (calls.length - 1) * 50;
        if (calls.length <= 2) {
          return response(pageOf(50, offset), { contentRange: "offres 0-49/120" });
        }
        return response(pageOf(20, offset), { contentRange: "offres 100-119/120" });
      };
      const connector = new FranceTravailConnector(
        { baseUrl: "https://api.test", pageSize: 50, fetcher, sleep: noopSleep },
        buildAuthClient(),
      );

      const result = await connector.fetch("run-1");

      expect(calls).toEqual([
        "https://api.test/offres/search?range=0-49",
        "https://api.test/offres/search?range=50-99",
        "https://api.test/offres/search?range=100-149",
      ]);
      expect(result.jobs).toHaveLength(120);
    });

    it("stops at the API's navigable cap (last index 1149) even if Content-Range reports more", async () => {
      const calls: string[] = [];
      const fetcher = async (url: string) => {
        calls.push(url);
        return response(pageOf(150), { contentRange: "offres 0-149/5000" });
      };
      const connector = new FranceTravailConnector(
        { baseUrl: "https://api.test", pageSize: 150, fetcher, sleep: noopSleep },
        buildAuthClient(),
      );

      const result = await connector.fetch("run-1");

      expect(calls[calls.length - 1]).toBe(
        "https://api.test/offres/search?range=1050-1149",
      );
      expect(calls).toHaveLength(8);
      expect(result.jobs.length).toBeGreaterThan(0);
    });

    it("does not fetch another page when a page comes back empty", async () => {
      const calls: string[] = [];
      const fetcher = async (url: string) => {
        calls.push(url);
        return response(pageOf(0));
      };
      const connector = new FranceTravailConnector(
        { baseUrl: "https://api.test", pageSize: 50, fetcher },
        buildAuthClient(),
      );

      const result = await connector.fetch("run-1");

      expect(calls).toHaveLength(1);
      expect(result.jobs).toHaveLength(0);
    });

    it("throttles page requests to stay within the 10 req/s France Travail rate limit", async () => {
      const fetcher = async (url: string) => {
        const offset = Number(url.split("range=")[1]?.split("-")[0] ?? 0);
        return response(pageOf(offset === 100 ? 30 : 50, offset), {
          contentRange: "offres 0-0/130",
        });
      };
      const sleepCalls: number[] = [];
      const sleep = async (ms: number) => {
        sleepCalls.push(ms);
      };
      const connector = new FranceTravailConnector(
        { baseUrl: "https://api.test", pageSize: 50, fetcher, sleep },
        buildAuthClient(),
      );

      await connector.fetch("run-1");

      expect(sleepCalls).toEqual([100, 100]);
    });
  });
});
