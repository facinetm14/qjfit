import { inject, injectable } from "inversify";
import type { ScoringProviderPort } from "../../../../application/ports/output/scoring-provider.port.js";
import type { Job } from "../../../../domain/jobs/job.entity.js";
import { TYPES } from "../../../container/types.js";

type FetchResponse = {
  ok: boolean;
  status: number;
  json(): Promise<unknown>;
};

type Fetcher = (
  input: string,
  init: {
    readonly method: string;
    readonly headers: Record<string, string>;
    readonly body: string;
  },
) => Promise<FetchResponse>;

// PRD §3.4's stated bound on how much of a job description feeds scoring —
// no upstream truncation exists yet, so it's applied here defensively.
const MAX_DESCRIPTION_CHARS = 2000;

// The chosen free model has no `structured_outputs` support, so JSON
// correctness rests on this prompt (few-shot) plus the caller's existing
// lenient per-item validation (application/usecases/scoring/
// validate-score-result.ts) — this adapter only needs to produce *a*
// parsed array, not a schema-valid one.
const SYSTEM_PROMPT = `You are a job-matching scoring assistant. You receive one CV and a batch of job postings. For EACH job, score how well it matches the CV.

Respond with ONLY a JSON array, no prose, no markdown code fence, one object per job, in this exact shape:
[
  {
    "jobId": "job-123",
    "score": 82,
    "summary": "Senior Python role at a fintech scale-up. Stack matches 90%.",
    "matchReasons": ["FastAPI", "PostgreSQL", "remote-friendly"],
    "missingSkills": ["Kubernetes"],
    "seniorityFit": "good",
    "redFlags": []
  }
]

Rules:
- "score" is an integer 0-100.
- "jobId" must exactly match the id given for that job.
- Include every job from the batch, in any order.
- "seniorityFit" is one of: "under-qualified", "good", "over-qualified", "unknown".
- If nothing is notably missing or wrong, use an empty array for "missingSkills"/"redFlags".

Example:
CV: "5 years of Python/Django, based in Paris, looking for backend roles."
Job batch:
- id: job-1, title: "Senior Backend Engineer (Python)", company: "Acme", location: "Paris", contractType: "CDI", description: "Django, PostgreSQL, AWS. 5+ years experience."

Expected output:
[
  {
    "jobId": "job-1",
    "score": 88,
    "summary": "Senior backend role in Paris matching the candidate's Python/Django background closely.",
    "matchReasons": ["Python", "Django", "Paris"],
    "missingSkills": ["AWS"],
    "seniorityFit": "good",
    "redFlags": []
  }
]`;

function truncateDescription(description: string): string {
  return description.length > MAX_DESCRIPTION_CHARS
    ? `${description.slice(0, MAX_DESCRIPTION_CHARS)}…`
    : description;
}

function buildUserMessage(cvMarkdown: string, jobs: readonly Job[]): string {
  const jobsBlock = jobs
    .map(
      (job) =>
        `- id: ${job.id}\n  title: ${job.title}\n  company: ${job.company}\n  location: ${job.location}\n  contractType: ${job.contractType}\n  description: ${truncateDescription(job.description)}`,
    )
    .join("\n");

  return `CV:\n${cvMarkdown}\n\nJob batch:\n${jobsBlock}`;
}

function extractJsonArray(content: string): unknown {
  const fenced = /```(?:json)?\s*([\s\S]*?)\s*```/.exec(content);
  const jsonText = fenced ? (fenced[1] ?? content) : content;
  return JSON.parse(jsonText);
}

export interface OpenRouterScoringProviderAdapterOptions {
  readonly apiKey: string;
  readonly model: string;
  readonly baseUrl: string;
  readonly fetcher?: Fetcher;
}

@injectable()
export class OpenRouterScoringProviderAdapter implements ScoringProviderPort {
  constructor(
    @inject(TYPES.OpenRouterScoringProviderAdapterOptions)
    private readonly options: OpenRouterScoringProviderAdapterOptions,
  ) {}

  async scoreBatch(cvMarkdown: string, jobs: readonly Job[]): Promise<readonly unknown[]> {
    const fetcher = this.options.fetcher ?? fetch;

    const response = await fetcher(`${this.options.baseUrl}/chat/completions`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${this.options.apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: this.options.model,
        messages: [
          { role: "system", content: SYSTEM_PROMPT },
          { role: "user", content: buildUserMessage(cvMarkdown, jobs) },
        ],
      }),
    });

    if (!response.ok) {
      throw new Error(`OpenRouter scoring request failed with status ${response.status}`);
    }

    const payload = await response.json();
    const content = (payload as { choices?: { message?: { content?: string } }[] })
      .choices?.[0]?.message?.content;
    if (typeof content !== "string") {
      throw new Error("OpenRouter response is missing choices[0].message.content");
    }

    const parsed = extractJsonArray(content);
    if (!Array.isArray(parsed)) {
      throw new Error("OpenRouter response content is not a JSON array");
    }

    return parsed;
  }
}
