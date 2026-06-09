import type { LlmContextChunk, LlmProvider } from "./types.js";

/**
 * Deterministic, grounded "LLM": it composes an answer strictly from the
 * retrieved chunks and cites them with [n] markers. No hallucination because it
 * never invents content beyond the supplied context. Streams sentence-by-sentence
 * so the chat UI exercises the same SSE path a real model would use.
 */
export class DeterministicLlmProvider implements LlmProvider {
  async *stream(
    question: string,
    context: LlmContextChunk[],
    memories: string[] = []
  ): AsyncIterable<string> {
    const parts: string[] = [];
    if (memories.length) {
      parts.push(`From your memory: ${memories.join(" ")}`);
    }
    if (context.length === 0) {
      parts.push(
        "I couldn't find anything in your indexed documents that answers this. " +
          "Try importing more files, or I can route you to an expert."
      );
    } else {
      parts.push(`Based on your knowledge base, here is what I found about "${trim(question)}":`);
      for (const c of context) {
        parts.push(`${bestSentence(question, c.text)} [${c.index}]`);
      }
      parts.push(`Sources are listed below (${context.map((c) => `[${c.index}] ${c.filename}`).join(", ")}).`);
    }
    const full = parts.join("\n\n");
    for (const token of full.match(/\S+\s*/g) ?? [full]) {
      yield token;
      await sleep(8); // pace the stream so the UI shows progressive rendering
    }
  }
}

// Pick the sentence in the chunk with the most lexical overlap with the question,
// so the grounded answer is actually relevant rather than just the first line.
function bestSentence(question: string, text: string): string {
  const qTerms = new Set(terms(question));
  const sentences = text.replace(/\s+/g, " ").trim().split(/(?<=[.!?])\s/).filter(Boolean);
  let best = sentences[0] ?? text;
  let bestScore = -1;
  for (const s of sentences) {
    const st = terms(s);
    let hit = 0;
    for (const w of st) if (qTerms.has(w)) hit++;
    if (hit > bestScore) {
      bestScore = hit;
      best = s;
    }
  }
  return best.length > 280 ? best.slice(0, 277) + "..." : best;
}

function terms(s: string): string[] {
  return (s.toLowerCase().match(/[a-z0-9]+/g) ?? []).filter((w) => w.length > 2);
}
function trim(q: string): string {
  return q.length > 80 ? q.slice(0, 77) + "..." : q;
}
function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}
