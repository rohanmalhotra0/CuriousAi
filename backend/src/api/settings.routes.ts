import { Router } from "express";
import type { ReportDTO, SettingsDTO } from "@curiousai/shared";
import { query } from "../db/pool.js";
import { deleteAllData, getSettings, updateSettings } from "../services/settings.service.js";

export const settingsRouter = Router();

// GET /api/settings — privacy / memory preferences.
settingsRouter.get("/", async (req, res, next) => {
  try {
    res.json(await getSettings(req.userId));
  } catch (e) {
    next(e);
  }
});

// PUT /api/settings — update memory toggle (other prefs can be added here).
settingsRouter.put("/", async (req, res, next) => {
  try {
    const patch: Partial<SettingsDTO> = {};
    if (typeof req.body?.memoryEnabled === "boolean") patch.memoryEnabled = req.body.memoryEnabled;
    res.json(await updateSettings(req.userId, patch));
  } catch (e) {
    next(e);
  }
});

// DELETE /api/settings/data — full data deletion for this user (GDPR-style).
// Transactional removal of documents/chunks, memories, topics, skills, chats, and
// intro requests, plus the raw files on disk. The account row stays (reset to
// defaults). Returns a summary of what was deleted.
settingsRouter.delete("/data", async (req, res, next) => {
  try {
    const deleted = await deleteAllData(req.userId);
    res.json({ ok: true, deleted });
  } catch (e) {
    next(e);
  }
});

// POST /api/report — "Here are the skills and mind map I built for you."
settingsRouter.post("/report", async (req, res, next) => {
  try {
    const dto = await buildReport(req.userId);
    res.json(dto);
  } catch (e) {
    next(e);
  }
});

async function buildReport(userId: string): Promise<ReportDTO> {
  const counts = await query(
    `SELECT
       (SELECT count(*) FROM documents WHERE user_id=$1)::int AS docs,
       (SELECT count(*) FROM chunks    WHERE user_id=$1)::int AS chunks,
       (SELECT count(*) FROM topics    WHERE user_id=$1)::int AS topics,
       (SELECT count(*) FROM skills    WHERE user_id=$1)::int AS skills`,
    [userId]
  );
  const c = counts.rows[0];
  const topTopics = (
    await query("SELECT label, size FROM topics WHERE user_id=$1 ORDER BY size DESC LIMIT 5", [userId])
  ).rows.map((r: any) => ({ label: r.label, size: r.size }));
  const topSkills = (
    await query(
      "SELECT name, level FROM skills WHERE user_id=$1 ORDER BY evidence_count DESC LIMIT 5",
      [userId]
    )
  ).rows.map((r: any) => ({ name: r.name, level: r.level }));

  const message =
    `Here are the skills and mind map I built for you. I indexed ${c.docs} document(s) into ` +
    `${c.chunks} passages, organized them into ${c.topics} topic(s), and extracted ` +
    `${c.skills} skill(s).`;

  return {
    documentCount: c.docs,
    chunkCount: c.chunks,
    topicCount: c.topics,
    skillCount: c.skills,
    topTopics,
    topSkills,
    message,
  };
}
