// Provider selection lives here and nowhere else. Services depend only on the
// interfaces, so switching AI_PROVIDER never touches business logic. Real
// adapters (anthropic/openai/watsonx) implement the same interfaces and slot in
// by adding cases below.
import { config } from "../config.js";
import { logger } from "../lib/logger.js";
import type { EmbeddingProvider } from "./embedding/types.js";
import type { LlmProvider } from "./llm/types.js";
import { DeterministicEmbeddingProvider } from "./embedding/deterministic.js";
import { DeterministicLlmProvider } from "./llm/deterministic.js";

let embedding: EmbeddingProvider;
let llm: LlmProvider;

switch (config.aiProvider) {
  case "deterministic":
  default:
    if (config.aiProvider !== "deterministic")
      logger.warn(`AI_PROVIDER=${config.aiProvider} not yet wired; using deterministic`);
    embedding = new DeterministicEmbeddingProvider(config.embedDim);
    llm = new DeterministicLlmProvider();
    break;
}

export const embeddingProvider = embedding;
export const llmProvider = llm;
