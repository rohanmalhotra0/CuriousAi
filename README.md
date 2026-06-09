# CuriousAI

**A personal AI knowledge system** — think *Obsidian + ChatGPT + IBM ICA* in one app.
Import everything you read, write, and collect; CuriousAI turns it into a private,
searchable knowledge base and answers your questions **grounded in your own documents** —
every answer comes back with **citations** and a **confidence score**. When the system
isn't confident enough to answer, it routes you to **experts** (peers whose own knowledge
profile matches the question) instead of guessing.

Underneath, the same indexed content powers a **persistent memory** that learns durable
facts about you, an Obsidian-style **mind map** of your topics, and an auto-extracted
**skill profile** — all built locally from your data.

> Architecture deep-dive & full roadmap: see [`ARCHITECTURE.md`](./ARCHITECTURE.md).

## Why it exists

Most chat assistants answer from a frozen, generic model and can't tell you *why* they
said something. CuriousAI flips that:

- **Your corpus is the source of truth.** Answers are retrieved from documents *you*
  imported, with inline citations back to the exact passage.
- **It admits when it doesn't know.** A calibrated confidence score gates every answer;
  below the threshold it stops guessing and connects you to a human who knows.
- **It compounds over time.** Memory, topic maps, and skill profiles are rebuilt from
  your growing knowledge base, so the system gets more *yours* the more you feed it.
- **It's private and runnable with zero keys.** The default AI provider is fully
  deterministic — no API keys, no external calls — so you can clone, run, and demo the
  whole pipeline offline, then swap in a real model when you want.

## Stack

| Layer | Tech |
|-------|------|
| **Backend** | Node + Express + TypeScript, PostgreSQL + **pgvector** |
| **Frontend** | React + Vite + **IBM Carbon Design System** (white/blue ICA theme) |
| **AI** | Pluggable providers behind one interface — **deterministic** by default (zero keys), swappable to Anthropic / OpenAI / watsonx via `AI_PROVIDER` |
| **Shared** | A typed contract (`@curiousai/shared`) so frontend and backend never drift |

The repo is an npm-workspaces monorepo: `shared/` (types), `backend/` (API + services),
`frontend/` (Carbon UI).

## How it works

```
Import (PDF/DOCX/TXT/EML/ZIP)
   └─ extract text ─ chunk ─ embed ─ index in pgvector        [live SSE status]
                                        │
Ask a question ─────────────────────────┤
   ├─ retrieve top chunks (vector + keyword re-rank)
   ├─ recall relevant long-term memories
   ├─ stream a grounded answer (token-by-token over SSE)
   ├─ score CONFIDENCE from retrieval quality
   │     ├─ ≥ threshold → answer + CITATIONS
   │     └─ < threshold → ROUTE to ranked EXPERTS
   └─ learn durable facts from the turn → MEMORY
```

The same indexed embeddings are reused offline to build:

- **Mind map** — k-means clusters of your chunks become labelled topics with
  similarity edges (an Obsidian-style graph).
- **Skill profile** — frequency/keyphrase extraction surfaces what you know, scored
  by evidence into beginner / intermediate / advanced levels.

### Notable design choices

- **Drift-resistant memory.** New facts are merged, *superseded* (old version kept,
  decayed in salience), or inserted — never destructively overwritten — so memory stays
  auditable. See `backend/src/services/memory.service.ts`.
- **Provider abstraction.** Services and routes depend on interfaces, not
  implementations. Swapping models touches only `backend/src/providers/`.
- **Deterministic everything.** Embeddings, LLM streaming, clustering, and skill
  extraction all have deterministic implementations, so the full product is demoable
  without a single API key.

## Feature status

**Working end-to-end (Phase 0–2)**
- Drag-and-drop bulk import: **PDF, DOCX, TXT, EML, ZIP** (zip expands recursively)
- Ingestion pipeline with **live status** (upload → extracting → embedding → indexed) over SSE
- Vector indexing in pgvector; **RAG** retrieve → keyword re-rank → grounded streamed answer
- **Citations** under every answer + **confidence badge** (route to experts below threshold)
- **Expert routing** — ranked peer cards (skills, role, recency, topic match) + "request intro"
- **Persistent memory** wired into chat, gated by a per-user memory toggle
- Chat history persistence (conversations, messages, citations)

