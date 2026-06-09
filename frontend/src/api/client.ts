import type {
  ChatResultEvent,
  DocumentDTO,
  ExpertsResponse,
  FileStatusEvent,
  GraphDTO,
  IntroRequestResponse,
  ReportDTO,
  SettingsDTO,
  SkillDTO,
  SkillLevel,
  UploadResponse,
} from "@curiousai/shared";

const BASE = import.meta.env.VITE_API_BASE ?? "http://localhost:4000";

async function json<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE}${path}`, init);
  if (!res.ok) throw new Error((await res.json().catch(() => ({})))?.error ?? res.statusText);
  return res.json();
}

export const api = {
  listFiles: () => json<{ documents: DocumentDTO[] }>("/api/files"),

  upload(files: File[]): Promise<UploadResponse> {
    const fd = new FormData();
    files.forEach((f) => fd.append("files", f));
    return json<UploadResponse>("/api/files", { method: "POST", body: fd });
  },

  deleteFile: (id: string) => json(`/api/files/${id}`, { method: "DELETE" }),

  /** Subscribe to ingestion status events. Returns an unsubscribe fn. */
  onFileStatus(cb: (e: FileStatusEvent) => void): () => void {
    const es = new EventSource(`${BASE}/api/files/events`);
    es.addEventListener("status", (ev) => cb(JSON.parse((ev as MessageEvent).data)));
    return () => es.close();
  },

  listChats: () => json<{ chats: { id: string; title: string }[] }>("/api/chats"),

  /** Ranked experts for a question/topic. */
  listExperts: (question: string, limit = 3) =>
    json<ExpertsResponse>(
      `/api/experts?question=${encodeURIComponent(question)}&limit=${limit}`
    ),

  /** Request-intro placeholder — records the ask, no email sent yet. */
  requestIntro: (userId: string, question?: string) =>
    json<IntroRequestResponse>(`/api/experts/${userId}/intro`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ question }),
    }),

  /**
   * Stream a chat answer. Calls onToken as tokens arrive and onResult with the
   * final confidence + citations (or expert routing). Uses fetch streaming so we
   * can POST the question body (EventSource is GET-only).
   */
  async sendMessage(
    chatId: string,
    question: string,
    onToken: (t: string) => void,
    onResult: (r: ChatResultEvent & { chatId?: string }) => void
  ): Promise<void> {
    const res = await fetch(`${BASE}/api/chat/${chatId}/message`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ question }),
    });
    const reader = res.body!.getReader();
    const decoder = new TextDecoder();
    let buf = "";
    let chatIdSeen: string | undefined;

    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      buf += decoder.decode(value, { stream: true });
      const frames = buf.split("\n\n");
      buf = frames.pop() ?? "";
      for (const frame of frames) {
        const ev = /event: (.*)/.exec(frame)?.[1];
        const data = /data: (.*)/.exec(frame)?.[1];
        if (!ev || !data) continue;
        const payload = JSON.parse(data);
        if (ev === "meta") chatIdSeen = payload.chatId;
        else if (ev === "token") onToken(payload.token);
        else if (ev === "result") onResult({ ...payload, chatId: chatIdSeen });
      }
    }
  },

  // --- Mind map ---
  getGraph: () => json<GraphDTO>("/api/graph"),
  rebuildGraph: () => json<{ topics: number }>("/api/graph/rebuild", { method: "POST" }),

  // --- Skills ---
  listSkills: () => json<{ skills: SkillDTO[] }>("/api/skills"),
  rebuildSkills: () => json<{ added: number }>("/api/skills/rebuild", { method: "POST" }),
  createSkill: (name: string, summary: string, level: SkillLevel) =>
    json<SkillDTO>("/api/skills", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, summary, level }),
    }),
  updateSkill: (id: string, patch: Partial<{ name: string; summary: string; level: SkillLevel }>) =>
    json<SkillDTO>(`/api/skills/${id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(patch),
    }),
  deleteSkill: (id: string) => json(`/api/skills/${id}`, { method: "DELETE" }),

  // --- Settings + report ---
  getSettings: () => json<SettingsDTO>("/api/settings"),
  updateSettings: (memoryEnabled: boolean) =>
    json<SettingsDTO>("/api/settings", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ memoryEnabled }),
    }),
  deleteAllData: () => json<{ ok: boolean }>("/api/settings/data", { method: "DELETE" }),
  getReport: () => json<ReportDTO>("/api/settings/report", { method: "POST" }),
};
