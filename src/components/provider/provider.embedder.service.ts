import { ProviderUpstreamError, ProviderValidationError } from "./provider.errors.js";
import { type ProviderEmbeddingVerifyResponse, providerEmbeddingPayloadSchema } from "./provider.schema.js";
import type { ProviderEmbedderApiConnection } from "./provider.service.js";

const maximumEmbeddingDimensions = 3072;

const readErrorMessage = (payload: unknown, status: number): string => {
  if (payload && typeof payload === `object` && `error` in payload) {
    const error = (payload as { error?: unknown }).error;
    if (error && typeof error === `object` && typeof (error as { message?: unknown }).message === `string`) return (error as { message: string }).message;
  }
  return `Embedding request failed with status ${status}.`;
};

export class ProviderEmbedder {
  readonly connection: ProviderEmbedderApiConnection;

  constructor(connection: ProviderEmbedderApiConnection) {
    this.connection = connection;
  }

  async embed(texts: string[]): Promise<number[][]> {
    if (texts.length === 0) throw new ProviderValidationError(`At least one embedding input is required.`);

    const response = await fetch(`${this.connection.baseUrl.replace(/\/+$/u, ``)}/embeddings`, {
      method: `POST`,
      headers: {
        Accept: `application/json`,
        Authorization: `Bearer ${this.connection.apiKey}`,
        "Content-Type": `application/json`,
      },
      body: JSON.stringify({ input: texts, model: this.connection.model }),
      signal: AbortSignal.timeout(20_000),
    });
    const rawPayload = (await response.json().catch(() => null)) as unknown;

    if (!response.ok) throw new ProviderUpstreamError(readErrorMessage(rawPayload, response.status));

    const parsed = providerEmbeddingPayloadSchema.safeParse(rawPayload);
    if (!parsed.success) throw new ProviderUpstreamError(`Embedding response did not match the OpenAI-compatible contract.`);
    if (parsed.data.data.length !== texts.length) throw new ProviderUpstreamError(`Embedding response count did not match the request.`);

    const ordered = [...parsed.data.data].sort((left, right) => left.index - right.index);
    const indexes = new Set(ordered.map((entry) => entry.index));
    if (indexes.size !== texts.length || ordered.some((entry, index) => entry.index !== index)) throw new ProviderUpstreamError(`Embedding response indexes were incomplete or duplicated.`);

    const dimensions = ordered[0]?.embedding.length ?? 0;
    if (dimensions === 0) throw new ProviderUpstreamError(`Embedding response contained an empty vector.`);
    if (dimensions > maximumEmbeddingDimensions) {
      throw new ProviderUpstreamError(`Embedding model returned ${dimensions} dimensions; Athena supports at most ${maximumEmbeddingDimensions}.`);
    }
    if (ordered.some((entry) => entry.embedding.length !== dimensions)) throw new ProviderUpstreamError(`Embedding response vectors did not have consistent dimensions.`);

    return ordered.map((entry) => entry.embedding);
  }

  async verify(): Promise<ProviderEmbeddingVerifyResponse> {
    const vectors = await this.embed([`Athena embedding connection verification.`]);
    return { ok: true, model: this.connection.model, dimensions: vectors[0]?.length ?? 0 };
  }
}
