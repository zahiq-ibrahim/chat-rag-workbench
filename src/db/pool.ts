import { Pool } from 'pg';
import { env } from '../config/env';

export const pool = new Pool({ connectionString: env.DATABASE_URL });

// pgvector expects vectors as a string like "[0.1,0.2,0.3]"
export const toVector = (v: number[]) => `[${v.join(',')}]`;