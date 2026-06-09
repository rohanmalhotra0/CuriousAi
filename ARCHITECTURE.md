# CuriousAI — Architecture & Implementation Plan

> Personalized AI knowledge system (Obsidian + ChatGPT + IBM ICA style).
> **Stack decisions (locked):** Node/Express backend · React + IBM Carbon frontend ·
> PostgreSQL + pgvector · Docker Compose · **deterministic/placeholder AI** behind a
> provider interface so Claude/OpenAI/watsonx drop in later with no call-site changes.

This is a **plan for approval**. No application code is written yet.

---

## 1. System Overview

```
                          ┌──────────────────────────────────────────────┐
                          │                FRONTEND (React)               │
                          │  Carbon Design System · dark theme · WCAG AA  │
                          │                                               │
                          │  Onboarding · FileManager · Chat · MindMap    │
                          │  (Cytoscape.js) · SkillEditor · Settings      │
                          └───────────────────────┬──────────────────────┘
                                                   │ REST + SSE (streaming)
                          ┌───────────────────────▼──────────────────────┐
                          │            BACKEND  (Node + Express)          │
                          │                                               │
                          │  API layer (routers + auth + validation)      │
                          │  ┌─────────────────────────────────────────┐  │
                          │  │ SERVICES (pure, testable, provider-free) │  │
                          │  │  • IngestionService    • MemoryService   │  │
                          │  │  • ExtractionService   • SkillService    │  │
                          │  │  • EmbeddingService    • MindMapService  │  │
                          │  │  • RagService          • ExpertService   │  │
                          │  │  • ConfidenceService                     │  │
                          │  └─────────────────────────────────────────┘  │
                          │  ┌─────────────────────────────────────────┐  │
                          │  │ PROVIDERS (swappable adapters)           │  │
                          │  │  LlmProvider · EmbeddingProvider         │  │
                          │  │  → Deterministic (default) | Claude |    │  │
                          │  │    OpenAI | watsonx                      │  │
                          │  └─────────────────────────────────────────┘  │
                          │  Job queue (in-process worker for ingestion)  │
                          └───────┬───────────────────────────┬──────────┘
                                  │                            │
                   ┌──────────────▼────────────┐   ┌───────────▼───────────┐
                   │  PostgreSQL + pgvector     │   │  Object/file storage  │
                   │  users, documents, chunks  │   │  (local volume /      │
                   │  (vector), memories,       │   │   S3-compatible)      │
                   │  topics, skills, chats     │   │  raw uploaded files   │
                   └────────────────────────────┘   └───────────────────────┘
```

Everything runs via **`docker compose up`**: `db` (postgres+pgvector), `api` (Node),
`web` (React dev server / static build), plus a one-shot `migrate` job.

---

## 2. Repository Layout (monorepo, npm workspaces)

```
CuriousAI/
├── docker-compose.yml
├── .env.example
├── package.json                  # workspaces: ["backend","frontend","shared"]
├── shared/                       # types + API contract shared by FE/BE
│   └── src/contract.ts           # endpoint request/response shapes, enums
├── backend/
│   ├── src/
│   │   ├── index.ts              # express bootstrap
│   │   ├── config.ts             # env, provider selection
│   │   ├── db/
│   │   │   ├── pool.ts
│   │   │   └── migrations/       # SQL files, run by node-pg-migrate
│   │   ├── api/                  # routers (thin) → call services
│   │   │   ├── auth.routes.ts
│   │   │   ├── files.routes.ts
│   │   │   ├── chat.routes.ts
│   │   │   ├── graph.routes.ts
│   │   │   ├── skills.routes.ts
│   │   │   ├── experts.routes.ts
│   │   │   └── settings.routes.ts
│   │   ├── services/             # business logic (see §5)
│   │   ├── providers/
│   │   │   ├── llm/              # LlmProvider interface + adapters
│   │   │   └── embedding/        # EmbeddingProvider interface + adapters
│   │   ├── jobs/                 # ingestion pipeline worker + queue
│   │   └── lib/                  # logger, errors, validation, sse
│   └── test/
└── frontend/
    └── src/
        ├── App.tsx               # Carbon Shell + router
        ├── api/                  # typed client over shared/contract
        ├── pages/                # Onboarding, Files, Chat, MindMap, Skills, Settings
        ├── components/           # ProgressTracker, ConfidenceBadge, ExpertCard...
        └── theme/                # Carbon g100 (dark) + tokens
```

