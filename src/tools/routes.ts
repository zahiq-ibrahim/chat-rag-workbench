import { Router } from 'express';
import { pool } from '../db/pool';
import { ToolCreate, ToolPatch } from './schemas';

export const toolRouter = Router();

// Add a tool. No code change or redeploy needed.
toolRouter.post('/', async (req, res) => {
  const body = ToolCreate.parse(req.body);
  const { rows } = await pool.query(
    `INSERT INTO tools (name, description, parameters, http_config, enabled)
     VALUES ($1, $2, $3, $4, $5) RETURNING *`,
    [
      body.name,
      body.description,
      JSON.stringify(body.parameters),
      JSON.stringify(body.httpConfig),
      body.enabled,
    ]
  );
  res.status(201).json(rows[0]);
});

toolRouter.get('/', async (_req, res) => {
  const { rows } = await pool.query('SELECT * FROM tools ORDER BY created_at');
  res.json(rows);
});

// Enable or disable a tool from usage. The model is only offered enabled tools.
toolRouter.patch('/:id', async (req, res) => {
  const body = ToolPatch.parse(req.body);
  const { rows } = await pool.query(
    'UPDATE tools SET enabled = $2 WHERE id = $1 RETURNING *',
    [req.params.id, body.enabled]
  );
  if (!rows[0]) return res.status(404).json({ error: 'Not found' });
  res.json(rows[0]);
});

// Delete a tool entirely
toolRouter.delete('/:id', async (req, res) => {
  const { rowCount } = await pool.query('DELETE FROM tools WHERE id = $1', [req.params.id]);
  if (!rowCount) return res.status(404).json({ error: 'Not found' });
  res.status(204).end();
});