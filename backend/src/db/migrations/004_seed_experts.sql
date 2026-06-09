-- Dev seed: peer experts so low-confidence routing has someone to surface.
-- Without this, the only user is the seeded demo user and ExpertCards never
-- appear (self is excluded from ranking). Idempotent via fixed UUIDs + ON CONFLICT.
-- last_active_at is set relative to now() so recency ranking has spread.

INSERT INTO users (id, email, display_name, role, last_active_at) VALUES
  ('00000000-0000-0000-0000-0000000000a1', 'maya@curiousai.local',  'Maya Chen',      'ML Engineer',        now() - interval '2 hours'),
  ('00000000-0000-0000-0000-0000000000a2', 'devon@curiousai.local', 'Devon Park',     'Platform / DevOps',  now() - interval '1 day'),
  ('00000000-0000-0000-0000-0000000000a3', 'sara@curiousai.local',  'Sara Okafor',    'Frontend Engineer',  now() - interval '5 days'),
  ('00000000-0000-0000-0000-0000000000a4', 'liang@curiousai.local', 'Liang Wei',      'Data Engineer',      now() - interval '3 days'),
  ('00000000-0000-0000-0000-0000000000a5', 'noor@curiousai.local',  'Noor Haddad',    'Security Engineer',  now() - interval '20 days')
ON CONFLICT (id) DO NOTHING;

-- Skills per expert. evidence_count + level drive the depth component of ranking;
-- names are matched against question terms for the topic-match component.
INSERT INTO skills (user_id, name, summary, level, evidence_count, source) VALUES
  -- Maya Chen — ML
  ('00000000-0000-0000-0000-0000000000a1', 'Machine Learning',     'Model training, evaluation, MLOps', 'advanced',     14, 'auto'),
  ('00000000-0000-0000-0000-0000000000a1', 'PyTorch',              'Deep learning frameworks',          'advanced',     11, 'auto'),
  ('00000000-0000-0000-0000-0000000000a1', 'Embeddings',           'Vector search and RAG',             'intermediate',  7, 'auto'),
  -- Devon Park — DevOps
  ('00000000-0000-0000-0000-0000000000a2', 'Kubernetes',           'Cluster ops and Helm',              'advanced',     12, 'auto'),
  ('00000000-0000-0000-0000-0000000000a2', 'Docker',               'Containerization and CI',           'advanced',      9, 'auto'),
  ('00000000-0000-0000-0000-0000000000a2', 'Terraform',            'Infrastructure as code',            'intermediate',  6, 'auto'),
  -- Sara Okafor — Frontend
  ('00000000-0000-0000-0000-0000000000a3', 'React',                'Hooks, state, performance',         'advanced',     10, 'auto'),
  ('00000000-0000-0000-0000-0000000000a3', 'TypeScript',           'Typed application code',            'advanced',      8, 'auto'),
  ('00000000-0000-0000-0000-0000000000a3', 'Accessibility',        'WCAG, ARIA, keyboard nav',          'intermediate',  5, 'auto'),
  -- Liang Wei — Data
  ('00000000-0000-0000-0000-0000000000a4', 'PostgreSQL',           'Query tuning and indexing',         'advanced',     11, 'auto'),
  ('00000000-0000-0000-0000-0000000000a4', 'pgvector',             'Vector indexes and similarity',     'intermediate',  6, 'auto'),
  ('00000000-0000-0000-0000-0000000000a4', 'ETL Pipelines',        'Batch and streaming ingestion',     'intermediate',  7, 'auto'),
  -- Noor Haddad — Security
  ('00000000-0000-0000-0000-0000000000a5', 'Security',             'AppSec and threat modeling',        'advanced',      9, 'auto'),
  ('00000000-0000-0000-0000-0000000000a5', 'Authentication',       'OAuth, OIDC, session design',       'advanced',      8, 'auto'),
  ('00000000-0000-0000-0000-0000000000a5', 'Cryptography',         'Key management and TLS',            'intermediate',  4, 'auto')
ON CONFLICT DO NOTHING;
