import { Router } from 'express';
import { z } from 'zod';
import { pool } from '../db/pool';
import { answer } from './chatService';

export const chatRouter = Router();

const IdParam = z.object({ id: z.string().uuid() });
const SendMessage = z.object({ content: z.string().min(1) });

// Create a chat
chatRouter.post('/', async (_req, res) => {
  const { rows } = await pool.query('INSERT INTO chats DEFAULT VALUES RETURNING *');
  res.status(201).json(rows[0]);
});

// List chats, newest first, with how many messages each has
chatRouter.get('/', async (_req, res) => {
  const { rows } = await pool.query(
    `SELECT c.id, c.title, c.created_at,
            COUNT(m.id)::int AS message_count
       FROM chats c
       LEFT JOIN messages m ON m.chat_id = c.id
      GROUP BY c.id
      ORDER BY c.created_at DESC`
  );
  res.json(rows);
});

// Get one chat
chatRouter.get('/:id', async (req, res) => {
  const { id } = IdParam.parse(req.params);
  const { rows } = await pool.query(
    `SELECT c.id, c.title, c.created_at,
            COUNT(m.id)::int AS message_count
       FROM chats c
       LEFT JOIN messages m ON m.chat_id = c.id
      WHERE c.id = $1
      GROUP BY c.id`,
    [id]
  );
  if (!rows[0]) return res.status(404).json({ error: 'Chat not found' });
  res.json(rows[0]);
});

// Get all messages in a chat, oldest first
chatRouter.get('/:id/messages', async (req, res) => {
  const { id } = IdParam.parse(req.params);
  const { rows } = await pool.query(
    'SELECT * FROM messages WHERE chat_id = $1 ORDER BY created_at',
    [id]
  );
  res.json(rows);
});

// Send a message and get an answer
chatRouter.post('/:id/messages', async (req, res) => {
  const { id } = IdParam.parse(req.params);
  const body = SendMessage.parse(req.body);
  const result = await answer(id, body.content);
  res.json(result);
});

// Delete a chat and all its messages
chatRouter.delete('/:id', async (req, res) => {
  const { id } = IdParam.parse(req.params);
  const { rowCount } = await pool.query('DELETE FROM chats WHERE id = $1', [id]);
  if (!rowCount) return res.status(404).json({ error: 'Chat not found' });
  res.status(204).end();
});