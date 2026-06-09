import "dotenv/config";

function int(name: string, fallback: number): number {
  const v = process.env[name];
  return v ? parseInt(v, 10) : fallback;
}

function num(name: string, fallback: number): number {
  const v = process.env[name];
  return v !== undefined && v !== "" ? Number(v) : fallback;
}

function str(name: string, fallback = ""): string {
  return process.env[name] ?? fallback;
}

export const config = {
  port: int("PORT", 4000),
  databaseUrl:
    process.env.DATABASE_URL ??
    "postgres://curious:curious@localhost:5432/curiousai",
  storageDir: process.env.STORAGE_DIR ?? "./.data/files",

  // Chat model. Flip this to use a real LLM; retrieval/citation/confidence logic
  // is untouched because services depend on the LlmProvider interface, not the impl.
  aiProvider: (process.env.AI_PROVIDER ?? "deterministic") as
    | "deterministic"
    | "anthropic"
    | "openai"
    | "ica"
    | "watsonx",

  // Embeddings are selected independently of the chat model. Switching the
  // embedding model changes vector dimensionality and would require re-indexing
  // every chunk, so this defaults to deterministic even when AI_PROVIDER is real
  // — flipping to a real chat model keeps the existing index working as-is.
  embeddingProvider: (process.env.EMBEDDING_PROVIDER ?? "deterministic") as
    | "deterministic"
    | "openai"
    | "watsonx",
  embedDim: int("EMBED_DIM", 384),

  // Generation params shared by all real LLM adapters. Low temperature keeps
  // answers grounded in the retrieved context.
  llm: {
    maxTokens: int("LLM_MAX_TOKENS", 1024),
    temperature: num("LLM_TEMPERATURE", 0.2),
  },

  anthropic: {
    apiKey: str("ANTHROPIC_API_KEY"),
    baseUrl: str("ANTHROPIC_BASE_URL", "https://api.anthropic.com"),
    model: str("ANTHROPIC_MODEL", "claude-opus-4-8"),
    version: str("ANTHROPIC_VERSION", "2023-06-01"),
  },

  openai: {
    apiKey: str("OPENAI_API_KEY"),
    baseUrl: str("OPENAI_BASE_URL", "https://api.openai.com/v1"),
    model: str("OPENAI_MODEL", "gpt-4o-mini"),
    embedModel: str("OPENAI_EMBED_MODEL", "text-embedding-3-small"),
  },

  // IBM Consulting Advantage (ICA) NextGen. The gateway speaks the standard
  // chat-completions protocol with SSE streaming, so it reuses the OpenAI-style
  // adapter. Path/auth are configurable for the beta endpoint.
  ica: {
    endpoint: str("ICA_ENDPOINT", "https://nextgen-beta.ica.ibm.com/ica"),
    apiKey: str("ICA_API_KEY"),
    model: str("ICA_MODEL", "gpt-4o"),
    chatPath: str("ICA_CHAT_PATH", "/v1/chat/completions"),
    // Override if the beta uses a non-Bearer scheme (e.g. ICA_AUTH_HEADER=apikey).
    authHeader: str("ICA_AUTH_HEADER", "authorization"),
    authScheme: str("ICA_AUTH_SCHEME", "Bearer"),
  },

  // watsonx.ai: IAM-authenticated text/chat + embeddings. apiKey is exchanged for
  // a short-lived bearer token (cached) before each call.
  watsonx: {
    apiKey: str("WATSONX_API_KEY"),
    url: str("WATSONX_URL", "https://us-south.ml.cloud.ibm.com"),
    iamUrl: str("WATSONX_IAM_URL", "https://iam.cloud.ibm.com"),
    projectId: str("WATSONX_PROJECT_ID"),
    model: str("WATSONX_MODEL", "ibm/granite-3-8b-instruct"),
    embedModel: str("WATSONX_EMBED_MODEL", "ibm/slate-30m-english-rtrvr"),
    version: str("WATSONX_VERSION", "2023-05-29"),
  },

  maxFileBytes: int("MAX_FILE_MB", 50) * 1024 * 1024,
  maxZipEntries: int("MAX_ZIP_ENTRIES", 500),
} as const;
