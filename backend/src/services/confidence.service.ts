// Pure, LLM-independent confidence scoring (0-100) derived from retrieval signals.
// Deterministic so behavior is identical with placeholder or real embeddings.
import { CONFIDENCE_THRESHOLD } from "@curiousai/shared";

export interface RankedHit {
  score: number; // cosine similarity in [0,1]
}

export function scoreConfidence(hits: RankedHit[]): number {
  if (hits.length === 0) return 0;
  const sorted = [...hits].sort((a, b) => b.score - a.score);
  const top = sorted[0].score;
  const topN = sorted.slice(0, 3);
  const mean = topN.reduce((s, h) => s + h.score, 0) / topN.length;
  const spread = top - sorted[sorted.length - 1].score;
  const support = Math.min(hits.length, 5) / 5; // more supporting chunks -> higher

  const raw =
    0.45 * top +
    0.30 * mean +
    0.15 * support -
    0.10 * spread;

  return Math.max(0, Math.min(100, Math.round(raw * 100)));
}

export function shouldRoute(confidence: number): boolean {
  return confidence < CONFIDENCE_THRESHOLD;
}

export function confidenceColor(confidence: number): "green" | "blue" | "red" {
  if (confidence >= 80) return "green";
  if (confidence >= CONFIDENCE_THRESHOLD) return "blue";
  return "red";
}
