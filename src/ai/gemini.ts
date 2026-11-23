import { createGoogleGenerativeAI } from '@ai-sdk/google';
import { embedMany } from 'ai';
import { env } from '../config/env';

const google = createGoogleGenerativeAI({ apiKey: env.GEMINI_API_KEY });

export const chatModel = google(env.GEMINI_CHAT_MODEL);
export const embeddingModel = google.embedding(env.GEMINI_EMBED_MODEL);

export type EmbedTask = 'RETRIEVAL_DOCUMENT' | 'RETRIEVAL_QUERY';

export async function embedTexts(texts: string[], taskType: EmbedTask): Promise<number[][]> {
  if (texts.length === 0) return [];
  const { embeddings } = await embedMany({
    model: embeddingModel,
    values: texts,
    providerOptions: {
      google: { outputDimensionality: env.EMBED_DIM, taskType },
    },
  });
  return embeddings;
}