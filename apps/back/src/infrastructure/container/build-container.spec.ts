import type { Logger } from "pino";
import { buildContainer } from "./build-container.js";
import { CreateFetchRunUseCase } from "../../application/usecases/fetch-runs/create-fetch-run.usecase.js";
import { ExecuteFetchRunLifecycleUseCase } from "../../application/usecases/fetch-runs/execute-fetch-run-lifecycle.usecase.js";
import { FetchRunScheduler } from "../adapters/input/scheduler/fetch-run-scheduler.js";
import type { AppConfig } from "../../config.js";

function buildConfig(): AppConfig {
  return {
    DATABASE_URL: "postgresql://QJFit:password@db:5432/QJFit",
    NODE_ENV: "test",
    PORT: 3000,
    CORS_ORIGIN: "http://localhost:5173",
    FETCH_RUN_CRON_SCHEDULE: "0 */4 * * *",
    FRANCE_TRAVAIL_BASE_URL: "https://api.francetravail.io",
    FRANCE_TRAVAIL_ACCESS_TOKEN: "token",
    WTTJ_RSS_FEED_URL: "https://wttj.example/rss",
  };
}

function buildLogger() {
  return {
    error: jest.fn(),
    info: jest.fn(),
  } as unknown as Logger;
}

describe("buildContainer", () => {
  it("wires the fetch-run scheduler with its full dependency graph", () => {
    const container = buildContainer(buildConfig(), buildLogger());

    const scheduler = container.resolve("fetchRunScheduler");

    expect(scheduler).toBeInstanceOf(FetchRunScheduler);
    expect(container.resolve("createFetchRunUseCase")).toBeInstanceOf(
      CreateFetchRunUseCase,
    );
    expect(
      container.resolve("executeFetchRunLifecycleUseCase"),
    ).toBeInstanceOf(ExecuteFetchRunLifecycleUseCase);
    expect(container.resolve("fetchSources")).toHaveLength(2);
  });

  it("resolves every dependency as a singleton across the graph", () => {
    const container = buildContainer(buildConfig(), buildLogger());

    expect(container.resolve("fetchRunsRepository")).toBe(
      container.resolve("fetchRunsRepository"),
    );
    expect(container.resolve("fetchRunScheduler")).toBe(
      container.resolve("fetchRunScheduler"),
    );
  });
});