**Knowledge surfaces (Phase 4)**
- **Mind map** service + API + Cytoscape UI (`mindmap.service.ts`, `graph.routes.ts`) — topic clustering & graph
- **Skill profile** service + API + editor UI (`skill.service.ts`, `skills.routes.ts`) — extraction, edit, rebuild

**Polish (Phase 6)**
- **Settings page** — memory toggle + GDPR-style **delete-all** (transactional; removes documents, chunks, memories, topics, skills, chats, intro requests, *and* raw files on disk)
- **Robust upload errors** — oversized files return `413`, unsupported types `415`, each with a clear message (no silent half-imports)
- **Accessibility** — skip-to-content link, `aria-live` streaming chat log, labelled controls, WCAG-AA Carbon components
- **Test suite** — `npm test` runs zero-dependency unit tests (`node:test`) for confidence, vectors, chunking, embeddings, and text utilities

## Run with Docker (recommended)

```bash
cp .env.example .env
docker compose up --build      # db (pgvector) + api + web
# once db is healthy, in another shell:
docker compose exec api npm run migrate
```

Open **http://localhost:5173**. API health: **http://localhost:4000/health**.

## Run locally without Docker

```bash
# 1. Postgres with pgvector
docker run -d --name curious-db -p 5432:5432 \
  -e POSTGRES_USER=curious -e POSTGRES_PASSWORD=curious -e POSTGRES_DB=curiousai \
  pgvector/pgvector:pg16

cp .env.example .env
npm install        # all workspaces
npm run migrate    # schema + seed demo user
npm run dev        # api (:4000) + web (:5173)
```

## Try it

1. **Documents** → drop a PDF/text file → watch it reach **Indexed**.
2. **Chat** → ask about that document → streamed, cited answer + confidence badge.
3. Ask something off-topic → confidence drops below the threshold → expert cards appear.
4. Tell the assistant a fact about yourself ("I prefer X") → it's captured in memory and
   recalled on later, related questions (toggle memory off to opt out).

## Swapping in a real model

Real adapters are wired and selected purely by env — services and routes never
change because they depend on the `LlmProvider` / `EmbeddingProvider` interfaces,
not the implementations.

**Chat model** — set `AI_PROVIDER` + the matching credentials:

| `AI_PROVIDER` | Needs | Notes |
|---------------|-------|-------|
| `deterministic` | nothing | default; offline, no keys |
| `anthropic` | `ANTHROPIC_API_KEY` | native Messages API, streamed |
| `openai` | `OPENAI_API_KEY` | Chat Completions; also any OpenAI-compatible gateway via `OPENAI_BASE_URL` |
| `ica` | `ICA_ENDPOINT` + `ICA_API_KEY` | **IBM Consulting Advantage** NextGen; chat-completions over SSE |
| `watsonx` | `WATSONX_API_KEY` + `WATSONX_PROJECT_ID` | watsonx.ai chat (IAM token auth) |

The chat model can be flipped on its own — retrieval, citations, and confidence
keep working against the **existing** vector index, so no re-indexing is needed.

**Embedding model** — selected separately via `EMBEDDING_PROVIDER`
(`deterministic` | `openai` | `watsonx`). Switching it changes vector
dimensionality, so set `EMBED_DIM` to match (OpenAI `text-embedding-3-*` honors
the `dimensions` param → 384; watsonx `slate-30m` is 384) and re-run
`npm run migrate` + re-import documents.

ICA-specific knobs (`ICA_CHAT_PATH`, `ICA_AUTH_HEADER`, `ICA_AUTH_SCHEME`) let you
match the exact beta-gateway contract without code changes. See `.env.example` for
every variable.

## Project layout

```
shared/    @curiousai/shared — DTOs & API contract shared by both ends
backend/   Express API
  src/api/         route handlers (files, chat, experts, graph, skills)
  src/services/    ingestion, extraction, rag, confidence, expert,
                   memory, mindmap, skill
  src/providers/   pluggable embedding + llm (deterministic default)
  src/db/          pool + SQL migrations
frontend/  React + Carbon UI (Onboarding, Documents, Chat, + Phase-4 pages)
```
