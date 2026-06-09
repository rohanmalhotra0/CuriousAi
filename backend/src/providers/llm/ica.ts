import type { LlmContextChunk, LlmProvider } from "./types.js";
import { SYSTEM_PROMPT, buildUserPrompt } from "./prompt.js";
import { streamChatDeltas } from "../http.js";
import { config } from "../../config.js";

/**
 * IBM Consulting Advantage (ICA) NextGen.
 *
 * The ICA gateway exposes the standard chat-completions protocol with SSE
 * streaming, so generation reuses the shared OpenAI-style streamer. The pieces
 * that vary in the beta — base path and auth header/scheme — are config-driven
 * (ICA_CHAT_PATH / ICA_AUTH_HEADER / ICA_AUTH_SCHEME) so the exact endpoint
 * contract can be matched without code changes.
 */
export class IcaLlmProvider implements LlmProvider {
  private readonly url: string;
  private readonly headers: Record<string, string>;

  constructor() {
    const { endpoint, apiKey, chatPath, authHeader, authScheme } = config.ica;
    if (!apiKey) throw new Error("ICA_API_KEY is required for AI_PROVIDER=ica");
    // Join endpoint + path without doubling slashes.
    this.url = `${endpoint.replace(/\/$/, "")}${chatPath.startsWith("/") ? "" : "/"}${chatPath}`;
    this.headers = {
      [authHeader]: authScheme ? `${authScheme} ${apiKey}` : apiKey,
    };
  }

  stream(
    question: string,
    context: LlmContextChunk[],
    memories: string[] = []
  ): AsyncIterable<string> {
    return streamChatDeltas(this.url, this.headers, {
      model: config.ica.model,
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        { role: "user", content: buildUserPrompt(question, context, memories) },
      ],
      max_tokens: config.llm.maxTokens,
      temperature: config.llm.temperature,
    });
  }
}
