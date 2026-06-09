import { Router } from "express";
import { randomUUID } from "node:crypto";
import type { ChatResultEvent } from "@curiousai/shared";
import { query } from "../db/pool.js";
import { openSse } from "../lib/sse.js";
import { llmProvider } from "../providers/index.js";
import { retrieve, toCitations } from "../services/rag.service.js";
import { scoreConfidence, shouldRoute } from "../services/confidence.service.js";
import { findExperts } from "../services/expert.service.js";
import { recall, ingestTurn } from "../services/memory.service.js";

export const chatRouter = Router();

// GET /api/chats — history list.
chatRouter.get("/", async (req, res, next) => {
  try {
    const { rows } = await query(
      "SELECT id, title, created_at FROM chats WHERE user_id=$1 ORDER BY created_at DESC",
      [req.userId]
    );
    res.json({ chats: rows });
  } catch (e) {
    next(e);
  }
});

// GET /api/chats/:id — messages + citations for one conversation.
chatRouter.get("/:id", async (req, res, next) => {
  try {
    const { rows } = await query(
      `SELECT m.id, m.role, m.content, m.confidence, m.created_at,
              COALESCE(json_agg(json_build_object(
                'chunkId', mc.chunk_id, 'snippet', mc.snippet, 'score', mc.score,
                'filename', d.filename, 'documentId', d.id
              ) ORDER BY mc.score DESC) FILTER (WHERE mc.chunk_id IS NOT NULL), '[]') AS citations
         FROM messages m
         LEFT JOIN message_citations mc ON mc.message_id = m.id
         LEFT JOIN chunks ch ON ch.id = mc.chunk_id
         LEFT JOIN documents d ON d.id = ch.document_id
        WHERE m.chat_id = $1
        GROUP BY m.id
        ORDER BY m.created_at ASC`,
      [req.params.id]
    );
    res.json({ messages: rows });
  } catch (e) {
    next(e);
  }
});

// POST /api/chat/:chatId/message — SSE: stream tokens, then emit a result event
// with confidence + citations, or expert routing when confidence < threshold.
chatRouter.post("/:chatId/message", async (req, res, next) => {
  try {
    const question = String(req.body?.question ?? "").trim();
    if (!question) return res.status(400).json({ error: "question is required" });

    let chatId = req.params.chatId;
    if (chatId === "new") {
      chatId = randomUUID();
      await query("INSERT INTO chats (id, user_id, title) VALUES ($1,$2,$3)", [
        chatId, req.userId, question.slice(0, 60),
      ]);
    }
    await query("INSERT INTO messages (chat_id, role, content) VALUES ($1,'user',$2)", [
      chatId, question,
    ]);

    // Respect the user's memory toggle: when off, neither recall nor write.
    const memoryEnabled = await isMemoryEnabled(req.userId, req.body?.memoryEnabled);

    const hits = await retrieve(req.userId, question);
    const memories = memoryEnabled ? (await recall(req.userId, question)).map((m) => m.content) : [];
    // Use the blended re-rank score (vector + keyword overlap), which the
    // confidence calibration is tuned against.
    const confidence = scoreConfidence(hits.map((h) => ({ score: h.score })));
    const citations = toCitations(hits);

    const sse = openSse(res);
    sse.send("meta", { chatId });

    let answer = "";
    const context = hits.map((h, i) => ({ index: i + 1, text: h.text, filename: h.filename }));
    for await (const token of llmProvider.stream(question, context, memories)) {
      answer += token;
      sse.send("token", { token });
    }

    const routed = shouldRoute(confidence);
    const experts = routed ? await findExperts(req.userId, question) : [];

    // Persist the assistant turn + citations.
    const { rows } = await query(
      "INSERT INTO messages (chat_id, role, content, confidence) VALUES ($1,'assistant',$2,$3) RETURNING id",
      [chatId, answer, confidence]
    );
    const msgId = rows[0].id;
    for (const c of citations) {
      await query(
        "INSERT INTO message_citations (message_id, chunk_id, score, snippet) VALUES ($1,$2,$3,$4)",
        [msgId, c.chunkId, c.score, c.snippet]
      );
    }

    // Learn durable facts from the user's turn (recursive, drift-resistant).
    if (memoryEnabled) await ingestTurn(req.userId, question);

    const result: ChatResultEvent = { confidence, citations, routed, experts };
    sse.send("result", result);
    sse.close();
  } catch (e) {
    next(e);
  }
});

async function isMemoryEnabled(userId: string, override?: unknown): Promise<boolean> {
  if (typeof override === "boolean") return override;
  const { rows } = await query("SELECT memory_enabled FROM users WHERE id = $1", [userId]);
  return rows[0]?.memory_enabled ?? true;
}
