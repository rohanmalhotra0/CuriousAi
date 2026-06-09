// Shared text helpers for terms, stopword filtering, and simple keyphrase counts.

const STOP = new Set([
  "the", "and", "for", "are", "but", "not", "you", "all", "any", "can", "had", "her",
  "was", "one", "our", "out", "day", "get", "has", "him", "his", "how", "man", "new",
  "now", "old", "see", "two", "way", "who", "boy", "did", "its", "let", "put", "say",
  "she", "too", "use", "this", "that", "with", "from", "they", "have", "been", "were",
  "their", "would", "there", "which", "into", "than", "then", "them", "these", "some",
  "what", "when", "your", "also", "such", "each", "about", "other", "will", "more",
  "uses", "used", "using", "into", "over", "very", "most", "like",
]);

export function terms(s: string): string[] {
  return (s.toLowerCase().match(/[a-z0-9]+/g) ?? []).filter(
    (w) => w.length > 2 && !STOP.has(w)
  );
}

export function firstSentence(text: string): string {
  const s = text.replace(/\s+/g, " ").trim().split(/(?<=[.!?])\s/)[0] ?? text;
  return s.length > 240 ? s.slice(0, 237) + "..." : s;
}

/** Count unigram + bigram frequencies across a set of texts (stopwords removed). */
export function phraseCounts(texts: string[]): Map<string, number> {
  const counts = new Map<string, number>();
  for (const text of texts) {
    const ws = terms(text);
    for (let i = 0; i < ws.length; i++) {
      bump(counts, ws[i]);
      if (i + 1 < ws.length) bump(counts, `${ws[i]} ${ws[i + 1]}`);
    }
  }
  return counts;
}

function bump(m: Map<string, number>, k: string) {
  m.set(k, (m.get(k) ?? 0) + 1);
}

export function titleCase(s: string): string {
  return s.replace(/\b\w/g, (c) => c.toUpperCase());
}
