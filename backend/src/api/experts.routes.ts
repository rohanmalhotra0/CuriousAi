import { Router } from "express";
import type { ExpertsResponse } from "@curiousai/shared";
import { findExperts, requestIntro } from "../services/expert.service.js";

export const expertsRouter = Router();

// GET /api/experts?question=…&limit=… — ranked experts for a query/topic.
// Mirrors the routing done inline in chat, but standalone so the UI can ask
// "who knows about X?" without sending a chat message.
expertsRouter.get("/", async (req, res, next) => {
  try {
    const question = String(req.query.question ?? "").trim();
    const limit = Math.min(Math.max(Number(req.query.limit) || 3, 1), 10);
    const experts = await findExperts(req.userId, question, limit);
    const body: ExpertsResponse = { experts };
    res.json(body);
  } catch (e) {
    next(e);
  }
});

// POST /api/experts/:userId/intro — request-intro placeholder; records the ask.
expertsRouter.post("/:userId/intro", async (req, res, next) => {
  try {
    const result = await requestIntro(
      req.userId,
      req.params.userId,
      typeof req.body?.question === "string" ? req.body.question : undefined
    );
    res.status(201).json(result);
  } catch (e) {
    next(e);
  }
});
