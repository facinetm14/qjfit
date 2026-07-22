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

describe("FranceTravailConnector", () => {
  it("maps valid responses to raw jobs", async () => {
    const payload = loadFixture("success-minimal.json");
    const fetcher = async () => ({
      ok: true,
      status: 200,
      json: async () => payload,
    });
    const connector = new FranceTravailConnector(
      { baseUrl: "https://api.test", fetcher },
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
    const fetcher = async () => ({
      ok: true,
      status: 200,
      json: async () => payload,
    });
    const connector = new FranceTravailConnector(
      { baseUrl: "https://api.test", fetcher },
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
    const fetcher = async () => ({
      ok: false,
      status: 429,
      json: async () => loadFixture("error-rate-limit.json"),
    });
    const connector = new FranceTravailConnector(
      { baseUrl: "https://api.test", fetcher },
      buildAuthClient(),
    );

    await expect(connector.fetch("run-1")).rejects.toThrow(
      "France Travail request failed with status 429",
    );
  });

  it("throws when the search endpoint rejects the bearer token", async () => {
    const fetcher = async () => ({
      ok: false,
      status: 401,
      json: async () => loadFixture("error-auth.json"),
    });
    const connector = new FranceTravailConnector(
      { baseUrl: "https://api.test", fetcher },
      buildAuthClient(),
    );

    await expect(connector.fetch("run-1")).rejects.toThrow(
      "France Travail request failed with status 401",
    );
  });

  it("throws on invalid payload", async () => {
    const fetcher = async () => ({
      ok: true,
      status: 200,
      json: async () => ({ invalid: true }),
    });
    const connector = new FranceTravailConnector(
      { baseUrl: "https://api.test", fetcher },
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
      return { ok: true, status: 200, json: async () => payload };
    };
    const connector = new FranceTravailConnector(
      { baseUrl: "https://api.test", fetcher },
      buildAuthClient({ getAccessToken: async () => "fresh-token" }),
    );

    await connector.fetch("run-1");

    expect(calls).toHaveLength(1);
    expect(calls[0]?.url).toBe("https://api.test/offres/search");
    expect(calls[0]?.init).toMatchObject({
      headers: { Authorization: "Bearer fresh-token" },
    });
  });

  it("propagates errors from the auth client without calling the search endpoint", async () => {
    const fetcher = jest.fn();
    const authFailure = new Error("France Travail client_id/client_secret missing");
    const connector = new FranceTravailConnector(
      { baseUrl: "https://api.test", fetcher },
      buildAuthClient({
        getAccessToken: async () => {
          throw authFailure;
        },
      }),
    );

    await expect(connector.fetch("run-1")).rejects.toThrow(authFailure);
    expect(fetcher).not.toHaveBeenCalled();
  });
});
