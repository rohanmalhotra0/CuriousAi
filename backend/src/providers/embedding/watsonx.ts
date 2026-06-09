import type { EmbeddingProvider } from "./types.js";
import { postJson, l2normalize } from "../http.js";
import { getIamToken } from "../watsonx/iam.js";
import { config } from "../../config.js";

/**
 * watsonx.ai embeddings. The embedding model's output dimension is fixed by the
 * model (e.g. slate-30m -> 384), so EMBED_DIM must match the chosen model and the
 * `dim` reported here is whatever the config says — callers index against it.
 */
export class WatsonxEmbeddingProvider implements EmbeddingProvider {
  constructor(public readonly dim: number) {
    if (!config.watsonx.projectId) {
      throw new Error("WATSONX_PROJECT_ID is required for EMBEDDING_PROVIDER=watsonx");
    }
  }

  async embed(texts: string[]): Promise<number[][]> {
    if (texts.length === 0) return [];
    const token = await getIamToken();
    const json = await postJson<{ results: { embedding: number[] }[] }>(
      `${config.watsonx.url}/ml/v1/text/embeddings?version=${config.watsonx.version}`,
      { authorization: `Bearer ${token}` },
      {
        model_id: config.watsonx.embedModel,
        project_id: config.watsonx.projectId,
        inputs: texts,
      }
    );
    return json.results.map((r) => l2normalize(r.embedding));
  }
}
