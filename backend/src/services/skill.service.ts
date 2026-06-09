// Extracts a skill profile from the user's indexed content. Deterministic mode
// uses frequency-based keyphrase extraction; a real LLM provider would replace
// extractCandidates() with semantic skill detection. Auto skills are rebuilt each
// run, but anything the user created or edited is preserved.
import type { SkillDTO, SkillLevel } from "@curiousai/shared";
import { query } from "../db/pool.js";
import { phraseCounts, firstSentence, titleCase } from "../lib/text.js";

const MAX_SKILLS = 20;

function levelFor(evidence: number): SkillLevel {
  if (evidence >= 8) return "advanced";
  if (evidence >= 3) return "intermediate";
  return "beginner";
}

export async function rebuildSkills(userId: string): Promise<number> {
  const { rows } = await query(
    "SELECT text FROM chunks WHERE user_id=$1 AND embedding IS NOT NULL",
    [userId]
  );
  const texts: string[] = rows.map((r: any) => r.text);

  // Preserve user-authored / user-edited skills; only auto ones are recomputed.
  await query(
    "DELETE FROM skills WHERE user_id=$1 AND source='auto' AND edited_by_user=false",
    [userId]
  );
  if (texts.length === 0) return 0;

  const counts = phraseCounts(texts);
  // Favor multi-word phrases (more skill-like) and frequency.
  const candidates = [...counts.entries()]
    .filter(([p, c]) => c >= 2 && (p.includes(" ") || c >= 4))
    .sort((a, b) => b[1] - a[1] || b[0].length - a[0].length)
    .slice(0, MAX_SKILLS);

  const existing = new Set(
    (await query("SELECT lower(name) AS n FROM skills WHERE user_id=$1", [userId])).rows.map(
      (r: any) => r.n
    )
  );

  const inserted: { id: string; phrase: string }[] = [];
  for (const [phrase, evidence] of candidates) {
    if (existing.has(phrase.toLowerCase())) continue;
    const name = titleCase(phrase);
    const summary = firstSentence(texts.find((t) => t.toLowerCase().includes(phrase)) ?? name);
    const ins = await query(
      `INSERT INTO skills (user_id, name, summary, level, evidence_count, source)
       VALUES ($1,$2,$3,$4,$5,'auto') RETURNING id`,
      [userId, name, summary, levelFor(evidence), evidence]
    );
    inserted.push({ id: ins.rows[0].id, phrase });
  }

  // Skill edges: co-occurrence of two skill phrases in the same chunk.
  for (let i = 0; i < inserted.length; i++) {
    for (let j = i + 1; j < inserted.length; j++) {
      const co = texts.some(
        (t) =>
          t.toLowerCase().includes(inserted[i].phrase) &&
          t.toLowerCase().includes(inserted[j].phrase)
      );
      if (co) {
        await query(
          "INSERT INTO skill_edges (src_skill_id, dst_skill_id, relation) VALUES ($1,$2,'co-occurs') ON CONFLICT DO NOTHING",
          [inserted[i].id, inserted[j].id]
        );
      }
    }
  }
  return inserted.length;
}

export async function listSkills(userId: string): Promise<SkillDTO[]> {
  const { rows } = await query(
    `SELECT id, name, summary, level, evidence_count, source, edited_by_user
       FROM skills WHERE user_id=$1 ORDER BY evidence_count DESC, name ASC`,
    [userId]
  );
  return rows.map(toDTO);
}

export async function createSkill(userId: string, name: string, summary: string, level: SkillLevel) {
  const { rows } = await query(
    `INSERT INTO skills (user_id, name, summary, level, source, edited_by_user)
     VALUES ($1,$2,$3,$4,'user',true) RETURNING id, name, summary, level, evidence_count, source, edited_by_user`,
    [userId, name, summary, level]
  );
  return toDTO(rows[0]);
}

export async function updateSkill(
  userId: string,
  id: string,
  patch: Partial<{ name: string; summary: string; level: SkillLevel }>
) {
  const { rows } = await query(
    `UPDATE skills SET
        name = COALESCE($3, name),
        summary = COALESCE($4, summary),
        level = COALESCE($5, level),
        edited_by_user = true,
        updated_at = now()
      WHERE id=$1 AND user_id=$2
      RETURNING id, name, summary, level, evidence_count, source, edited_by_user`,
    [id, userId, patch.name ?? null, patch.summary ?? null, patch.level ?? null]
  );
  return rows[0] ? toDTO(rows[0]) : null;
}

export async function deleteSkill(userId: string, id: string) {
  await query("DELETE FROM skills WHERE id=$1 AND user_id=$2", [id, userId]);
}

function toDTO(r: any): SkillDTO {
  return {
    id: r.id, name: r.name, summary: r.summary, level: r.level,
    evidenceCount: r.evidence_count, source: r.source, editedByUser: r.edited_by_user,
  };
}
