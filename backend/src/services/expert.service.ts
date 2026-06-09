// Expert routing for low-confidence questions. Finds other users whose skills
// match the question and ranks them by depth + recency + topic match.
// Phase-1 scope: ranking works against whatever skills exist; when none are
// present it falls back to most-recently-active peers so routing still demos.
import type { ExpertCardDTO, IntroRequestResponse } from "@curiousai/shared";
import { query } from "../db/pool.js";
import { badRequest, notFound } from "../lib/errors.js";

export async function findExperts(
  askingUserId: string,
  question: string,
  limit = 3
): Promise<ExpertCardDTO[]> {
  const qTerms = (question.toLowerCase().match(/[a-z0-9]+/g) ?? []).filter((w) => w.length > 2);

  const { rows } = await query(
    `SELECT u.id, u.display_name, u.role, u.last_active_at,
            COALESCE(array_agg(s.name) FILTER (WHERE s.name IS NOT NULL), '{}') AS skills,
            COALESCE(sum(s.evidence_count), 0)::int AS depth
       FROM users u
       LEFT JOIN skills s ON s.user_id = u.id
      WHERE u.id <> $1
      GROUP BY u.id
      ORDER BY u.last_active_at DESC`,
    [askingUserId]
  );

  const now = Date.now();
  const ranked = rows.map((r: any) => {
    const skills: string[] = r.skills ?? [];
    const topicMatch = skills.length
      ? skills.filter((s) => qTerms.some((t) => s.toLowerCase().includes(t))).length / skills.length
      : 0;
    const recencyDays = (now - new Date(r.last_active_at).getTime()) / 86_400_000;
    const recency = 1 / (1 + recencyDays); // newer -> closer to 1
    const depth = Math.min(1, r.depth / 10);
    const matchScore = 0.5 * topicMatch + 0.3 * depth + 0.2 * recency;
    return {
      userId: r.id,
      name: r.display_name,
      role: r.role,
      skills,
      lastActiveAt: r.last_active_at,
      matchScore: Number(matchScore.toFixed(3)),
    };
  });

  ranked.sort((a, b) => b.matchScore - a.matchScore);
  return ranked.slice(0, limit);
}

// Placeholder "request intro": durably record the ask. No email is sent yet —
// a real connector reads intro_requests later. Idempotent-ish: callers can spam
// the button, but we just append; dedup is a future concern.
export async function requestIntro(
  requesterId: string,
  expertId: string,
  question?: string
): Promise<IntroRequestResponse> {
  if (expertId === requesterId) throw badRequest("Cannot request an intro to yourself");

  const expert = await query("SELECT id FROM users WHERE id = $1", [expertId]);
  if (expert.rows.length === 0) throw notFound("Expert not found");

  const { rows } = await query(
    `INSERT INTO intro_requests (requester_id, expert_id, question)
     VALUES ($1, $2, $3)
     RETURNING id, expert_id, status, created_at`,
    [requesterId, expertId, question?.trim() || null]
  );
  const r = rows[0];
  return { id: r.id, expertId: r.expert_id, status: r.status, createdAt: r.created_at };
}
