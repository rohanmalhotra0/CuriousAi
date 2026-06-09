import type { LlmContextChunk, LlmProvider } from "./types.js";
import { SYSTEM_PROMPT, buildUserPrompt } from "./prompt.js";
import { streamChatDeltas } from "../http.js";
import { getIamToken } from "../watsonx/iam.js";
import { config } from "../../config.js";

/**
 * watsonx.ai chat, streamed. The `/ml/v1/text/chat_stream` endpoint emits
 * OpenAI-style `choices[].delta.content` frames, so it reuses the shared
 * streamer; it differs only in IAM bearer auth, the `?version=` query param, and
 * `model_id` / `project_id` body keys.
 */
export class WatsonxLlmProvider implements LlmProvider {
  constructor() {
    if (!config.watsonx.projectId) {
      throw new Error("WATSONX_PROJECT_ID is required for AI_PROVIDER=watsonx");
    }
  }

  async *stream(
    question: string,
    context: LlmContextChunk[],
    memories: string[] = []
  ): AsyncIterable<string> {
    const token = await getIamToken();
    const url = `${config.watsonx.url}/ml/v1/text/chat_stream?version=${config.watsonx.version}`;
    yield* streamChatDeltas(
      url,
      { authorization: `Bearer ${token}`, accept: "text/event-stream" },
      {
        model_id: config.watsonx.model,
        project_id: config.watsonx.projectId,
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
