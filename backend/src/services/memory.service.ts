// Persistent user memory with a recursive, drift-resistant update rule.
//
// On each turn we extract candidate facts (declarative statements the user makes,
// not questions). For each candidate we find the nearest existing memory by cosine
// similarity and decide:
//   - sim > DUP            -> MERGE: bump salience, refresh timestamp (no new row)
//   - DUP >= sim > RELATED
//        and contradiction -> SUPERSEDE: insert new, point old.supersedes -> new,
//                             decay old salience (old history preserved, not deleted)
//   - otherwise            -> INSERT a fresh memory
//
// Nothing is ever destructively edited, so the memory history stays auditable and
// stale facts sink via salience decay rather than being silently overwritten.
import { query, toVector } from "../db/pool.js";
import { cosine, parseVector } from "../lib/vec.js";
import { terms } from "../lib/text.js";
import { embedOne } from "./embedding.service.js";

const DUP = 0.9; // near-identical -> merge
const RELATED = 0.55; // related enough to compare for contradiction
const DECAY = 0.5; // salience multiplier applied to a superseded memory
const NEGATIONS = ["not", "no", "never", "isn't", "wasn't", "don't", "doesn't", "cannot", "can't"];

export interface MemoryRow {
  id: string;
  content: string;
  salience: number;
  embedding: number[];
}

/** Recall the most relevant memories for a query, scored by cosine * salience. */
export async function recall(userId: string, query_text: string, limit = 3): Promise<MemoryRow[]> {
  const qVec = await embedOne(query_text);
  const { rows } = await query(
    `SELECT id, content, salience, embedding
       FROM memories
      WHERE user_id = $1 AND supersedes_id IS NULL AND embedding IS NOT NULL
      ORDER BY embedding <=> $2::vector
      LIMIT 20`,
    [userId, toVector(qVec)]
  );
  return rows
    .map((r: any) => ({
      id: r.id,
      content: r.content,
      salience: Number(r.salience),
      embedding: parseVector(r.embedding),
    }))
    .map((m) => ({ ...m, _score: cosine(qVec, m.embedding) * m.salience }))
    .sort((a: any, b: any) => b._score - a._score)
    .slice(0, limit)
    .filter((m: any) => m._score > 0.2);
}

/** Extract declarative candidate facts from a turn and apply the update rule. */
export async function ingestTurn(userId: string, text: string): Promise<number> {
  const candidates = extractFacts(text);
  let written = 0;
  for (const fact of candidates) {
    const vec = await embedOne(fact);
    const nearest = await nearestMemory(userId, vec);

    if (nearest && cosine(vec, nearest.embedding) > DUP) {
      // MERGE
      await query(
        "UPDATE memories SET salience = salience + 0.5, updated_at = now() WHERE id = $1",
        [nearest.id]
      );
    } else if (
      nearest &&
      cosine(vec, nearest.embedding) > RELATED &&
      contradicts(fact, nearest.content)
    ) {
      // SUPERSEDE
      const ins = await query(
        `INSERT INTO memories (user_id, content, embedding) VALUES ($1,$2,$3::vector) RETURNING id`,
        [userId, fact, toVector(vec)]
      );
      await query(
        "UPDATE memories SET supersedes_id = $1, salience = salience * $2, updated_at = now() WHERE id = $3",
        [ins.rows[0].id, DECAY, nearest.id]
      );
      written++;
    } else {
      // INSERT
      await query(
        `INSERT INTO memories (user_id, content, embedding) VALUES ($1,$2,$3::vector)`,
        [userId, fact, toVector(vec)]
      );
      written++;
    }
  }
  return written;
}

async function nearestMemory(userId: string, vec: number[]): Promise<MemoryRow | null> {
  const { rows } = await query(
    `SELECT id, content, salience, embedding
       FROM memories
      WHERE user_id = $1 AND supersedes_id IS NULL AND embedding IS NOT NULL
      ORDER BY embedding <=> $2::vector
      LIMIT 1`,
    [userId, toVector(vec)]
  );
  if (!rows.length) return null;
  const r = rows[0];
  return { id: r.id, content: r.content, salience: Number(r.salience), embedding: parseVector(r.embedding) };
}

// Declarative sentences (not questions), with a personal/declarative cue, become
// candidate facts. Conservative on purpose so chat questions don't pollute memory.
function extractFacts(text: string): string[] {
  return text
    .split(/(?<=[.!?])\s+|\n+/)
    .map((s) => s.trim())
    .filter((s) => s.length > 8 && !s.endsWith("?"))
    .filter((s) => /\b(i|my|we|our|prefer|use|using|always|never|favorite|named|called|is|are|was|work)\b/i.test(s))
    .slice(0, 5);
}

// Deterministic contradiction heuristic: strong subject overlap but mismatched
// polarity (one negated, the other not) or a differing number. A real LLM provider
// would replace this with a semantic entailment check.
function contradicts(a: string, b: string): boolean {
  const negA = NEGATIONS.some((n) => a.toLowerCase().includes(n));
  const negB = NEGATIONS.some((n) => b.toLowerCase().includes(n));
  if (negA !== negB) return true;
  const numA = a.match(/\d+/g)?.join(",");
  const numB = b.match(/\d+/g)?.join(",");
  if (numA && numB && numA !== numB) {
    const overlap = sharedTerms(a, b);
    return overlap >= 2;
  }
  return false;
}

function sharedTerms(a: string, b: string): number {
  const sb = new Set(terms(b));
  return terms(a).filter((w) => sb.has(w)).length;
}
