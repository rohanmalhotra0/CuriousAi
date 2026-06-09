// Small vector utilities shared by memory, mind-map, and skill services.
// Embeddings from the provider are already L2-normalized, so cosine == dot.

export function parseVector(s: string | number[]): number[] {
  if (Array.isArray(s)) return s;
  return s.replace(/[\[\]]/g, "").split(",").map(Number);
}

export function dot(a: number[], b: number[]): number {
  let s = 0;
  for (let i = 0; i < a.length; i++) s += a[i] * b[i];
  return s;
}

export function cosine(a: number[], b: number[]): number {
  // assumes normalized inputs; falls back to true cosine otherwise
  const d = dot(a, b);
  return Math.max(-1, Math.min(1, d));
}

export function mean(vectors: number[][]): number[] {
  const dim = vectors[0]?.length ?? 0;
  const out = new Array(dim).fill(0);
  for (const v of vectors) for (let i = 0; i < dim; i++) out[i] += v[i];
  for (let i = 0; i < dim; i++) out[i] /= vectors.length || 1;
  return normalize(out);
}

export function normalize(v: number[]): number[] {
  const n = Math.sqrt(v.reduce((s, x) => s + x * x, 0)) || 1;
  return v.map((x) => x / n);
}

/**
 * Lightweight cosine k-means for normalized vectors. Deterministic given a seed
 * so topic assignments are stable across rebuilds of the same content.
 */
export function kmeans(
  vectors: number[][],
  k: number,
  iterations = 25,
  seed = 1
): { assignments: number[]; centroids: number[][] } {
  const n = vectors.length;
  k = Math.max(1, Math.min(k, n));
  let rng = seed >>> 0;
  const rand = () => ((rng = (rng * 1664525 + 1013904223) >>> 0) / 0xffffffff);

  // k-means++-ish seeding: first centroid random, rest favor far points.
  const centroids: number[][] = [vectors[Math.floor(rand() * n)].slice()];
  while (centroids.length < k) {
    const dists = vectors.map((v) => 1 - Math.max(...centroids.map((c) => cosine(v, c))));
    const total = dists.reduce((s, d) => s + d, 0) || 1;
    let r = rand() * total;
    let idx = 0;
    for (; idx < n; idx++) {
      r -= dists[idx];
      if (r <= 0) break;
    }
    centroids.push(vectors[Math.min(idx, n - 1)].slice());
  }

  const assignments = new Array(n).fill(0);
  for (let it = 0; it < iterations; it++) {
    let changed = false;
    for (let i = 0; i < n; i++) {
      let best = 0;
      let bestSim = -Infinity;
      for (let c = 0; c < centroids.length; c++) {
        const sim = cosine(vectors[i], centroids[c]);
        if (sim > bestSim) {
          bestSim = sim;
          best = c;
        }
      }
      if (assignments[i] !== best) {
        assignments[i] = best;
        changed = true;
      }
    }
    for (let c = 0; c < centroids.length; c++) {
      const members = vectors.filter((_, i) => assignments[i] === c);
      if (members.length) centroids[c] = mean(members);
    }
    if (!changed) break;
  }
  return { assignments, centroids };
}
