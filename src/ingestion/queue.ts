import { Queue } from 'bullmq';
import { connection } from '../lib/redis';

export const INGESTION_QUEUE = 'ingestion';

export const ingestionQueue = new Queue(INGESTION_QUEUE, {
  connection,
  defaultJobOptions: {
    attempts: 2,
    backoff: { type: 'exponential', delay: 2000 },
    removeOnComplete: 100,
    removeOnFail: 100,
  },
});

export function enqueueIngestion(documentId: string) {
  return ingestionQueue.add('ingest', { documentId });
}