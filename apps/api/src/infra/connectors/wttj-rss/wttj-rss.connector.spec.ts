import fs from "node:fs";
import path from "node:path";
import { WttjRssConnector } from "./wttj-rss.connector.js";

const fixturesDir = path.resolve(
  process.cwd(),
  "src",
  "infra",
  "connectors",
  "fixtures",
  "wttj-rss",
);

function loadFixture(name: string): string {
  const filePath = path.resolve(fixturesDir, name);
  return fs.readFileSync(filePath, "utf8");
}

describe("WttjRssConnector", () => {
  it("maps valid feeds to raw jobs", async () => {
    const xml = loadFixture("success-minimal.xml");
    const fetcher = async () => ({
      ok: true,
      status: 200,
      text: async () => xml,
    });
    const connector = new WttjRssConnector({
      feedUrl: "https://example.com/feed",
      fetcher,
    });

    const result = await connector.fetch("run-1");

    expect(result.jobs).toHaveLength(1);
    expect(result.jobs[0]).toMatchObject({
      source: "wttj-rss",
      sourceJobId: "WTTJ-100",
      title: "Frontend Developer",
      company: "WTTJ",
      location: "Paris",
      url: "https://wttj.example/jobs/wttj-100",
    });
  });

  it("handles multi-entry feeds", async () => {
    const xml = loadFixture("success-multi.xml");
    const fetcher = async () => ({
      ok: true,
      status: 200,
      text: async () => xml,
    });
    const connector = new WttjRssConnector({
      feedUrl: "https://example.com/feed",
      fetcher,
    });

    const result = await connector.fetch("run-1");

    expect(result.jobs).toHaveLength(2);
    expect(result.jobs[1]).toMatchObject({
      sourceJobId: "WTTJ-111",
      title: "Data Engineer",
      company: "WTTJ Labs",
      location: "Lyon",
    });
  });

  it("skips malformed entries", async () => {
    const xml = loadFixture("malformed-entry.xml");
    const fetcher = async () => ({
      ok: true,
      status: 200,
      text: async () => xml,
    });
    const connector = new WttjRssConnector({
      feedUrl: "https://example.com/feed",
      fetcher,
    });

    const result = await connector.fetch("run-1");

    expect(result.jobs).toHaveLength(1);
    expect(result.jobs[0]).toMatchObject({
      sourceJobId: "WTTJ-200",
    });
  });

  it("throws on invalid XML", async () => {
    const xml = loadFixture("invalid-xml.xml");
    const fetcher = async () => ({
      ok: true,
      status: 200,
      text: async () => xml,
    });
    const connector = new WttjRssConnector({
      feedUrl: "https://example.com/feed",
      fetcher,
    });

    await expect(connector.fetch("run-1")).rejects.toThrow(
      "WTTJ RSS payload is invalid XML",
    );
  });
});