---

## 3. Data Model (PostgreSQL + pgvector)

`CREATE EXTENSION vector;` Embedding dimension is a config constant (`EMBED_DIM`,
default **384** to mirror MiniLM, so the deterministic provider and a future real
model are interchangeable).

| Table | Key columns | Notes |
|---|---|---|
| **users** | id (uuid pk), email, display_name, role, created_at, last_active_at | `role` powers expert cards |
| **documents** | id, user_id fk, filename, mime_type, size_bytes, storage_path, status, error, created_at | status ∈ `uploaded·extracting·embedding·indexed·failed` |
| **chunks** | id, document_id fk, user_id fk, ordinal, text, token_count, embedding `vector(384)` | ivfflat index on embedding |
| **memories** | id, user_id fk, content, kind, salience real, source_chunk_id, supersedes_id, created_at, updated_at | recursive update via `supersedes_id`; see §6.4 |
| **topics** | id, user_id fk, label, summary, centroid `vector(384)`, size int | clusters of chunks |
| **topic_chunks** | topic_id fk, chunk_id fk | M:N membership |
| **topic_edges** | src_topic_id, dst_topic_id, weight | mind-map graph edges |
| **skills** | id, user_id fk, name, summary, level, evidence_count, source, edited_by_user bool, updated_at | `source` ∈ `auto·user` |
| **skill_edges** | src_skill_id, dst_skill_id, relation | skill graph |
| **chats** | id, user_id fk, title, created_at | conversation |
| **messages** | id, chat_id fk, role, content, confidence int, created_at | role ∈ `user·assistant` |
| **message_citations** | message_id fk, chunk_id fk, score, snippet | source attribution |
| **expert_links** | derived view, not a table | ranking computed from skills + users (see §6.5) |

**Indexes that matter:** `chunks(embedding) ivfflat (vector_cosine_ops)`,
`chunks(user_id)`, `documents(user_id,status)`, `memories(user_id, salience desc)`.

---

## 4. API Contract (REST, JSON; streaming via SSE)

All routes prefixed `/api`. Auth via bearer/session (dev: header `x-user-id`).

| Method | Path | Purpose |
|---|---|---|
| POST | `/auth/register`, `/auth/login`, `/auth/me` | user lifecycle |
| POST | `/files` (multipart) | upload one/many; returns document ids in `uploaded` |
| GET | `/files` | list user documents + status |
| GET | `/files/:id/status` | poll, OR subscribe via SSE below |
| GET | `/files/events` (SSE) | live `upload→extracting→embedding→indexed` per doc |
| DELETE | `/files/:id` | remove doc + chunks (cascade) |
| POST | `/chat/:chatId/message` (SSE) | ask question → streams tokens, then `{confidence, citations}` or `{route:"expert", experts:[]}` |
| GET | `/chats`, `/chats/:id` | history persistence |
| GET | `/graph` | mind map: `{nodes:[topics], edges:[topic_edges]}` for Cytoscape |
| GET | `/graph/skills` | skill graph nodes/edges |
| GET | `/skills`, PUT `/skills/:id`, POST `/skills`, DELETE `/skills/:id` | skill editor CRUD |
| GET | `/experts?question=…` | ranked experts for a query/topic |
| POST | `/experts/:userId/intro` | request-intro placeholder (stores request) |
| GET/PUT | `/settings` | memory toggle, privacy, theme |
| DELETE | `/settings/data` | full user data deletion (WCAG/GDPR-style) |
| POST | `/report` | "here are the skills + mind map I built for you" summary |

Shared request/response types live in `shared/src/contract.ts` so the frontend client
is fully typed against the same definitions.

