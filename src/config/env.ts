import 'dotenv/config';
import { z } from 'zod';

const schema = z.object({
  PORT: z.coerce.number().default(3000),
  DATABASE_URL: z.string().min(1),
  REDIS_HOST: z.string().default('localhost'),
  REDIS_PORT: z.coerce.number().default(6379),
  GEMINI_API_KEY: z.string().min(1),
  GEMINI_CHAT_MODEL: z.string().default('gemini-2.5-flash'),
  GEMINI_EMBED_MODEL: z.string().default('gemini-embedding-001'),
  EMBED_DIM: z.coerce.number().default(768),
  TOOL_HOST_ALLOWLIST: z.string().default('localhost'),
  UPLOAD_DIR: z.string().default('uploads'),
});

export const env = schema.parse(process.env);