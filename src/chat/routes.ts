import { Router } from 'express';
import { z } from 'zod';
import { pool } from '../db/pool';
import { answer } from './chatService';

export const chatRouter = Router();

chatRouter.post('/', async (_req, res) => {
  const { rows } = await pool.query('INSERT INTO chats DEFAULT VALUES RETURNING *');
  res.status(201).json(rows[0]);
});

chatRouter.get('/', async (_req, res) => {
  const { rows } = await pool.query('SELECT * FROM chats ORDER BY created_at DESC');
  res.json(rows);
});

chatRouter.get('/:id/messages', async (req, res) => {
  const { rows } = await pool.query(
    'SELECT * FROM messages WHERE chat_id = $1 ORDER BY created_at',
    [req.params.id]
  );
  res.json(rows);
});

const SendMessage = z.object({ content: z.string().min(1) });

chatRouter.post('/:id/messages', async (req, res) => {
  const body = SendMessage.parse(req.body);
  const result = await answer(req.params.id, body.content);
  res.json(result);
});