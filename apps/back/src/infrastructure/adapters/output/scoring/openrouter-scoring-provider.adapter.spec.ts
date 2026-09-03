import { OpenRouterScoringProviderAdapter } from "./openrouter-scoring-provider.adapter.js";
import type { Job } from "../../../../domain/jobs/job.entity.js";

function job(id: string, overrides: Partial<Job> = {}): Job {
  return {
    id,
    title: `Job ${id}`,
    company: "Acme",
    location: "Paris",
    contractType: "Other",
    remotePolicy: "Unknown",
    description: "Some description.",
    url: `https://example.com/jobs/${id}`,
    source: "france-travail",
    sourceJobId: id,
    dedupKey: id,
    fetchedAt: new Date("2026-08-01T00:00:00.000Z"),
    ...overrides,
  };
}

type FetchResponse = {
  ok: boolean;
  status: number;
  json(): Promise<unknown>;
};

function chatCompletionResponse(content: string): FetchResponse {
  return {
    ok: true,
    status: 200,
    json: async () => ({
      choices: [{ message: { content } }],
    }),
  };
}

function buildAdapter(fetcher: jest.Mock): OpenRouterScoringProviderAdapter {
  return new OpenRouterScoringProviderAdapter({
    apiKey: "test-key",
    model: "minimax/minimax-m3:free",
    baseUrl: "https://openrouter.ai/api/v1",
    fetcher: fetcher as never,
  });
}

const scoreResultPayload = [
  {
    jobId: "job-1",
    score: 82,
    summary: "Strong match.",
    matchReasons: ["FastAPI"],
    missingSkills: ["Kubernetes"],
    seniorityFit: "good",
    redFlags: [],
  },
];

describe("OpenRouterScoringProviderAdapter", () => {
  it("sends the CV once and every job in the batch in a single request", async () => {
    const fetcher = jest.fn().mockResolvedValue(
      chatCompletionResponse(JSON.stringify(scoreResultPayload)),
    );
    const adapter = buildAdapter(fetcher);
    const jobs = [job("job-1"), job("job-2")];

    await adapter.scoreBatch("## CV\nSenior backend engineer.", jobs);

    expect(fetcher).toHaveBeenCalledTimes(1);
    const [url, init] = fetcher.mock.calls[0];
    expect(url).toBe("https://openrouter.ai/api/v1/chat/completions");
    expect(init.method).toBe("POST");
    expect(init.headers.Authorization).toBe("Bearer test-key");
    expect(init.headers["Content-Type"]).toBe("application/json");

    const body = JSON.parse(init.body);
    expect(body.model).toBe("minimax/minimax-m3:free");
    const userMessage = body.messages.find((m: { role: string }) => m.role === "user");
    expect(userMessage.content).toContain("Senior backend engineer");
    expect(userMessage.content).toContain("job-1");
    expect(userMessage.content).toContain("job-2");
  });

  it("parses a well-formed JSON array response", async () => {
    const fetcher = jest.fn().mockResolvedValue(
      chatCompletionResponse(JSON.stringify(scoreResultPayload)),
    );
    const adapter = buildAdapter(fetcher);

    const result = await adapter.scoreBatch("cv", [job("job-1")]);

    expect(result).toEqual(scoreResultPayload);
  });

  it("strips a markdown JSON code fence before parsing", async () => {
    const fenced = "```json\n" + JSON.stringify(scoreResultPayload) + "\n```";
    const fetcher = jest.fn().mockResolvedValue(chatCompletionResponse(fenced));
    const adapter = buildAdapter(fetcher);

    const result = await adapter.scoreBatch("cv", [job("job-1")]);

    expect(result).toEqual(scoreResultPayload);
  });

  it("throws when the HTTP response is not ok, dropping the whole batch", async () => {
    const fetcher = jest.fn().mockResolvedValue({
      ok: false,
      status: 500,
      json: async () => ({}),
    });
    const adapter = buildAdapter(fetcher);

    await expect(adapter.scoreBatch("cv", [job("job-1")])).rejects.toThrow();
  });

  it("throws when the model content is not valid JSON, dropping the whole batch", async () => {
    const fetcher = jest.fn().mockResolvedValue(
      chatCompletionResponse("not json at all"),
    );
    const adapter = buildAdapter(fetcher);

    await expect(adapter.scoreBatch("cv", [job("job-1")])).rejects.toThrow();
  });
});
