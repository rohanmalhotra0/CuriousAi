// RAG pipeline: retrieve (pgvector cosine, user-scoped) -> re-rank (vector +
// keyword overlap) -> respond (grounded LLM stream) with citations from the
// chunks actually used.
import type { Citation } from "@curiousai/shared";
import { query, toVector } from "../db/pool.js";
import { embedOne } from "./embedding.service.js";

const RETRIEVE_K = 12;
const RESPOND_N = 5;

export interface Retrieved {
  chunkId: string;
  documentId: string;
  filename: string;
  text: string;
  vectorScore: number;
  score: number; // re-ranked
}

export async function retrieve(userId: string, question: string): Promise<Retrieved[]> {
  const qVec = await embedOne(question);
  // pgvector cosine distance (<=>); similarity = 1 - distance.
  const { rows } = await query(
    `SELECT c.id, c.document_id, c.text, d.filename,
            1 - (c.embedding <=> $1::vector) AS sim
       FROM chunks c
       JOIN documents d ON d.id = c.document_id
      WHERE c.user_id = $2 AND c.embedding IS NOT NULL
      ORDER BY c.embedding <=> $1::vector
      LIMIT $3`,
    [toVector(qVec), userId, RETRIEVE_K]
  );

  const qTerms = new Set(terms(question));
  const reranked = rows.map((r: any) => {
    const overlap = keywordOverlap(qTerms, r.text);
    const vectorScore = clamp01(Number(r.sim));
    return {
      chunkId: r.id as string,
      documentId: r.document_id as string,
      filename: r.filename as string,
      text: r.text as string,
      vectorScore,
      score: 0.7 * vectorScore + 0.3 * overlap,
    };
  });

  reranked.sort((a, b) => b.score - a.score);
  return reranked.slice(0, RESPOND_N);
}

export function toCitations(hits: Retrieved[]): Citation[] {
  return hits.map((h) => ({
    chunkId: h.chunkId,
    documentId: h.documentId,
    filename: h.filename,
    snippet: h.text.replace(/\s+/g, " ").slice(0, 200),
    score: Number(h.score.toFixed(3)),
  }));
}

function terms(s: string): string[] {
  return (s.toLowerCase().match(/[a-z0-9]+/g) ?? []).filter((w) => w.length > 2);
}
function keywordOverlap(qTerms: Set<string>, text: string): number {
  if (qTerms.size === 0) return 0;
  const t = new Set(terms(text));
  let hit = 0;
  for (const w of qTerms) if (t.has(w)) hit++;
  return hit / qTerms.size;
}
function clamp01(x: number): number {
  return Math.max(0, Math.min(1, x));
}
