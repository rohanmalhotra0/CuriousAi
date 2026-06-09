import type { LlmContextChunk, LlmProvider } from "./types.js";
import { SYSTEM_PROMPT, buildUserPrompt } from "./prompt.js";
import { sseData } from "../http.js";
import { config } from "../../config.js";

/**
 * Anthropic Messages API, streamed. Anthropic is NOT OpenAI-compatible: the
 * system prompt is a top-level field and the stream emits typed events, so it
 * parses `content_block_delta` frames directly rather than reusing the shared
 * chat-completions streamer.
 */
export class AnthropicLlmProvider implements LlmProvider {
  constructor(
    private readonly apiKey = config.anthropic.apiKey,
    private readonly baseUrl = config.anthropic.baseUrl,
    private readonly model = config.anthropic.model
  ) {
    if (!this.apiKey) throw new Error("ANTHROPIC_API_KEY is required for AI_PROVIDER=anthropic");
  }

  async *stream(
    question: string,
    context: LlmContextChunk[],
    memories: string[] = []
  ): AsyncIterable<string> {
    const res = await fetch(`${this.baseUrl}/v1/messages`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-api-key": this.apiKey,
        "anthropic-version": config.anthropic.version,
      },
      body: JSON.stringify({
        model: this.model,
        max_tokens: config.llm.maxTokens,
        temperature: config.llm.temperature,
        system: SYSTEM_PROMPT,
        stream: true,
        messages: [{ role: "user", content: buildUserPrompt(question, context, memories) }],
      }),
    });
    if (!res.ok || !res.body) {
      throw new Error(`Anthropic request failed: ${res.status} ${await safeText(res)}`);
    }

    for await (const data of sseData(res.body as AsyncIterable<Uint8Array>)) {
      let json: any;
      try {
        json = JSON.parse(data);
      } catch {
        continue;
      }
      if (json?.type === "content_block_delta" && json.delta?.type === "text_delta") {
        yield json.delta.text as string;
      }
    }
  }
}

async function safeText(res: Response): Promise<string> {
  try {
    return (await res.text()).slice(0, 500);
  } catch {
    return "";
  }
}
