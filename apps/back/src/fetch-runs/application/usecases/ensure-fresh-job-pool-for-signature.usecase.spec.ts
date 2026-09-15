import { EnsureFreshJobPoolForSignatureUseCase } from "./ensure-fresh-job-pool-for-signature.usecase.js";
import type { FetchFreshnessPort } from "../ports/fetch-freshness.port.js";
import type { FetchLockPort } from "../ports/fetch-lock.port.js";
import type { ExecuteFetchRunLifecyclePort } from "./execute-fetch-run-lifecycle.usecase.js";
import type { LoggerPort } from "@shared/application/ports/logger.port.js";
import type { FetchSourceQuery } from "../ports/fetch-source.port.js";
import type { FetchRun } from "../../domain/fetch-run.entity.js";
import { FetchFailedWithNoCacheError } from "../../domain/errors/fetch-failed-no-cache.error.js";

class FakeFetchFreshness implements FetchFreshnessPort {
  public lastFetchedAt: Date | null = null;
  public readonly markFetchedCalls: Array<{ querySignature: string; fetchedAt: Date }> = [];

  async getLastFetchedAt(): Promise<Date | null> {
    return this.lastFetchedAt;
  }

  async markFetched(querySignature: string, fetchedAt: Date): Promise<void> {
    this.markFetchedCalls.push({ querySignature, fetchedAt });
  }
}

class FakeFetchLock implements FetchLockPort {
  public acquireResult = true;
  public readonly acquireCalls: string[] = [];
  public readonly releaseCalls: string[] = [];
  public readonly waitForReleaseCalls: string[] = [];

  async acquire(querySignature: string): Promise<boolean> {
    this.acquireCalls.push(querySignature);
    return this.acquireResult;
  }

  async release(querySignature: string): Promise<void> {
    this.releaseCalls.push(querySignature);
  }

  async waitForRelease(querySignature: string): Promise<void> {
    this.waitForReleaseCalls.push(querySignature);
  }
}

class FakeExecuteFetchRunLifecycle implements ExecuteFetchRunLifecyclePort {
  public readonly calls: Array<string | null> = [];
  public readonly queryCalls: Array<FetchSourceQuery | null | undefined> = [];
  constructor(
    private readonly result:
      | FetchRun
      | (() => FetchRun)
      | Error = buildRun("completed"),
  ) {}

  async execute(
    querySignature: string | null,
    query?: FetchSourceQuery | null,
  ): Promise<FetchRun> {
    this.calls.push(querySignature);
    this.queryCalls.push(query);
    if (this.result instanceof Error) {
      throw this.result;
    }
    return typeof this.result === "function" ? this.result() : this.result;
  }
}

class FakeLogger implements LoggerPort {
  public readonly errors: Array<{ context: Record<string, unknown>; message: string }> = [];

  error(context: Record<string, unknown>, message: string): void {
    this.errors.push({ context, message });
  }
}

function buildRun(status: FetchRun["status"], overrides: Partial<FetchRun> = {}): FetchRun {
  return {
    id: "run-1",
    status,
    querySignature: "title:backend-developer",
    startedAt: new Date("2026-09-15T10:00:00.000Z"),
    endedAt: new Date("2026-09-15T10:05:00.000Z"),
    createdAt: new Date("2026-09-15T10:00:00.000Z"),
    updatedAt: new Date("2026-09-15T10:05:00.000Z"),
    ...overrides,
  };
}

const SIGNATURE = "title:backend-developer";
const QUERY: FetchSourceQuery = {
  targetRole: "Backend Developer",
  location: "Paris",
  contractTypes: ["CDI"],
};

