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

/** Response for GET /experts — ranked experts for a question/topic. */
export interface ExpertsResponse {
  experts: ExpertCardDTO[];
}

/** Response for POST /experts/:userId/intro — request-intro placeholder. */
export interface IntroRequestResponse {
  id: string;
  expertId: string;
  status: "pending" | "sent" | "declined";
  createdAt: string;
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

// --- Mind map (topics) ---
export interface GraphNodeDTO {
  id: string;
  label: string;
  summary: string | null;
  size: number;
}
export interface GraphEdgeDTO {
  source: string;
  target: string;
  weight: number;
}
export interface GraphDTO {
  nodes: GraphNodeDTO[];
  edges: GraphEdgeDTO[];
}

// --- Skills ---
export type SkillLevel = "beginner" | "intermediate" | "advanced";
export interface SkillDTO {
  id: string;
  name: string;
  summary: string | null;
  level: SkillLevel;
  evidenceCount: number;
  source: "auto" | "user";
  editedByUser: boolean;
}

// --- Settings ---
export interface SettingsDTO {
  memoryEnabled: boolean;
}

// --- Report ("here are the skills + mind map I built for you") ---
export interface ReportDTO {
  documentCount: number;
  chunkCount: number;
  topicCount: number;
  skillCount: number;
  topTopics: { label: string; size: number }[];
  topSkills: { name: string; level: SkillLevel }[];
  message: string;
}

export const CONFIDENCE_THRESHOLD = 65;

export const SUPPORTED_MIME: Record<string, string> = {
  "application/pdf": "PDF",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document": "DOCX",
  "text/plain": "TXT",
  "message/rfc822": "EML",
  "application/zip": "ZIP",
};
