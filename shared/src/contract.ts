// Shared API contract — imported by both backend and frontend so request/response
// shapes stay in sync. No runtime logic here, just types and enums.

export type DocumentStatus =
  | "uploaded"
  | "extracting"
  | "embedding"
  | "indexed"
  | "failed";

export interface DocumentDTO {
  id: string;
  filename: string;
  mimeType: string;
  sizeBytes: number;
  status: DocumentStatus;
  error: string | null;
  chunkCount: number;
  createdAt: string;
}

export interface UploadResponse {
  documents: DocumentDTO[];
}

/** SSE payload pushed on /files/events as a document moves through the pipeline. */
export interface FileStatusEvent {
  documentId: string;
  status: DocumentStatus;
  chunkCount: number;
  error?: string | null;
}

export interface Citation {
  chunkId: string;
  documentId: string;
  filename: string;
  snippet: string;
  score: number;
}

export interface ExpertCardDTO {
  userId: string;
  name: string;
  role: string;
  skills: string[];
  lastActiveAt: string;
  matchScore: number;
}

export interface ChatMessageDTO {
  id: string;
  role: "user" | "assistant";
  content: string;
  confidence: number | null;
  citations: Citation[];
  createdAt: string;
}

/** Final SSE event after the assistant tokens have streamed. */
export interface ChatResultEvent {
  confidence: number;
  citations: Citation[];
  routed: boolean;
  experts: ExpertCardDTO[];
}

export const CONFIDENCE_THRESHOLD = 65;

export const SUPPORTED_MIME: Record<string, string> = {
  "application/pdf": "PDF",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document": "DOCX",
  "text/plain": "TXT",
  "message/rfc822": "EML",
  "application/zip": "ZIP",
};
