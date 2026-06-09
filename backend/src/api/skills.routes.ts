import { Router } from "express";
import type { SkillLevel } from "@curiousai/shared";
import { badRequest } from "../lib/errors.js";
import {
  listSkills,
  createSkill,
  updateSkill,
  deleteSkill,
  rebuildSkills,
} from "../services/skill.service.js";

export const skillsRouter = Router();

const LEVELS: SkillLevel[] = ["beginner", "intermediate", "advanced"];

// GET /api/skills — the user's skill profile.
skillsRouter.get("/", async (req, res, next) => {
  try {
    res.json({ skills: await listSkills(req.userId) });
  } catch (e) {
    next(e);
  }
});

// POST /api/skills — user adds a skill manually.
skillsRouter.post("/", async (req, res, next) => {
  try {
    const name = String(req.body?.name ?? "").trim();
    if (!name) throw badRequest("name is required");
    const level = (req.body?.level as SkillLevel) ?? "beginner";
    if (!LEVELS.includes(level)) throw badRequest("invalid level");
    res.json(await createSkill(req.userId, name, String(req.body?.summary ?? ""), level));
  } catch (e) {
    next(e);
  }
});

// PUT /api/skills/:id — edit a generated or user skill (marks edited_by_user).
skillsRouter.put("/:id", async (req, res, next) => {
  try {
    const level = req.body?.level as SkillLevel | undefined;
    if (level && !LEVELS.includes(level)) throw badRequest("invalid level");
    const updated = await updateSkill(req.userId, req.params.id, {
      name: req.body?.name,
      summary: req.body?.summary,
      level,
    });
    if (!updated) throw badRequest("skill not found");
    res.json(updated);
  } catch (e) {
    next(e);
  }
});

// DELETE /api/skills/:id
skillsRouter.delete("/:id", async (req, res, next) => {
  try {
    await deleteSkill(req.userId, req.params.id);
    res.json({ ok: true });
  } catch (e) {
    next(e);
  }
});

// POST /api/skills/rebuild — re-extract auto skills (preserves user-edited ones).
skillsRouter.post("/rebuild", async (req, res, next) => {
  try {
    res.json({ added: await rebuildSkills(req.userId) });
  } catch (e) {
    next(e);
  }
});