---

## 5. Backend Services (responsibilities + core logic)

**IngestionService** — orchestrates the pipeline as a job per document:
`store raw file → ExtractionService → chunk → EmbeddingService → persist chunks →
mark indexed`. Emits status transitions to the SSE bus. Handles partial failure
(mark `failed` + error, never crash the worker).

**ExtractionService** — format → plain text. PDF (`pdf-parse`), DOCX (`mammoth`),
TXT (utf-8), email (`mailparser` for .eml), ZIP (`yauzl` → recurse over entries).
Guards: max size, max files-per-zip, reject unsupported MIME with a clear error.

**EmbeddingService** — chunk text (sentence-aware, ~500 tokens, overlap), then calls
`EmbeddingProvider.embed(texts) → number[][]`. Default deterministic provider hashes
n-grams into a fixed 384-dim vector (stable, cosine-meaningful, zero deps) so RAG works
offline. Real providers implement the same interface.

**RagService** — `retrieve` (pgvector cosine top-k, filtered by user) → `re-rank`
(combine vector score + keyword/BM25-lite overlap + memory salience) → `respond`
(build grounded prompt, call `LlmProvider.complete`/`stream`, attach citations from the
chunks actually used).

**ConfidenceService** — score 0–100 from retrieval signals (top score, score spread,
#supporting chunks, agreement). `≥65` → answer+sources; `<65` → ExpertService routing.
Pure function, unit-testable, independent of the LLM.

**MemoryService** — read (top-salience memories for context), write (extract durable
facts from a turn), and the **recursive update rule** in §6.4 to prevent drift.

**MindMapService** — clusters chunk embeddings into topics, labels/summarizes each,
builds inter-topic edges by centroid similarity + co-occurrence. Output feeds `/graph`.

**SkillService** — extracts candidate skills from documents + user writing, dedups,
assigns level from evidence, builds skill edges. Respects `edited_by_user` (never
overwrite a human-edited skill on rebuild).

**ExpertService** — for a low-confidence question, find users whose skills/topics match,
rank by recency + depth (§6.5), return expert cards.

---

## 6. Key Algorithms

**6.1 RAG pipeline** — retrieve top-k (k≈12) by cosine → re-rank to top-n (n≈5) via
`0.7·vector + 0.2·keyword_overlap + 0.1·memory_salience` → assemble context with
inline `[n]` markers → LLM answers grounded-only → citations = chunks referenced.

**6.2 Confidence (0–100)** — `score = clamp( w1·topSim + w2·meanTopN + w3·support
− w4·spread )·100`. Color: ≥80 green, 65–79 teal/blue, <65 red (route). Deterministic,
so it behaves identically with placeholder or real embeddings.

**6.3 Topic clustering** — normalized embeddings → k-means (k from elbow / √(n/2))
or agglomerative for small n; centroid = topic vector; label via top-TF terms (LLM
summary when a real provider is present, extractive fallback otherwise).

**6.4 Memory update (recursive, anti-drift)** — on each turn, candidate facts are
extracted; for each, find nearest existing memory by cosine. If sim > τ_dup → **merge**
(bump salience, refresh timestamp). If it **contradicts** (high sim, negated) → write
new row, set old `supersedes_id`, decay old salience. Else → **insert**. Salience decays
over time so stale memories sink. No in-place destructive edits → auditable history.

**6.5 Expert ranking** — candidates = users sharing the question's matched skills/topics.
`rank = α·skillDepth(evidence_count, level) + β·recency(last_active_at) + γ·topicMatch`.
Self excluded. Returns name, role, skills, last active.

---

## 7. Frontend (React + Carbon, dark `g100`, WCAG 2.1 AA)

| Page / component | Carbon pieces | Notes |
|---|---|---|
| **Onboarding** | `ProgressIndicator`, `Tile`, guided steps | first-run tutorial |
| **FileManager** | `FileUploaderDropContainer`, `DataTable`, `InlineLoading` | drag-drop, bulk, live status via SSE |
| **ProgressTracker** | `ProgressBar` per doc | upload→processing→embedding→indexed |
| **Chat** | `ChatBox` pattern, custom bubbles, SSE stream | history, memory toggle, citations beneath answers |
| **ConfidenceBadge** | `Tag` color-coded | ≥65 vs <65 |
| **ExpertCard** | `Tile` + `Tag` + `Button` | name/role/skills/last-active + Request intro |
| **MindMap** | **Cytoscape.js** in a `Tile` | topics graph; click → source docs |
| **SkillEditor** | `DataTable` editable + `Modal` | edit auto-generated skills |
| **Settings** | `Toggle`, `Form`, danger `Button` | memory on/off, privacy, delete all data |

Accessibility: Carbon components are AA by default; we add focus management, aria-live
for streaming + progress, keyboard nav on the graph, and contrast-checked custom tokens.

---

## 8. Provider Abstraction (how placeholder → real)

```ts
interface EmbeddingProvider { embed(texts: string[]): Promise<number[][]>; dim: number; }
interface LlmProvider {
  complete(prompt: string, opts?): Promise<{text:string}>;
  stream(prompt: string, opts?): AsyncIterable<string>;
}
```
`config.ts` selects implementation from `AI_PROVIDER` env
(`deterministic`|`anthropic`|`openai`|`watsonx`). Default `deterministic` needs **no API
keys** and makes the whole app runnable + testable. Swapping providers is a one-line env
change; **no service or route code changes**, because services depend only on the
interface.

---

## 9. Phased Implementation Plan

| Phase | Deliverable | Done-when |
|---|---|---|
| **0 — Scaffolding** | monorepo, docker-compose (db+api+web), `.env.example`, migrations runner, shared contract types, health check | `docker compose up` serves API + blank Carbon shell |
| **1 — Ingestion E2E** | upload → extract (pdf/docx/txt/eml/zip) → chunk → deterministic embed → store → SSE status; FileManager UI | drop a PDF, watch it reach `indexed`, see chunks in DB |
| **2 — RAG + Chat** | RagService, ConfidenceService, streaming chat, citations, history persistence | ask a question, get grounded streamed answer + sources + confidence badge |
| **3 — Memory** | MemoryService + recursive update rule + toggle in Settings | facts persist across sessions; contradictions supersede, no drift |
| **4 — Mind map + Skills** | clustering, topics, `/graph`, Cytoscape viewer; skill extraction, skill graph, SkillEditor; `/report` | "here are the skills + mind map I built for you" renders |
| **5 — Expert routing** | ExpertService ranking, <65 routing, ExpertCard UI, request-intro placeholder | low-confidence question surfaces ranked experts |
| **6 — Polish** | onboarding tutorial, settings (privacy/delete-all), error handling for large/invalid files, a11y pass, tests | WCAG AA pass, graceful failures, green test suite |
| **7 — Real providers (optional)** | wire Anthropic/OpenAI/watsonx adapters | flip `AI_PROVIDER`, identical behavior with real models |

Each phase is independently runnable and demoable. I recommend building **0 → 1 → 2**
first (that's the working vertical slice), then layering 3–6.

---

## 10. Assumptions & Open Questions

- **Auth** is minimal for dev (`x-user-id` / simple session). Flag if you need real
  IBM App ID / OAuth.
- **Multi-tenancy**: expert routing implies multiple users in one DB sharing a
  discoverability layer, but each user's documents/chunks are private. Assumed: skills +
  role are discoverable, raw content is not. Confirm this privacy boundary.
- **Email format**: assuming `.eml`/`.mbox`. If you mean Gmail/Outlook API import,
  that's a separate connector (different scope).
- **Embedding dim 384** chosen for MiniLM parity. If you later standardize on a real
  model with a different dim, it's a single config + reindex.
- **TypeScript** assumed for both backend and frontend (Carbon ships types). Say so if
  you want plain JS.
- **Scale**: pgvector `ivfflat` is fine to ~1M chunks/user; beyond that we'd revisit a
  dedicated vector store (already isolated behind EmbeddingService).
```
