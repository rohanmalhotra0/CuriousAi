import type { EmbeddingProvider } from "./types.js";
import { postJson, l2normalize } from "../http.js";
import { config } from "../../config.js";

/**
 * OpenAI embeddings. text-embedding-3-* support the `dimensions` param, so we
 * request exactly EMBED_DIM and the vectors drop straight into the existing
 * pgvector column with no schema change.
 */
export class OpenAiEmbeddingProvider implements EmbeddingProvider {
  constructor(
    public readonly dim: number,
    private readonly apiKey = config.openai.apiKey,
    private readonly baseUrl = config.openai.baseUrl,
    private readonly model = config.openai.embedModel
  ) {
    if (!this.apiKey) throw new Error("OPENAI_API_KEY is required for EMBEDDING_PROVIDER=openai");
  }

  async embed(texts: string[]): Promise<number[][]> {
    if (texts.length === 0) return [];
    const json = await postJson<{ data: { index: number; embedding: number[] }[] }>(
      `${this.baseUrl}/embeddings`,
      { authorization: `Bearer ${this.apiKey}` },
      { model: this.model, input: texts, dimensions: this.dim }
    );
    // Preserve input order (API returns an `index` per item) and normalize.
    return json.data
      .sort((a, b) => a.index - b.index)
      .map((d) => l2normalize(d.embedding));
  }
}
