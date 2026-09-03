import { z } from "zod";
import cron from "node-cron";

const envSchema = z.object({
  DATABASE_URL: z.string().min(1),
  REDIS_URL: z.string().min(1),
  NODE_ENV: z
    .enum(["development", "test", "production"])
    .default("development"),
  PORT: z.coerce.number().int().positive(),
  CORS_ORIGIN: z.string().url(),
  FETCH_RUN_CRON_SCHEDULE: z
    .string()
    .default("0 */4 * * *")
    .refine((value) => cron.validate(value), {
      message: "FETCH_RUN_CRON_SCHEDULE must be a valid cron expression",
    }),
  FRANCE_TRAVAIL_BASE_URL: z
    .string()
    .default("https://api.francetravail.io/partenaire/offresdemploi/v2"),
  FRANCE_TRAVAIL_AUTH_URL: z
    .string()
    .default(
      "https://entreprise.francetravail.fr/connexion/oauth2/access_token?realm=/partenaire",
    ),
  FRANCE_TRAVAIL_SCOPE: z
    .string()
    .default("api_offresdemploiv2 o2dsoffre"),
  FRANCE_TRAVAIL_CLIENT_ID: z.string().default(""),
  FRANCE_TRAVAIL_CLIENT_SECRET: z.string().default(""),
  // Requested `range` window size per page of /offres/search, clamped to the
  // API's documented max span of 150 — see FranceTravailConnector's
  // MAX_PAGE_SPAN doc comment. The connector paginates through successive
  // windows of this size until the source is exhausted.
  FRANCE_TRAVAIL_PAGE_SIZE: z.coerce.number().int().min(1).max(150).default(150),
  WTTJ_RSS_FEED_URL: z.string().default(""),
  // PRD §3.4: recency tiebreak takes the top N most-recent relevance-filtered
  // jobs as LLM-scoring candidates.
  SCORING_CANDIDATE_LIMIT: z.coerce.number().int().min(1).default(50),
  // PRD §3.4 final ranking: ranking_score = score * exp(-days_since_posted / decay_days).
  SCORING_DECAY_DAYS: z.coerce.number().int().min(1).default(14),
  // Role gate (issue #14): minimum cosine similarity between the CV's stated
  // target role and a job's title for the job to clear the family-match
  // tier. See StubEmbeddingProviderAdapter's doc comment for how the stub
  // vector space behaves; 0.25 cleanly separates related titles
  // (>= 0.4 in that space) from unrelated ones (<= 0.16).
  ROLE_SIMILARITY_THRESHOLD: z.coerce.number().min(0).max(1).default(0.25),
  // Batched scoring (issue #16): how many candidate jobs share a single
  // scoring call's CV payload, instead of one call per job. Defaults to 50
  // (the full SCORING_CANDIDATE_LIMIT) so a match request costs a single
  // OpenRouter free-tier request instead of up to 5 — see ADR 0020.
  SCORING_BATCH_SIZE: z.coerce.number().int().min(1).default(50),
  // Real ScoringProviderPort adapter (issue #21, ADR 0020) — interim free
  // provider via OpenRouter, ahead of a later paid Claude-backed adapter.
  // No fallback provider, so this is hard-required at boot like the other
  // scoring options above.
  OPENROUTER_API_KEY: z.string().min(1),
  OPENROUTER_MODEL: z.string().default("minimax/minimax-m3:free"),
  OPENROUTER_BASE_URL: z.string().default("https://openrouter.ai/api/v1"),
});

export type AppConfig = Readonly<z.infer<typeof envSchema>>;

export function loadConfig(env: NodeJS.ProcessEnv): AppConfig {
  const parsed = envSchema.safeParse(env);
  if (!parsed.success) {
    const missingVars = parsed.error.issues.map((issue) =>
      issue.path.join("."),
    );
    throw new Error(
      `Invalid environment configuration: ${missingVars.join(", ")}`,
    );
  }

  return parsed.data;
}
