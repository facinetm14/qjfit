import { z } from "zod";
import cron from "node-cron";

const envSchema = z.object({
  DATABASE_URL: z.string().min(1),
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
  WTTJ_RSS_FEED_URL: z.string().default(""),
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
