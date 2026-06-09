import "dotenv/config";

function int(name: string, fallback: number): number {
  const v = process.env[name];
  return v ? parseInt(v, 10) : fallback;
}

export const config = {
  port: int("PORT", 4000),
  databaseUrl:
    process.env.DATABASE_URL ??
    "postgres://curious:curious@localhost:5432/curiousai",
  storageDir: process.env.STORAGE_DIR ?? "./.data/files",
  aiProvider: (process.env.AI_PROVIDER ?? "deterministic") as
    | "deterministic"
    | "anthropic"
    | "openai"
    | "watsonx",
  embedDim: int("EMBED_DIM", 384),
  maxFileBytes: int("MAX_FILE_MB", 50) * 1024 * 1024,
  maxZipEntries: int("MAX_ZIP_ENTRIES", 500),
} as const;
