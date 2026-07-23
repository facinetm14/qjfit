import type { Logger } from "pino";
import { buildContainer } from "./build-container.js";
import { CreateFetchRunUseCase } from "../../application/usecases/fetch-runs/create-fetch-run.usecase.js";
import { ExecuteFetchRunLifecycleUseCase } from "../../application/usecases/fetch-runs/execute-fetch-run-lifecycle.usecase.js";
import { FetchRunScheduler } from "../adapters/input/scheduler/fetch-run-scheduler.js";
import type { FetchRunsRepositoryPort } from "../../application/ports/output/fetch-runs-repository.port.js";
import type { FetchSourcePort } from "../../application/ports/output/fetch-source.port.js";
import type { AppConfig } from "../../config.js";
import { TYPES } from "./types.js";

function buildConfig(): AppConfig {
  return {
    DATABASE_URL: "postgresql://QJFit:password@db:5432/QJFit",
    NODE_ENV: "test",
    PORT: 3000,
    CORS_ORIGIN: "http://localhost:5173",
    FETCH_RUN_CRON_SCHEDULE: "0 */4 * * *",
    FRANCE_TRAVAIL_BASE_URL: "https://api.francetravail.io/partenaire/offresdemploi/v2",
    FRANCE_TRAVAIL_AUTH_URL:
      "https://entreprise.francetravail.fr/connexion/oauth2/access_token?realm=/partenaire",
    FRANCE_TRAVAIL_SCOPE: "api_offresdemploiv2 o2dsoffre",
    FRANCE_TRAVAIL_CLIENT_ID: "client-id",
    FRANCE_TRAVAIL_CLIENT_SECRET: "client-secret",
    FRANCE_TRAVAIL_PAGE_SIZE: 150,
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

    const scheduler = container.get(TYPES.FetchRunScheduler);

    expect(scheduler).toBeInstanceOf(FetchRunScheduler);
    expect(container.get(TYPES.CreateFetchRunUseCase)).toBeInstanceOf(
      CreateFetchRunUseCase,
    );
    expect(
      container.get(TYPES.ExecuteFetchRunLifecycleUseCase),
    ).toBeInstanceOf(ExecuteFetchRunLifecycleUseCase);
    expect(container.getAll<FetchSourcePort>(TYPES.FetchSource)).toHaveLength(
      2,
    );
  });

  it("resolves every dependency as a singleton across the graph", () => {
    const container = buildContainer(buildConfig(), buildLogger());

    expect(
      container.get<FetchRunsRepositoryPort>(TYPES.FetchRunsRepository),
    ).toBe(container.get<FetchRunsRepositoryPort>(TYPES.FetchRunsRepository));
    expect(container.get(TYPES.FetchRunScheduler)).toBe(
      container.get(TYPES.FetchRunScheduler),
    );
  });
});
