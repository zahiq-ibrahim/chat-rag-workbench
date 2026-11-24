import { Router } from 'express';
import { z } from 'zod';
import { pool } from '../db/pool';
import { ToolCreate, ToolPatch } from './schemas';

export const toolRouter = Router();

const IdParam = z.object({ id: z.string().uuid() });

// ?enabled=true or ?enabled=false to filter. Omit it to get all tools.
const ToolQuery = z.object({
  enabled: z.enum(['true', 'false']).optional(),
});

// Add a tool
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

// List tools: all, or only enabled/disabled with ?enabled=
toolRouter.get('/', async (req, res) => {
  const query = ToolQuery.parse(req.query);

  const hasFilter = query.enabled !== undefined;
  const sql = hasFilter
    ? 'SELECT * FROM tools WHERE enabled = $1 ORDER BY created_at'
    : 'SELECT * FROM tools ORDER BY created_at';
  const params = hasFilter ? [query.enabled === 'true'] : [];

  const { rows } = await pool.query(sql, params);
  res.json(rows);
});

// Get one tool
toolRouter.get('/:id', async (req, res) => {
  const { id } = IdParam.parse(req.params);
  const { rows } = await pool.query('SELECT * FROM tools WHERE id = $1', [id]);
  if (!rows[0]) return res.status(404).json({ error: 'Tool not found' });
  res.json(rows[0]);
});

// Enable or disable a tool
toolRouter.patch('/:id', async (req, res) => {
  const { id } = IdParam.parse(req.params);
  const body = ToolPatch.parse(req.body);
  const { rows } = await pool.query(
    'UPDATE tools SET enabled = $2 WHERE id = $1 RETURNING *',
    [id, body.enabled]
  );
  if (!rows[0]) return res.status(404).json({ error: 'Tool not found' });
  res.json(rows[0]);
});

// Delete a tool
toolRouter.delete('/:id', async (req, res) => {
  const { id } = IdParam.parse(req.params);
  const { rowCount } = await pool.query('DELETE FROM tools WHERE id = $1', [id]);
  if (!rowCount) return res.status(404).json({ error: 'Tool not found' });
  res.status(204).end();
});