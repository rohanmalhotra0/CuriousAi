// Shared HTTP plumbing for the real provider adapters. Uses the global `fetch`
// (Node >= 18) so no SDK dependency is added — every adapter is just a typed
// wrapper around an HTTP call, keeping the provider layer swappable and small.

/** Split a streaming response body into individual lines (handles CRLF + chunk splits). */
async function* sseLines(body: AsyncIterable<Uint8Array>): AsyncIterable<string> {
  const decoder = new TextDecoder();
  let buf = "";
  for await (const chunk of body) {
    buf += decoder.decode(chunk, { stream: true });
    let nl: number;
    while ((nl = buf.indexOf("\n")) >= 0) {
      yield buf.slice(0, nl).replace(/\r$/, "");
      buf = buf.slice(nl + 1);
    }
  }
  buf += decoder.decode();
  if (buf.trim()) yield buf;
}

/** Yield the `data:` payloads of an SSE stream, stopping at the `[DONE]` sentinel. */
export async function* sseData(body: AsyncIterable<Uint8Array>): AsyncIterable<string> {
  for await (const line of sseLines(body)) {
    if (!line.startsWith("data:")) continue;
    const data = line.slice(5).trim();
    if (data === "[DONE]") return;
    yield data;
  }
}

/**
 * Stream content deltas from an OpenAI-style `/chat/completions` endpoint.
 * Shared by the OpenAI, ICA, and watsonx adapters — they speak the same
 * chat-completions-over-SSE protocol and differ only in URL, auth, and body keys,
 * which the caller supplies in `body`.
 */
export async function* streamChatDeltas(
  url: string,
  headers: Record<string, string>,
  body: Record<string, unknown>
): AsyncIterable<string> {
  const res = await fetch(url, {
    method: "POST",
    headers: { "content-type": "application/json", ...headers },
    body: JSON.stringify({ ...body, stream: true }),
  });
  if (!res.ok || !res.body) {
    throw new Error(`chat request to ${url} failed: ${res.status} ${await safeText(res)}`);
  }
  for await (const data of sseData(res.body as AsyncIterable<Uint8Array>)) {
    let json: any;
    try {
      json = JSON.parse(data);
    } catch {
      continue; // keep-alive / partial frame
    }
    // delta.content (chat), text (completions) — covers OpenAI/ICA/watsonx shapes.
    const delta = json?.choices?.[0]?.delta?.content ?? json?.choices?.[0]?.text;
    if (typeof delta === "string" && delta.length) yield delta;
  }
}

export async function postJson<T = any>(
  url: string,
  headers: Record<string, string>,
  body: unknown
): Promise<T> {
  const res = await fetch(url, {
    method: "POST",
    headers: { "content-type": "application/json", ...headers },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    throw new Error(`request to ${url} failed: ${res.status} ${await safeText(res)}`);
  }
  return (await res.json()) as T;
}

async function safeText(res: Response): Promise<string> {
  try {
    return (await res.text()).slice(0, 500);
  } catch {
    return "";
  }
}

/** L2-normalize so cosine == dot, matching the deterministic embedding's contract. */
export function l2normalize(vec: number[]): number[] {
  const norm = Math.sqrt(vec.reduce((s, x) => s + x * x, 0)) || 1;
  return vec.map((x) => x / norm);
}
