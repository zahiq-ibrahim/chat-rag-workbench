CREATE EXTENSION IF NOT EXISTS vector;

CREATE TABLE IF NOT EXISTS documents (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name        TEXT NOT NULL,
  mime_type   TEXT NOT NULL,
  file_path   TEXT NOT NULL,
  status      TEXT NOT NULL DEFAULT 'queued',   -- queued | parsing | chunking | embedding | ready | failed
  error       TEXT,
  enabled     BOOLEAN NOT NULL DEFAULT TRUE,    -- false = excluded from retrieval
  chunk_count INT NOT NULL DEFAULT 0,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS chunks (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  document_id UUID NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
  chunk_index INT NOT NULL,
  content     TEXT NOT NULL,
  page        INT,
  heading     TEXT,
  embedding   vector(768) NOT NULL
);

CREATE INDEX IF NOT EXISTS chunks_embedding_idx
  ON chunks USING hnsw (embedding vector_cosine_ops);

CREATE TABLE IF NOT EXISTS tools (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name        TEXT NOT NULL UNIQUE,
  description TEXT NOT NULL,
  parameters  JSONB NOT NULL,     -- JSON Schema for the arguments
  http_config JSONB NOT NULL,     -- { method, url, headers, timeoutMs }
  enabled     BOOLEAN NOT NULL DEFAULT TRUE,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS chats (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title      TEXT NOT NULL DEFAULT 'New chat',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS messages (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  chat_id    UUID NOT NULL REFERENCES chats(id) ON DELETE CASCADE,
  role       TEXT NOT NULL,       -- user | assistant
  content    TEXT NOT NULL,
  citations  JSONB,
  tool_calls JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);