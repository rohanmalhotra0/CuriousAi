import { Router } from "express";
import multer from "multer";
import type { DocumentDTO } from "@curiousai/shared";
import { config } from "../config.js";
import { query } from "../db/pool.js";
import { tooLarge } from "../lib/errors.js";
import { openSse } from "../lib/sse.js";
import { enqueue } from "../jobs/queue.js";
import { fileEvents, processDocument, registerUpload } from "../services/ingestion.service.js";

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: config.maxFileBytes },
});

export const filesRouter = Router();

// POST /api/files — bulk multipart upload. Registers each doc, returns rows as
// `uploaded`, and kicks ingestion onto the background queue.
filesRouter.post("/", upload.array("files"), async (req, res, next) => {
  try {
    const files = (req.files as Express.Multer.File[]) ?? [];
    if (files.length === 0) return res.status(400).json({ error: "No files provided" });

    const out: DocumentDTO[] = [];
    for (const f of files) {
      if (f.size > config.maxFileBytes) throw tooLarge(`${f.originalname} is too large`);
      const incoming = { filename: f.originalname, mime: f.mimetype, buffer: f.buffer };
      const { id, mime } = await registerUpload(req.userId, incoming);
      enqueue(() => processDocument(req.userId, id, incoming));
      out.push({
        id, filename: f.originalname, mimeType: mime, sizeBytes: f.size,
        status: "uploaded", error: null, chunkCount: 0, createdAt: new Date().toISOString(),
      });
    }
    res.json({ documents: out });
  } catch (e) {
    next(e);
  }
});

// GET /api/files — list this user's documents with live chunk counts.
filesRouter.get("/", async (req, res, next) => {
  try {
    const { rows } = await query(
      `SELECT d.id, d.filename, d.mime_type, d.size_bytes, d.status, d.error,
              d.created_at, COUNT(c.id)::int AS chunk_count
         FROM documents d
         LEFT JOIN chunks c ON c.document_id = d.id
        WHERE d.user_id = $1
        GROUP BY d.id
        ORDER BY d.created_at DESC`,
      [req.userId]
    );
    res.json({
      documents: rows.map((r: any): DocumentDTO => ({
        id: r.id, filename: r.filename, mimeType: r.mime_type,
        sizeBytes: Number(r.size_bytes), status: r.status, error: r.error,
        chunkCount: r.chunk_count, createdAt: r.created_at,
      })),
    });
  } catch (e) {
    next(e);
  }
});

// GET /api/files/events — SSE stream of pipeline status transitions.
filesRouter.get("/events", (req, res) => {
  const sse = openSse(res);
  sse.send("ready", { ok: true });
  const off = fileEvents.on((evt) => sse.send("status", evt));
  req.on("close", () => {
    off();
    sse.close();
  });
});

// DELETE /api/files/:id — remove a document (chunks cascade).
filesRouter.delete("/:id", async (req, res, next) => {
  try {
    await query("DELETE FROM documents WHERE id=$1 AND user_id=$2", [req.params.id, req.userId]);
    res.json({ ok: true });
  } catch (e) {
    next(e);
  }
});
