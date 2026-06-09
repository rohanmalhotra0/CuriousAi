export interface LlmContextChunk {
  index: number; // 1-based citation marker
  text: string;
  filename: string;
}

export interface LlmProvider {
  /**
   * Stream a grounded answer token-by-token given the question, retrieved chunks,
   * and any recalled user memories (used as soft context, not cited).
   */
  stream(
    question: string,
    context: LlmContextChunk[],
    memories?: string[]
  ): AsyncIterable<string>;
}