describe("EnsureFreshJobPoolForSignatureUseCase", () => {
  it("skips fetching when the signature's pool was fetched less than 2 hours ago", async () => {
    const freshness = new FakeFetchFreshness();
    freshness.lastFetchedAt = new Date("2026-09-15T10:00:00.000Z");
    const lock = new FakeFetchLock();
    const lifecycle = new FakeExecuteFetchRunLifecycle();
    const useCase = new EnsureFreshJobPoolForSignatureUseCase(
      freshness,
      lock,
      lifecycle,
      new FakeLogger(),
    );

    await useCase.execute({
      querySignature: SIGNATURE,
      now: new Date("2026-09-15T11:00:00.000Z"),
      query: QUERY,
    });

    expect(lifecycle.calls).toHaveLength(0);
    expect(lock.acquireCalls).toHaveLength(0);
  });

  it("fetches when there is no cached freshness for the signature", async () => {
    const freshness = new FakeFetchFreshness();
    const lock = new FakeFetchLock();
    const lifecycle = new FakeExecuteFetchRunLifecycle();
    const useCase = new EnsureFreshJobPoolForSignatureUseCase(
      freshness,
      lock,
      lifecycle,
      new FakeLogger(),
    );

    await useCase.execute({
      querySignature: SIGNATURE,
      now: new Date("2026-09-15T11:00:00.000Z"),
      query: QUERY,
    });

    expect(lifecycle.calls).toEqual([SIGNATURE]);
    expect(lifecycle.queryCalls).toEqual([QUERY]);
    expect(lock.acquireCalls).toEqual([SIGNATURE]);
    expect(lock.releaseCalls).toEqual([SIGNATURE]);
  });

  it("fetches again when the last fetch for the signature is 2+ hours old", async () => {
    const freshness = new FakeFetchFreshness();
    freshness.lastFetchedAt = new Date("2026-09-15T08:59:59.000Z");
    const lock = new FakeFetchLock();
    const lifecycle = new FakeExecuteFetchRunLifecycle();
    const useCase = new EnsureFreshJobPoolForSignatureUseCase(
      freshness,
      lock,
      lifecycle,
      new FakeLogger(),
    );

    await useCase.execute({
      querySignature: SIGNATURE,
      now: new Date("2026-09-15T11:00:00.000Z"),
      query: QUERY,
    });

    expect(lifecycle.calls).toEqual([SIGNATURE]);
  });

  it("marks the signature fetched on a completed run so the next request within the window reuses it", async () => {
    const freshness = new FakeFetchFreshness();
    const lock = new FakeFetchLock();
    const endedAt = new Date("2026-09-15T11:05:00.000Z");
    const lifecycle = new FakeExecuteFetchRunLifecycle(
      buildRun("completed", { endedAt }),
    );
    const useCase = new EnsureFreshJobPoolForSignatureUseCase(
      freshness,
      lock,
      lifecycle,
      new FakeLogger(),
    );

    await useCase.execute({
      querySignature: SIGNATURE,
      now: new Date("2026-09-15T11:00:00.000Z"),
      query: QUERY,
    });

    expect(freshness.markFetchedCalls).toEqual([
      { querySignature: SIGNATURE, fetchedAt: endedAt },
    ]);
  });

  it("waits for the in-flight fetch instead of triggering a duplicate one when the lock is already held", async () => {
    const freshness = new FakeFetchFreshness();
    const lock = new FakeFetchLock();
    lock.acquireResult = false;
    const lifecycle = new FakeExecuteFetchRunLifecycle();
    const useCase = new EnsureFreshJobPoolForSignatureUseCase(
      freshness,
      lock,
      lifecycle,
      new FakeLogger(),
    );

    await useCase.execute({
      querySignature: SIGNATURE,
      now: new Date("2026-09-15T11:00:00.000Z"),
      query: QUERY,
    });

    expect(lifecycle.calls).toHaveLength(0);
    expect(lock.waitForReleaseCalls).toEqual([SIGNATURE]);
    expect(lock.releaseCalls).toHaveLength(0);
  });

  it("releases the lock even when the fetch throws", async () => {
    const freshness = new FakeFetchFreshness();
    freshness.lastFetchedAt = new Date("2026-09-15T08:00:00.000Z");
    const lock = new FakeFetchLock();
    const lifecycle = new FakeExecuteFetchRunLifecycle(
      new Error("connector unreachable"),
    );
    const useCase = new EnsureFreshJobPoolForSignatureUseCase(
      freshness,
      lock,
      lifecycle,
      new FakeLogger(),
    );

    await useCase.execute({
      querySignature: SIGNATURE,
      now: new Date("2026-09-15T11:00:00.000Z"),
      query: QUERY,
    });

    expect(lock.releaseCalls).toEqual([SIGNATURE]);
  });

  it("swallows a fetch failure and logs it when a stale cache exists to fall back on", async () => {
    const freshness = new FakeFetchFreshness();
    freshness.lastFetchedAt = new Date("2026-09-15T08:00:00.000Z");
    const lock = new FakeFetchLock();
    const logger = new FakeLogger();
    const lifecycle = new FakeExecuteFetchRunLifecycle(
      new Error("connector unreachable"),
    );
    const useCase = new EnsureFreshJobPoolForSignatureUseCase(
      freshness,
      lock,
      lifecycle,
      logger,
    );

    await expect(
      useCase.execute({ querySignature: SIGNATURE, now: new Date("2026-09-15T11:00:00.000Z"), query: QUERY }),
    ).resolves.toBeUndefined();

    expect(logger.errors).toHaveLength(1);
    expect(freshness.markFetchedCalls).toHaveLength(0);
  });

  it("swallows an all-sources-failed run and logs it when a stale cache exists to fall back on", async () => {
    const freshness = new FakeFetchFreshness();
    freshness.lastFetchedAt = new Date("2026-09-15T08:00:00.000Z");
    const lock = new FakeFetchLock();
    const logger = new FakeLogger();
    const lifecycle = new FakeExecuteFetchRunLifecycle(buildRun("failed"));
    const useCase = new EnsureFreshJobPoolForSignatureUseCase(
      freshness,
      lock,
      lifecycle,
      logger,
    );

    await useCase.execute({
      querySignature: SIGNATURE,
      now: new Date("2026-09-15T11:00:00.000Z"),
      query: QUERY,
    });

    expect(logger.errors).toHaveLength(1);
    expect(freshness.markFetchedCalls).toHaveLength(0);
  });

  it("throws FetchFailedWithNoCacheError when the fetch throws and no cache exists", async () => {
    const freshness = new FakeFetchFreshness();
    const lock = new FakeFetchLock();
    const lifecycle = new FakeExecuteFetchRunLifecycle(
      new Error("connector unreachable"),
    );
    const useCase = new EnsureFreshJobPoolForSignatureUseCase(
      freshness,
      lock,
      lifecycle,
      new FakeLogger(),
    );

    await expect(
      useCase.execute({ querySignature: SIGNATURE, now: new Date("2026-09-15T11:00:00.000Z"), query: QUERY }),
    ).rejects.toThrow(FetchFailedWithNoCacheError);

    expect(lock.releaseCalls).toEqual([SIGNATURE]);
  });

  it("throws FetchFailedWithNoCacheError when every source fails and no cache exists", async () => {
    const freshness = new FakeFetchFreshness();
    const lock = new FakeFetchLock();
    const lifecycle = new FakeExecuteFetchRunLifecycle(buildRun("failed"));
    const useCase = new EnsureFreshJobPoolForSignatureUseCase(
      freshness,
      lock,
      lifecycle,
      new FakeLogger(),
    );

    await expect(
      useCase.execute({ querySignature: SIGNATURE, now: new Date("2026-09-15T11:00:00.000Z"), query: QUERY }),
    ).rejects.toThrow(FetchFailedWithNoCacheError);
  });
});
