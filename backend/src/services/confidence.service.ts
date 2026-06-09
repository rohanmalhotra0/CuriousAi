// Pure, LLM-independent confidence scoring (0-100) derived from retrieval signals.
// Deterministic so behavior is identical across runs.
//
// Calibration note: raw similarity magnitudes depend on the embedding provider.
// The lexical-hash default tops out around ~0.5 for a strong match, whereas a
// semantic model would reach ~0.85. So we blend the signals, then pass them
// through a logistic curve whose midpoint/width are *calibrated to the active
// provider*. Swapping to a semantic provider means re-tuning MID/WIDTH here only
// — the formula and call sites stay the same.
import { CONFIDENCE_THRESHOLD } from "@curiousai/shared";

export interface RankedHit {
  score: number; // blended re-rank score in [0,1] (vector + keyword overlap)
}

// Tuned for the deterministic lexical-hash provider.
const MID = 0.32;
const WIDTH = 0.1;

export function scoreConfidence(hits: RankedHit[]): number {
  if (hits.length === 0) return 0;
  const sorted = [...hits].sort((a, b) => b.score - a.score);
  const top = sorted[0].score;
  const topN = sorted.slice(0, 3);
  const mean = topN.reduce((s, h) => s + h.score, 0) / topN.length;
  const spread = top - sorted[sorted.length - 1].score;
  const support = Math.min(hits.length, 5) / 5; // more supporting chunks -> higher

  const signal = 0.5 * top + 0.3 * mean + 0.2 * support - 0.1 * spread;
  const calibrated = logistic((signal - MID) / WIDTH);
  return Math.max(0, Math.min(100, Math.round(calibrated * 100)));
}

function logistic(x: number): number {
  return 1 / (1 + Math.exp(-x));
}

export function shouldRoute(confidence: number): boolean {
  return confidence < CONFIDENCE_THRESHOLD;
}

export function confidenceColor(confidence: number): "green" | "blue" | "red" {
  if (confidence >= 80) return "green";
  if (confidence >= CONFIDENCE_THRESHOLD) return "blue";
  return "red";
}
