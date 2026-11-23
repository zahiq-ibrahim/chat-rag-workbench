import { z } from 'zod';

export const ToolCreate = z.object({
  name: z.string().regex(/^[a-zA-Z_][a-zA-Z0-9_]{0,62}$/, 'Use letters, digits and underscores'),
  description: z.string().min(10, 'Describe what the tool does so the model knows when to use it'),
  parameters: z.object({
    type: z.literal('object'),
    properties: z.record(z.string(), z.any()),
    required: z.array(z.string()).optional(),
  }),
  httpConfig: z.object({
    method: z.enum(['GET', 'POST']),
    url: z.string().url(),
    headers: z.record(z.string(), z.string()).optional(),
    timeoutMs: z.number().int().min(500).max(15000).default(5000),
  }),
  enabled: z.boolean().default(true),
});

export const ToolPatch = z.object({ enabled: z.boolean() });