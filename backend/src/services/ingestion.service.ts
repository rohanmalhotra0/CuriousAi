// Orchestrates the per-document pipeline:
//   store raw file -> extract -> chunk -> embed -> persist chunks -> mark indexed
// Status transitions are pushed to the SSE bus. A failure on one document marks
// it `failed` with an error message and never crashes the worker.
import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { randomUUID } from "node:crypto";
import type { DocumentStatus, FileStatusEvent } from "@curiousai/shared";
import { config } from "../config.js";
import { query, toVector } from "../db/pool.js";
import { logger } from "../lib/logger.js";
import { EventBus } from "../lib/sse.js";
import { extract, resolveMime } from "./extraction.service.js";
import { chunkText, embedChunks } from "./embedding.service.js";

export const fileEvents = new EventBus<FileStatusEvent>();

export interface IncomingFile {
  filename: string;
  mime: string;
  buffer: Buffer;
}

async function setStatus(
  docId: string,
  status: DocumentStatus,
  chunkCount = 0,
  error: string | null = null
) {
  await query("UPDATE documents SET status=$1, error=$2 WHERE id=$3", [status, error, docId]);
  fileEvents.emit({ documentId: docId, status, chunkCount, error });
}

/** Persist the upload row immediately so the UI can show it as `uploaded`. */
export async function registerUpload(userId: string, file: IncomingFile) {
  const mime = resolveMime(file.filename, file.mime);
  const id = randomUUID();
  const dir = join(config.storageDir, userId);
  await mkdir(dir, { recursive: true });
  const storagePath = join(dir, `${id}-${sanitize(file.filename)}`);
  await writeFile(storagePath, file.buffer);

  await query(
    `INSERT INTO documents (id, user_id, filename, mime_type, size_bytes, storage_path, status)
     VALUES ($1,$2,$3,$4,$5,$6,'uploaded')`,
    [id, userId, file.filename, mime, file.buffer.length, storagePath]
  );
  return { id, mime };
}

/** Run extraction -> embedding -> indexing for one already-registered document. */
export async function processDocument(userId: string, docId: string, file: IncomingFile) {
  try {
    await setStatus(docId, "extracting");
    const mime = resolveMime(file.filename, file.mime);
    const docs = await extract(file.filename, mime, file.buffer);
    const fullText = docs.map((d) => d.text).join("\n\n");

    const chunks = chunkText(fullText);
    if (chunks.length === 0) {
      await setStatus(docId, "indexed", 0);
      return;
    }

    await setStatus(docId, "embedding", chunks.length);
    const vectors = await embedChunks(chunks.map((c) => c.text));

    for (let i = 0; i < chunks.length; i++) {
      await query(
        `INSERT INTO chunks (document_id, user_id, ordinal, text, token_count, embedding)
         VALUES ($1,$2,$3,$4,$5,$6::vector)`,
        [docId, userId, chunks[i].ordinal, chunks[i].text, chunks[i].tokenCount, toVector(vectors[i])]
      );
    }
    await setStatus(docId, "indexed", chunks.length);
    logger.info(`indexed document ${docId} (${chunks.length} chunks)`);
  } catch (e: any) {
    logger.error(`ingestion failed for ${docId}`, e?.message);
    await setStatus(docId, "failed", 0, e?.message ?? "Unknown error");
  }
}

function sanitize(name: string): string {
  return name.replace(/[^a-zA-Z0-9._-]/g, "_").slice(0, 120);
}
