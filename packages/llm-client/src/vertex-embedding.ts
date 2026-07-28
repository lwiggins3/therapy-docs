import { PredictionServiceClient, helpers } from "@google-cloud/aiplatform";

/**
 * Shared Vertex AI embedding call, used by every LlmClient adapter regardless of which model
 * generates text — Claude has no embeddings endpoint, so embeddings always go through a Vertex
 * AI embedding model. Uses `gemini-embedding-001` with `outputDimensionality: 1536` to match the
 * `vector(1536)` columns in packages/db/prisma/schema.prisma without a schema migration.
 *
 * NOTE: written to the documented Vertex AI predict request/response shape but not verified
 * against a live model in this environment (no GCP credentials here) — smoke-test once real
 * Vertex AI access exists (see docs/roadmap.md item 2).
 */
export async function embedWithVertexAi(
  options: { projectId: string; location: string; model?: string; outputDimensionality?: number },
  text: string,
): Promise<number[]> {
  const model = options.model ?? "gemini-embedding-001";
  const outputDimensionality = options.outputDimensionality ?? 1536;

  const client = new PredictionServiceClient({
    apiEndpoint: `${options.location}-aiplatform.googleapis.com`,
  });
  const endpoint = `projects/${options.projectId}/locations/${options.location}/publishers/google/models/${model}`;

  const instance = helpers.toValue({ content: text });
  const parameters = helpers.toValue({ outputDimensionality });

  const [response] = await client.predict({
    endpoint,
    instances: instance ? [instance] : [],
    parameters: parameters ?? undefined,
  });

  const prediction = response.predictions?.[0];
  if (!prediction) {
    throw new Error("Vertex AI embedding call returned no predictions");
  }

  // `prediction` is typed against @google-cloud/aiplatform's own generated protos namespace,
  // which diverges slightly (e.g. `nullValue`'s type) from the `protobuf.common.IValue` that
  // `helpers.fromValue` expects — same wire/JSON shape, different type declarations. Safe cast.
  const decoded = helpers.fromValue(prediction as Parameters<typeof helpers.fromValue>[0]) as {
    embeddings?: { values?: number[] };
  };
  const values = decoded.embeddings?.values;
  if (!values) {
    throw new Error("Vertex AI embedding response missing embeddings.values");
  }
  return values;
}
