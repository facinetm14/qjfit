import { z } from 'zod';

const envSchema = z.object({
  DATABASE_URL: z.string().min(1),
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().positive(),
  CORS_ORIGIN: z.string().url()
});

export type AppConfig = Readonly<z.infer<typeof envSchema>>;

export function loadConfig(env: NodeJS.ProcessEnv): AppConfig {
  const parsed = envSchema.safeParse(env);
  if (!parsed.success) {
    const missingVars = parsed.error.issues.map((issue) => issue.path.join('.'));
    throw new Error(`Invalid environment configuration: ${missingVars.join(', ')}`);
  }

  return parsed.data;
}
