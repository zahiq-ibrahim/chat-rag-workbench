import express from 'express';
import { documentRouter } from './documents/routes';
import { toolRouter } from './tools/routes';
import { chatRouter } from './chat/routes';
import { errorHandler } from './lib/errors';

export const app = express();

// CORS: allow the front end to call the API from another origin.
// This runs before every route, so error responses also get the headers.
app.use((req, res, next) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PATCH, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  // Browsers send an OPTIONS "preflight" request before PATCH, DELETE,
  // and JSON POSTs. Answer it directly with no body.
  if (req.method === 'OPTIONS') {
    return res.status(204).end();
  }
  next();
});

app.use(express.json({ limit: '1mb' }));

app.get('/health', (_req, res) => res.json({ ok: true }));

app.use('/api/documents', documentRouter);
app.use('/api/tools', toolRouter);
app.use('/api/chats', chatRouter);

app.use(errorHandler);