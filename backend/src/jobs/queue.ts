// Tiny in-process FIFO worker so uploads return immediately while ingestion runs
// in the background. Concurrency is bounded to keep memory predictable for large
// bulk imports. A real deployment would swap this for BullMQ/SQS behind the same
// enqueue() call.
import { logger } from "../lib/logger.js";

type Job = () => Promise<void>;

const queue: Job[] = [];
let active = 0;
const MAX_CONCURRENCY = 2;

export function enqueue(job: Job) {
  queue.push(job);
  pump();
}

function pump() {
  while (active < MAX_CONCURRENCY && queue.length) {
    const job = queue.shift()!;
    active++;
    job()
      .catch((e) => logger.error("job failed", e?.message))
      .finally(() => {
        active--;
        pump();
      });
  }
}
