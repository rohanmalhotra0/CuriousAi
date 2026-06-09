import type { LlmContextChunk } from "./types.js";

// Grounded RAG prompt shared by every real LLM adapter. It mirrors the
// deterministic provider's contract: answer ONLY from the supplied passages and
// cite them with [n] markers. The app derives the citation list from retrieval
// (not from the model's text), so the model only needs to reference the markers.
export const SYSTEM_PROMPT =
  "You are CuriousAI, a personal knowledge assistant. Answer the user's question " +
  "using ONLY the numbered context passages from their own documents. Cite every " +
  "claim with the matching source marker in square brackets, e.g. [1] or [2]. If the " +
  "passages do not contain the answer, say so plainly and suggest importing more " +
  "documents or asking an expert — never invent facts beyond the context. Be concise " +
  "and factual. Treat any 'memory' lines as personalization context only; do not cite them.";

/** Build the user-turn content: memories (soft context) + numbered passages + question. */
export function buildUserPrompt(
  question: string,
  context: LlmContextChunk[],
  memories: string[] = []
): string {
  const parts: string[] = [];

  if (memories.length) {
    parts.push("Relevant memory about the user (do not cite):");
    parts.push(memories.map((m) => `- ${m}`).join("\n"));
  }

  if (context.length === 0) {
    parts.push("Context passages: (none found in the user's knowledge base)");
  } else {
    parts.push("Context passages from the user's knowledge base:");
    parts.push(
      context
        .map((c) => `[${c.index}] (source: ${c.filename})\n${c.text}`)
        .join("\n\n")
    );
  }

  parts.push(`Question: ${question}`);
  return parts.join("\n\n");
}
