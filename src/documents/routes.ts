import { Router } from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs/promises';
import { z } from 'zod';
import { pool } from '../db/pool';
import { enqueueIngestion } from '../ingestion/queue';
import { env } from '../config/env';

export const documentRouter = Router();

const ALLOWED = ['.pdf', '.md', '.markdown', '.txt'];

const upload = multer({
  dest: env.UPLOAD_DIR,
  limits: { fileSize: 50 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    const ok = ALLOWED.includes(path.extname(file.originalname).toLowerCase());
    cb(ok ? null : new Error('Only .pdf, .md, .markdown and .txt files are allowed'), ok);
  },
});

// Upload: save the file, create a row, queue ingestion
documentRouter.post('/', upload.single('file'), async (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'Missing file field "file"' });

  const { rows } = await pool.query(
    `INSERT INTO documents (name, mime_type, file_path, status)
     VALUES ($1, $2, $3, 'queued') RETURNING *`,
    [req.file.originalname, req.file.mimetype, req.file.path]
  );

  await enqueueIngestion(rows[0].id);
  res.status(202).json(rows[0]);
});

// List documents with their status
documentRouter.get('/', async (_req, res) => {
  const { rows } = await pool.query(
    `SELECT id, name, status, enabled, chunk_count, error, created_at, updated_at
       FROM documents ORDER BY created_at DESC`
  );
  res.json(rows);
});

// Status of one document (poll this to show ingestion progress)
documentRouter.get('/:id', async (req, res) => {
  const { rows } = await pool.query(
    `SELECT id, name, status, enabled, chunk_count, error, created_at, updated_at
       FROM documents WHERE id = $1`,
    [req.params.id]
  );
  if (!rows[0]) return res.status(404).json({ error: 'Not found' });
  res.json(rows[0]);
});

// Enable or disable retrieval for a document (no re-embedding needed)
const PatchDoc = z.object({ enabled: z.boolean() });

documentRouter.patch('/:id', async (req, res) => {
  const body = PatchDoc.parse(req.body);
  const { rows } = await pool.query(
    'UPDATE documents SET enabled = $2, updated_at = now() WHERE id = $1 RETURNING id, name, enabled, status',
    [req.params.id, body.enabled]
  );
  if (!rows[0]) return res.status(404).json({ error: 'Not found' });
  res.json(rows[0]);
});

// Reindex: rebuild chunks from the stored file
documentRouter.post('/:id/reindex', async (req, res) => {
  const { rows } = await pool.query(
    `UPDATE documents SET status = 'queued', error = NULL, updated_at = now()
     WHERE id = $1 RETURNING *`,
    [req.params.id]
  );
  if (!rows[0]) return res.status(404).json({ error: 'Not found' });

  await enqueueIngestion(rows[0].id);
  res.status(202).json(rows[0]);
});

// Delete: chunks go via ON DELETE CASCADE, then the file on disk
documentRouter.delete('/:id', async (req, res) => {
  const { rows } = await pool.query('DELETE FROM documents WHERE id = $1 RETURNING file_path', [
    req.params.id,
  ]);
  if (!rows[0]) return res.status(404).json({ error: 'Not found' });

  await fs.unlink(rows[0].file_path).catch(() => {});
  res.status(204).end();
});