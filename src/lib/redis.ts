import { env } from '../config/env';

// BullMQ accepts a plain connection object.
// maxRetriesPerRequest must be null for BullMQ workers.
export const connection = {
  host: env.REDIS_HOST,
  port: env.REDIS_PORT,
  maxRetriesPerRequest: null,
};