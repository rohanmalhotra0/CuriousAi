export interface EmbeddingProvider {
  readonly dim: number;
  /** Map each input string to a unit-normalized vector of length `dim`. */
  embed(texts: string[]): Promise<number[][]>;
}
