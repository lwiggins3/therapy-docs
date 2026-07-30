import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { SecretManagerServiceClient } from "@google-cloud/secret-manager";

/**
 * Provider-agnostic storage for Gmail OAuth refresh tokens, mirroring the adapter pattern in
 * @therapy-docs/storage and @therapy-docs/llm-client. `save` returns an opaque `ref` that `load`
 * can later resolve on its own — callers never need to remember the original key.
 */
export interface TokenStore {
  save(key: string, refreshToken: string): Promise<{ ref: string }>;
  load(ref: string): Promise<string>;
}

/**
 * Dev-only: writes refresh tokens to plain local files. NOT a HIPAA-compliant store — real
 * deployments must use SecretManagerTokenStore (see docs/hipaa-compliance.md's BAA table, which
 * states Gmail OAuth tokens belong in Secret Manager, not Postgres or the local filesystem).
 */
export class LocalFileTokenStore implements TokenStore {
  constructor(private readonly baseDir: string) {}

  async save(key: string, refreshToken: string): Promise<{ ref: string }> {
    const ref = `local:${key}`;
    const path = this.pathFor(ref);
    await mkdir(dirname(path), { recursive: true });
    await writeFile(path, refreshToken, "utf-8");
    return { ref };
  }

  async load(ref: string): Promise<string> {
    return readFile(this.pathFor(ref), "utf-8");
  }

  private pathFor(ref: string): string {
    const key = ref.replace(/^local:/, "");
    return join(this.baseDir, "tokens", `${key}.txt`);
  }
}

/** One Secret Manager secret per therapist, always read/written via the "latest" version alias. */
export class SecretManagerTokenStore implements TokenStore {
  private readonly client: SecretManagerServiceClient;

  constructor(private readonly projectId: string) {
    this.client = new SecretManagerServiceClient();
  }

  async save(key: string, refreshToken: string): Promise<{ ref: string }> {
    const secretId = `gmail-token-${key}`;
    const parent = `projects/${this.projectId}`;
    const secretName = `${parent}/secrets/${secretId}`;

    try {
      await this.client.getSecret({ name: secretName });
    } catch {
      await this.client.createSecret({
        parent,
        secretId,
        secret: { replication: { automatic: {} } },
      });
    }

    await this.client.addSecretVersion({
      parent: secretName,
      payload: { data: Buffer.from(refreshToken, "utf-8") },
    });

    return { ref: `${secretName}/versions/latest` };
  }

  async load(ref: string): Promise<string> {
    const [version] = await this.client.accessSecretVersion({ name: ref });
    const data = version.payload?.data;
    if (!data) {
      throw new Error(`Secret Manager returned no payload for ${ref}`);
    }
    return data.toString();
  }
}

export type TokenStoreProvider = "local" | "secret-manager";

export function createTokenStore(options: {
  provider: TokenStoreProvider;
  projectId?: string;
  localDir?: string;
}): TokenStore {
  switch (options.provider) {
    case "secret-manager":
      if (!options.projectId) {
        throw new Error("createTokenStore: projectId is required for the secret-manager provider");
      }
      return new SecretManagerTokenStore(options.projectId);
    case "local":
      return new LocalFileTokenStore(options.localDir ?? ".local-storage");
    default:
      throw new Error(`Unknown token store provider: ${options.provider satisfies never}`);
  }
}
