import type { LlmContextChunk, LlmProvider } from "./types.js";
import { SYSTEM_PROMPT, buildUserPrompt } from "./prompt.js";
import { streamChatDeltas } from "../http.js";
import { config } from "../../config.js";

/** OpenAI Chat Completions, streamed. Also serves any OpenAI-compatible gateway
 *  via OPENAI_BASE_URL. */
export class OpenAiLlmProvider implements LlmProvider {
  constructor(
    private readonly apiKey = config.openai.apiKey,
    private readonly baseUrl = config.openai.baseUrl,
    private readonly model = config.openai.model
  ) {
    if (!this.apiKey) throw new Error("OPENAI_API_KEY is required for AI_PROVIDER=openai");
  }

  stream(
    question: string,
    context: LlmContextChunk[],
    memories: string[] = []
  ): AsyncIterable<string> {
    return streamChatDeltas(
      `${this.baseUrl}/chat/completions`,
      { authorization: `Bearer ${this.apiKey}` },
      {
        model: this.model,
        messages: [
          { role: "system", content: SYSTEM_PROMPT },
          { role: "user", content: buildUserPrompt(question, context, memories) },
        ],
        max_tokens: config.llm.maxTokens,
        temperature: config.llm.temperature,
      }
    );
  }
}
