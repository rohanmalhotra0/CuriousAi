// Chunking + embedding. Splits text into sentence-aware, overlapping windows so
// retrieval has coherent units, then delegates vector generation to the provider.
import { embeddingProvider } from "../providers/index.js";

const TARGET_WORDS = 180; // ~ 500 tokens
const OVERLAP_WORDS = 30;

export interface Chunk {
  ordinal: number;
  text: string;
  tokenCount: number;
}

export function chunkText(text: string): Chunk[] {
  const clean = text.replace(/\r/g, "").replace(/\n{3,}/g, "\n\n").trim();
  if (!clean) return [];

  const sentences = clean.match(/[^.!?\n]+[.!?]?(\s|$)/g) ?? [clean];
  const chunks: Chunk[] = [];
  let buf: string[] = [];
  let words = 0;

  const flush = () => {
    if (!buf.length) return;
    const body = buf.join(" ").trim();
    chunks.push({ ordinal: chunks.length, text: body, tokenCount: body.split(/\s+/).length });
  };

  for (const s of sentences) {
    const w = s.trim().split(/\s+/).length;
    if (words + w > TARGET_WORDS && buf.length) {
      flush();
      // carry overlap into the next window for context continuity
      const carry = buf.join(" ").split(/\s+/).slice(-OVERLAP_WORDS);
      buf = [carry.join(" ")];
      words = carry.length;
    }
    buf.push(s.trim());
    words += w;
  }
  flush();
  return chunks;
}

export async function embedChunks(texts: string[]): Promise<number[][]> {
  if (texts.length === 0) return [];
  return embeddingProvider.embed(texts);
}

export async function embedOne(text: string): Promise<number[]> {
  const [v] = await embeddingProvider.embed([text]);
  return v;
}
