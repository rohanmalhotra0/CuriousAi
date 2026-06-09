import type { LlmContextChunk, LlmProvider } from "./types.js";

/**
 * Deterministic, grounded "LLM": it composes an answer strictly from the
 * retrieved chunks and cites them with [n] markers. No hallucination because it
 * never invents content beyond the supplied context. Streams sentence-by-sentence
 * so the chat UI exercises the same SSE path a real model would use.
 */
export class DeterministicLlmProvider implements LlmProvider {
  async *stream(question: string, context: LlmContextChunk[]): AsyncIterable<string> {
    const parts: string[] = [];
    if (context.length === 0) {
      parts.push(
        "I couldn't find anything in your indexed documents that answers this. " +
          "Try importing more files, or I can route you to an expert."
      );
    } else {
      parts.push(`Based on your knowledge base, here is what I found about "${trim(question)}":`);
      for (const c of context) {
        parts.push(`${summarize(c.text)} [${c.index}]`);
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

function summarize(text: string): string {
  const sentence = text.replace(/\s+/g, " ").trim().split(/(?<=[.!?])\s/)[0] ?? text;
  return sentence.length > 280 ? sentence.slice(0, 277) + "..." : sentence;
}
function trim(q: string): string {
  return q.length > 80 ? q.slice(0, 77) + "..." : q;
}
function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}
