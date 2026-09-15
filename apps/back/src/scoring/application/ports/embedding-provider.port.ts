export interface EmbeddingProviderPort {
  embed(text: string): Promise<readonly number[]>;
}
