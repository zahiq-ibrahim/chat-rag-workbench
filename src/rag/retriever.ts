import { pool, toVector } from '../db/pool';
import { embedTexts } from '../ai/gemini';

export type Source = {
  chunk_id: string;
  doc_id: string;
  doc_name: string;
  content: string;
  page: number | null;
  heading: string | null;
  score: number;
};

// Only enabled documents that finished ingesting are searchable.
export async function retrieve(query: string, k = 5): Promise<Source[]> {
  const [queryVector] = await embedTexts([query], 'RETRIEVAL_QUERY');
  if (!queryVector) return [];

  const vec = toVector(queryVector);
  const { rows } = await pool.query(
    `SELECT c.id AS chunk_id,
            d.id AS doc_id,
            d.name AS doc_name,
            c.content,
            c.page,
            c.heading,
            1 - (c.embedding <=> $1::vector) AS score
       FROM chunks c
       JOIN documents d ON d.id = c.document_id
      WHERE d.enabled = TRUE AND d.status = 'ready'
      ORDER BY c.embedding <=> $1::vector
      LIMIT $2`,
    [vec, k]
  );
  return rows;
}