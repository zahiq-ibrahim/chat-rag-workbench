import express from 'express';
import { documentRouter } from './documents/routes';
import { toolRouter } from './tools/routes';
import { chatRouter } from './chat/routes';
import { errorHandler } from './lib/errors';

export const app = express();

app.use(express.json({ limit: '1mb' }));

app.get('/health', (_req, res) => res.json({ ok: true }));

app.use('/api/documents', documentRouter);
app.use('/api/tools', toolRouter);
app.use('/api/chats', chatRouter);

app.use(errorHandler);