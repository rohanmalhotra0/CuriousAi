-- Per-user settings. Memory can be toggled off; when off, the chat neither
-- recalls nor writes long-term memories.
ALTER TABLE users ADD COLUMN IF NOT EXISTS memory_enabled boolean NOT NULL DEFAULT true;
