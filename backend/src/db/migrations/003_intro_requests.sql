-- Expert routing: "request intro" is a placeholder action — we don't send email
-- yet, we just durably record that one user asked to be introduced to another
-- (optionally about a specific question). A real connector reads this table later.
CREATE TABLE IF NOT EXISTS intro_requests (
  id            uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  requester_id  uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  expert_id     uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  question      text,
  status        text NOT NULL DEFAULT 'pending', -- pending·sent·declined
  created_at    timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_intro_requests_expert ON intro_requests(expert_id, created_at DESC);
