import 'dotenv/config';
import { Worker } from 'bullmq';
import { connection } from '../lib/redis';
import { pool, toVector } from '../db/pool';
import { parseFile } from './parser';
import { chunkPages } from './chunker';
import { embedTexts } from '../ai/gemini';
import { INGESTION_QUEUE } from './queue';

// Free-tier limits: ~1,500 RPM and ~100 texts per embedMany call.
// Don't pre-emptively sleep — only back off when the API actually says 429.
const EMBED_BATCH_SIZE = 100;
const RATE_LIMIT_WAIT_MS = 65000;
const MAX_RATE_LIMIT_RETRIES = 5;

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

function isRateLimitError(err: any): boolean {
  const message = String(err?.message ?? '');
  return (
    err?.statusCode === 429 ||
    message.includes('429') ||
    message.toLowerCase().includes('quota') ||
    message.toLowerCase().includes('rate limit')
  );
}

// Embed one batch, waiting and retrying if the free-tier quota is exceeded
async function embedWithRetry(batch: string[]): Promise<number[][]> {
  for (let attempt = 1; ; attempt++) {
    try {
      return await embedTexts(batch, 'RETRIEVAL_DOCUMENT');
    } catch (err: any) {
      if (!isRateLimitError(err) || attempt > MAX_RATE_LIMIT_RETRIES) {
        throw err;
      }
      console.warn(
        `Rate limited (attempt ${attempt}/${MAX_RATE_LIMIT_RETRIES}). Waiting ${RATE_LIMIT_WAIT_MS / 1000}s...`
      );
      await sleep(RATE_LIMIT_WAIT_MS);
    }
  }
}

async function setStatus(documentId: string, status: string, error: string | null = null) {
  await pool.query(
    'UPDATE documents SET status = $2, error = $3, updated_at = now() WHERE id = $1',
    [documentId, status, error]
  );
}

const worker = new Worker(
  INGESTION_QUEUE,
  async (job) => {
    const { documentId } = job.data as { documentId: string };

    const { rows } = await pool.query('SELECT * FROM documents WHERE id = $1', [documentId]);
    const doc = rows[0];
    if (!doc) return; // deleted before the job ran

    try {
      await setStatus(documentId, 'parsing');
      const pages = await parseFile(doc.file_path);

      await setStatus(documentId, 'chunking');
      const chunks = chunkPages(pages);

      if (chunks.length === 0) {
        throw new Error('No readable text found in this file');
      }

      await setStatus(documentId, 'embedding');
      const vectors: number[][] = [];
      for (let i = 0; i < chunks.length; i += EMBED_BATCH_SIZE) {
        const batch = chunks.slice(i, i + EMBED_BATCH_SIZE).map((c) => c.content);
        vectors.push(...(await embedWithRetry(batch)));
      }

      // Replace old chunks and write new ones in one transaction.
      // This is what makes reindex safe.
      const client = await pool.connect();
      try {
        await client.query('BEGIN');
        await client.query('DELETE FROM chunks WHERE document_id = $1', [documentId]);

        for (let i = 0; i < chunks.length; i++) {
          await client.query(
            `INSERT INTO chunks (document_id, chunk_index, content, page, heading, embedding)
             VALUES ($1, $2, $3, $4, $5, $6::vector)`,
            [
              documentId,
              i,
              chunks[i].content,
              chunks[i].page ?? null,
              chunks[i].heading ?? null,
              toVector(vectors[i]),
            ]
          );
        }

        await client.query(
          `UPDATE documents
             SET status = 'ready', chunk_count = $2, error = NULL, updated_at = now()
           WHERE id = $1`,
          [documentId, chunks.length]
        );
        await client.query('COMMIT');
      } catch (err) {
        await client.query('ROLLBACK');
        throw err;
      } finally {
        client.release();
      }
    } catch (err: any) {
      // Record the real error on the document so the status endpoint shows it
      await setStatus(documentId, 'failed', err.message ?? 'Unknown error').catch(() => {});
      // Only swallow rate-limit errors — retrying quota failures immediately is pointless.
      // All other errors are rethrown so BullMQ can retry the job via its backoff policy.
      if (!isRateLimitError(err)) {
        throw err;
      }
    }
  },
  { connection, concurrency: 1 }
);

worker.on('completed', (job) => console.log(`Ingested document ${job.data.documentId}`));
worker.on('failed', (job, err) => console.error(`Job ${job?.id} failed:`, err.message));

console.log('Ingestion worker running');