import path from 'path';
import { config } from 'dotenv';
import { z } from 'zod';

const resolvedEnvPath = process.env.AGENT_ENV_PATH || path.resolve(process.cwd(), '.env');
config({ path: resolvedEnvPath });

const envSchema = z.object({
  SUPABASE_URL: z.string().url('SUPABASE_URL must be a valid URL'),
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(1, 'SUPABASE_SERVICE_ROLE_KEY is required'),
  OPENAI_API_KEY: z.string().min(1, 'OPENAI_API_KEY is required'),
  PORT: z.string().optional(),
  NODE_ENV: z.string().optional(),
});

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  console.error('Invalid environment configuration', parsed.error.flatten().fieldErrors);
  throw new Error('Invalid environment configuration');
}

const raw = parsed.data;
const parsedPort = raw.PORT ? Number(raw.PORT) : undefined;
const fallbackPort = 8000;
const port = Number.isFinite(parsedPort) && parsedPort ? parsedPort : fallbackPort;

export const env = {
  SUPABASE_URL: raw.SUPABASE_URL,
  SUPABASE_SERVICE_ROLE_KEY: raw.SUPABASE_SERVICE_ROLE_KEY,
  OPENAI_API_KEY: raw.OPENAI_API_KEY,
  PORT: port,
  NODE_ENV: raw.NODE_ENV ?? 'development',
} as const;

export const isDevelopment = env.NODE_ENV !== 'production';
export const ENV_PATH = resolvedEnvPath;
