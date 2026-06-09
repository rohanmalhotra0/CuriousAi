-- CuriousAI initial schema. Embedding dim is fixed at 384 (MiniLM parity);
-- keep in sync with config.embedDim.

CREATE EXTENSION IF NOT EXISTS vector;
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

CREATE TABLE IF NOT EXISTS users (
  id            uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  email         text UNIQUE NOT NULL,
  display_name  text NOT NULL,
  role          text NOT NULL DEFAULT 'Member',
  created_at    timestamptz NOT NULL DEFAULT now(),
  last_active_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS documents (
  id           uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id      uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  filename     text NOT NULL,
  mime_type    text NOT NULL,
  size_bytes   bigint NOT NULL,
  storage_path text NOT NULL,
  status       text NOT NULL DEFAULT 'uploaded',
  error        text,
  created_at   timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_documents_user_status ON documents(user_id, status);

CREATE TABLE IF NOT EXISTS chunks (
  id           uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  document_id  uuid NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
  user_id      uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  ordinal      int NOT NULL,
  text         text NOT NULL,
  token_count  int NOT NULL DEFAULT 0,
  embedding    vector(384)
);
CREATE INDEX IF NOT EXISTS idx_chunks_user ON chunks(user_id);
CREATE INDEX IF NOT EXISTS idx_chunks_embedding
  ON chunks USING ivfflat (embedding vector_cosine_ops) WITH (lists = 100);

CREATE TABLE IF NOT EXISTS memories (
  id              uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id         uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  content         text NOT NULL,
  kind            text NOT NULL DEFAULT 'fact',
  salience        real NOT NULL DEFAULT 1.0,
  embedding       vector(384),
  source_chunk_id uuid REFERENCES chunks(id) ON DELETE SET NULL,
  supersedes_id   uuid REFERENCES memories(id) ON DELETE SET NULL,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_memories_user ON memories(user_id, salience DESC);

CREATE TABLE IF NOT EXISTS topics (
  id        uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id   uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  label     text NOT NULL,
  summary   text,
  centroid  vector(384),
  size      int NOT NULL DEFAULT 0
);
CREATE TABLE IF NOT EXISTS topic_chunks (
  topic_id uuid REFERENCES topics(id) ON DELETE CASCADE,
  chunk_id uuid REFERENCES chunks(id) ON DELETE CASCADE,
  PRIMARY KEY (topic_id, chunk_id)
);
CREATE TABLE IF NOT EXISTS topic_edges (
  src_topic_id uuid REFERENCES topics(id) ON DELETE CASCADE,
  dst_topic_id uuid REFERENCES topics(id) ON DELETE CASCADE,
  weight real NOT NULL DEFAULT 0,
  PRIMARY KEY (src_topic_id, dst_topic_id)
);

CREATE TABLE IF NOT EXISTS skills (
  id            uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id       uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name          text NOT NULL,
  summary       text,
  level         text NOT NULL DEFAULT 'beginner',
  evidence_count int NOT NULL DEFAULT 0,
  source        text NOT NULL DEFAULT 'auto',
  edited_by_user boolean NOT NULL DEFAULT false,
  updated_at    timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS skill_edges (
  src_skill_id uuid REFERENCES skills(id) ON DELETE CASCADE,
  dst_skill_id uuid REFERENCES skills(id) ON DELETE CASCADE,
  relation text NOT NULL DEFAULT 'related',
  PRIMARY KEY (src_skill_id, dst_skill_id)
);

CREATE TABLE IF NOT EXISTS chats (
  id         uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id    uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  title      text NOT NULL DEFAULT 'New chat',
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS messages (
  id         uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  chat_id    uuid NOT NULL REFERENCES chats(id) ON DELETE CASCADE,
  role       text NOT NULL,
  content    text NOT NULL,
  confidence int,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS message_citations (
  message_id uuid REFERENCES messages(id) ON DELETE CASCADE,
  chunk_id   uuid REFERENCES chunks(id) ON DELETE CASCADE,
  score real NOT NULL DEFAULT 0,
  snippet text NOT NULL DEFAULT '',
  PRIMARY KEY (message_id, chunk_id)
);

-- Dev convenience: a default user so the app is usable without auth wiring.
INSERT INTO users (id, email, display_name, role)
VALUES ('00000000-0000-0000-0000-000000000001', 'demo@curiousai.local', 'Demo User', 'Knowledge Worker')
ON CONFLICT (id) DO NOTHING;
