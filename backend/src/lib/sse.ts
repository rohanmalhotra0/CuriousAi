import type { Response } from "express";

/** Minimal Server-Sent-Events helper used by file status + chat streaming. */
export function openSse(res: Response) {
  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache, no-transform");
  res.setHeader("Connection", "keep-alive");
  res.flushHeaders?.();

  return {
    send(event: string, data: unknown) {
      res.write(`event: ${event}\n`);
      res.write(`data: ${JSON.stringify(data)}\n\n`);
    },
    close() {
      res.end();
    },
  };
}

/** Tiny typed pub/sub so the ingestion worker can push status to SSE clients. */
type Listener<T> = (payload: T) => void;
export class EventBus<T> {
  private listeners = new Set<Listener<T>>();
  on(fn: Listener<T>) {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  }
  emit(payload: T) {
    for (const fn of this.listeners) fn(payload);
  }
}
