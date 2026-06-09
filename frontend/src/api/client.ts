// Typed client over the shared API contract. All calls hit same-origin `/api`
// (Vite proxies to the backend in dev). SSE endpoints are handled two ways:
//   - GET streams (file events) use the native EventSource.
//   - POST streams (chat) use fetch + a manual SSE parser, since EventSource
//     can't POST a body.
import type {
  ChatMessageDTO,
  ChatResultEvent,
  DocumentDTO,
  FileStatusEvent,
  UploadResponse,
} from "@curiousai/shared";

async function json<T>(res: Response): Promise<T> {
  if (!res.ok) {
    const body = (await res.json().catch(() => ({}))) as { error?: string };
    throw new Error(body.error ?? `Request failed (${res.status})`);
  }
  return res.json() as Promise<T>;
}

export interface ChatSummary {
  id: string;
  title: string;
  created_at: string;
}

export const api = {
  // --- Files -------------------------------------------------------------
  async listFiles(): Promise<DocumentDTO[]> {
    const { documents } = await json<{ documents: DocumentDTO[] }>(
      await fetch("/api/files")
    );
    return documents;
  },

  async uploadFiles(files: File[]): Promise<DocumentDTO[]> {
    const form = new FormData();
    for (const f of files) form.append("files", f);
    const { documents } = await json<UploadResponse>(
      await fetch("/api/files", { method: "POST", body: form })
    );
    return documents;
  },

  async deleteFile(id: string): Promise<void> {
    await json<{ ok: true }>(await fetch(`/api/files/${id}`, { method: "DELETE" }));
  },

  /** Subscribe to live ingestion status. Returns an unsubscribe function. */
  onFileStatus(handler: (evt: FileStatusEvent) => void): () => void {
    const es = new EventSource("/api/files/events");
    es.addEventListener("status", (e) => {
      handler(JSON.parse((e as MessageEvent).data) as FileStatusEvent);
    });
    return () => es.close();
  },

  // --- Chat --------------------------------------------------------------
  async listChats(): Promise<ChatSummary[]> {
    const { chats } = await json<{ chats: ChatSummary[] }>(await fetch("/api/chats"));
    return chats;
  },

  async getChat(id: string): Promise<ChatMessageDTO[]> {
    const { messages } = await json<{ messages: ChatMessageDTO[] }>(
      await fetch(`/api/chats/${id}`)
    );
    return messages;
  },

  /**
   * Ask a question against the knowledge base. Streams assistant tokens via
   * `onToken`, then resolves with the final result (confidence, citations,
   * expert routing) plus the chat id the turn was persisted under.
   */
  async sendMessage(
    chatId: string,
    question: string,
    onToken: (token: string) => void
  ): Promise<{ chatId: string; result: ChatResultEvent }> {
    const res = await fetch(`/api/chat/${chatId}/message`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ question }),
    });
    if (!res.ok || !res.body) {
      const body = (await res.json().catch(() => ({}))) as { error?: string };
      throw new Error(body.error ?? `Chat failed (${res.status})`);
    }

    let resolvedChatId = chatId;
    let result: ChatResultEvent | null = null;

    await parseSse(res.body, (event, data) => {
      if (event === "meta") resolvedChatId = (data as { chatId: string }).chatId;
      else if (event === "token") onToken((data as { token: string }).token);
      else if (event === "result") result = data as ChatResultEvent;
    });

    if (!result) throw new Error("Stream ended without a result");
    return { chatId: resolvedChatId, result };
  },
};

/** Parse a `text/event-stream` body, invoking `onEvent(eventName, parsedData)`. */
async function parseSse(
  body: ReadableStream<Uint8Array>,
  onEvent: (event: string, data: unknown) => void
): Promise<void> {
  const reader = body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  for (;;) {
    const { value, done } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });

    let sep: number;
    // Events are separated by a blank line.
    while ((sep = buffer.indexOf("\n\n")) !== -1) {
      const raw = buffer.slice(0, sep);
      buffer = buffer.slice(sep + 2);

      let event = "message";
      const dataLines: string[] = [];
      for (const line of raw.split("\n")) {
        if (line.startsWith("event:")) event = line.slice(6).trim();
        else if (line.startsWith("data:")) dataLines.push(line.slice(5).trim());
      }
      if (dataLines.length === 0) continue;
      try {
        onEvent(event, JSON.parse(dataLines.join("\n")));
      } catch {
        /* ignore malformed frame */
      }
    }
  }
}
