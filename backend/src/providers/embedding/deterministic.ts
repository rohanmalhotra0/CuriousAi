import type { EmbeddingProvider } from "./types.js";

/**
 * Zero-dependency, fully deterministic embedding. It hashes word unigrams and
 * bigrams into a fixed-dimension bag-of-features vector, then L2-normalizes.
 *
 * Why this works for RAG: two texts that share tokens hash into the same
 * dimensions, so cosine similarity reflects lexical overlap. It is not
 * semantic like a real model, but it is stable, offline, and makes the whole
 * retrieve -> rank -> respond loop demoable without any API key. Swap in the
 * Anthropic/OpenAI/watsonx provider later with no call-site changes.
 */
export class DeterministicEmbeddingProvider implements EmbeddingProvider {
  constructor(public readonly dim: number) {}

  async embed(texts: string[]): Promise<number[][]> {
    return texts.map((t) => this.one(t));
  }

  private one(text: string): number[] {
    const vec = new Array(this.dim).fill(0);
    const tokens = tokenize(text);
    for (let i = 0; i < tokens.length; i++) {
      add(vec, tokens[i], 1, this.dim);
      if (i + 1 < tokens.length) add(vec, tokens[i] + " " + tokens[i + 1], 0.5, this.dim);
    }
    // L2 normalize so cosine == dot product downstream.
    let norm = Math.sqrt(vec.reduce((s, x) => s + x * x, 0)) || 1;
    return vec.map((x) => x / norm);
  }
}

function tokenize(text: string): string[] {
  return text.toLowerCase().match(/[a-z0-9]+/g) ?? [];
}

function add(vec: number[], token: string, weight: number, dim: number) {
  const h = hash(token);
  const idx = h % dim;
  // Signed contribution spreads features across +/- to reduce collisions.
  const sign = (hash(token + "#") & 1) === 0 ? 1 : -1;
  vec[idx] += weight * sign;
}

function hash(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}
