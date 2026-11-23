import { Request, Response, NextFunction } from 'express';
import { ZodError } from 'zod';

export function errorHandler(err: any, _req: Request, res: Response, _next: NextFunction) {
  if (err instanceof ZodError) {
    return res.status(400).json({ error: 'Validation failed', issues: err.issues });
  }
  if (err?.code === '23505') {
    return res.status(409).json({ error: 'Already exists' });
  }
  console.error(err);
  return res.status(err.status ?? 500).json({ error: err.message ?? 'Internal error' });
}