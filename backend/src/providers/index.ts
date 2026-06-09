// Provider selection lives here and nowhere else. Services depend only on the
// interfaces (LlmProvider / EmbeddingProvider), so switching providers never
// touches business logic. The chat model and the embedding model are selected
// independently — flipping the chat model to a real provider keeps the existing
// vector index working, while switching the embedding model is the heavier change
// that requires re-indexing.
import { config } from "../config.js";
import { logger } from "../lib/logger.js";

import type { EmbeddingProvider } from "./embedding/types.js";
import { DeterministicEmbeddingProvider } from "./embedding/deterministic.js";
import { OpenAiEmbeddingProvider } from "./embedding/openai.js";
import { WatsonxEmbeddingProvider } from "./embedding/watsonx.js";

import type { LlmProvider } from "./llm/types.js";
import { DeterministicLlmProvider } from "./llm/deterministic.js";
import { AnthropicLlmProvider } from "./llm/anthropic.js";
import { OpenAiLlmProvider } from "./llm/openai.js";
import { IcaLlmProvider } from "./llm/ica.js";
import { WatsonxLlmProvider } from "./llm/watsonx.js";

function selectLlm(): LlmProvider {
  switch (config.aiProvider) {
    case "anthropic":
      return new AnthropicLlmProvider();
    case "openai":
      return new OpenAiLlmProvider();
    case "ica":
      return new IcaLlmProvider();
    case "watsonx":
      return new WatsonxLlmProvider();
    case "deterministic":
      return new DeterministicLlmProvider();
    default:
      logger.warn(`AI_PROVIDER=${config.aiProvider} unknown; using deterministic`);
      return new DeterministicLlmProvider();
  }
}

function selectEmbedding(): EmbeddingProvider {
  switch (config.embeddingProvider) {
    case "openai":
      return new OpenAiEmbeddingProvider(config.embedDim);
    case "watsonx":
      return new WatsonxEmbeddingProvider(config.embedDim);
    case "deterministic":
      return new DeterministicEmbeddingProvider(config.embedDim);
    default:
      logger.warn(`EMBEDDING_PROVIDER=${config.embeddingProvider} unknown; using deterministic`);
      return new DeterministicEmbeddingProvider(config.embedDim);
  }
}

export const llmProvider: LlmProvider = selectLlm();
export const embeddingProvider: EmbeddingProvider = selectEmbedding();

logger.info(
  `Providers ready — chat=${config.aiProvider}, embeddings=${config.embeddingProvider} (dim=${config.embedDim})`
);
