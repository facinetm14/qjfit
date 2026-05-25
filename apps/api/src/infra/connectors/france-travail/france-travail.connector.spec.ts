import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { FranceTravailConnector } from "./france-travail.connector.js";

const fixturesDir = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "..",
  "fixtures",
  "france-travail",
);

function loadFixture(name: string): unknown {
  const filePath = path.resolve(fixturesDir, name);
  return JSON.parse(fs.readFileSync(filePath, "utf8"));
}

describe("FranceTravailConnector", () => {
  it("maps valid responses to raw jobs", async () => {
    const payload = loadFixture("success-minimal.json");
    const fetcher = async () => ({
      ok: true,
      status: 200,
      json: async () => payload,
    });
    const connector = new FranceTravailConnector({
      baseUrl: "https://api.test",
      accessToken: "token",
      fetcher,
    });

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
    const connector = new FranceTravailConnector({
      baseUrl: "https://api.test",
      accessToken: "token",
      fetcher,
    });

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
    const connector = new FranceTravailConnector({
      baseUrl: "https://api.test",
      accessToken: "token",
      fetcher,
    });

    await expect(connector.fetch("run-1")).rejects.toThrow(
      "France Travail request failed with status 429",
    );
  });

  it("throws on invalid payload", async () => {
    const fetcher = async () => ({
      ok: true,
      status: 200,
      json: async () => ({ invalid: true }),
    });
    const connector = new FranceTravailConnector({
      baseUrl: "https://api.test",
      accessToken: "token",
      fetcher,
    });

    await expect(connector.fetch("run-1")).rejects.toThrow(
      "France Travail response payload is invalid",
    );
  });
});
