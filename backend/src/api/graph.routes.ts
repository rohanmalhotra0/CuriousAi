import { Router } from "express";
import { getGraph, rebuildTopics } from "../services/mindmap.service.js";

export const graphRouter = Router();

// GET /api/graph — topic mind map for Cytoscape.
graphRouter.get("/", async (req, res, next) => {
  try {
    res.json(await getGraph(req.userId));
  } catch (e) {
    next(e);
  }
});

// POST /api/graph/rebuild — recompute topic clusters from current chunks.
graphRouter.post("/rebuild", async (req, res, next) => {
  try {
    const count = await rebuildTopics(req.userId);
    res.json({ topics: count });
  } catch (e) {
    next(e);
  }
});
