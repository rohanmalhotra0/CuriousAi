// Per-user settings + privacy controls.
//
// Settings today is just the memory toggle (see §7 Settings), but it lives in its
// own service so privacy/preference logic stays out of the route layer and is easy
// to extend. `deleteAllData` is the GDPR-style "delete everything I've given you"
// action: it removes all user-owned content (documents, chunks, memories, topics,
// skills, chats, intro requests) and the raw files on disk, then resets prefs. The
// account row itself is kept so the user can keep using the app from a clean slate.
import { rm } from "node:fs/promises";
import { join } from "node:path";
import type { SettingsDTO } from "@curiousai/shared";
import { config } from "../config.js";
import { pool, query } from "../db/pool.js";

export async function getSettings(userId: string): Promise<SettingsDTO> {
  const { rows } = await query("SELECT memory_enabled FROM users WHERE id = $1", [userId]);
  return { memoryEnabled: rows[0]?.memory_enabled ?? true };
}

export async function updateSettings(
  userId: string,
  patch: Partial<SettingsDTO>
): Promise<SettingsDTO> {
  if (typeof patch.memoryEnabled === "boolean") {
    await query("UPDATE users SET memory_enabled = $1 WHERE id = $2", [patch.memoryEnabled, userId]);
  }
  return getSettings(userId);
}

export interface DeletionSummary {
  documents: number;
  chunks: number;
  memories: number;
  chats: number;
}

/**
 * Erase everything this user has contributed. Runs in one transaction so a partial
 * failure leaves the account untouched. Foreign keys cascade chunks/messages/edges,
 * so we only delete the top-level rows. Raw files on disk are removed last (outside
 * the DB tx — a stray file is harmless, an orphaned DB row is not).
 */
export async function deleteAllData(userId: string): Promise<DeletionSummary> {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const docs = await client.query("SELECT COUNT(*)::int AS n FROM documents WHERE user_id=$1", [userId]);
    const chunks = await client.query("SELECT COUNT(*)::int AS n FROM chunks WHERE user_id=$1", [userId]);
    const mems = await client.query("SELECT COUNT(*)::int AS n FROM memories WHERE user_id=$1", [userId]);
    const chats = await client.query("SELECT COUNT(*)::int AS n FROM chats WHERE user_id=$1", [userId]);

    // documents -> chunks cascade; chats -> messages -> citations cascade;
    // topics/skills -> their edge tables cascade.
    await client.query("DELETE FROM documents WHERE user_id=$1", [userId]);
    await client.query("DELETE FROM memories  WHERE user_id=$1", [userId]);
    await client.query("DELETE FROM topics    WHERE user_id=$1", [userId]);
    await client.query("DELETE FROM skills    WHERE user_id=$1", [userId]);
    await client.query("DELETE FROM chats     WHERE user_id=$1", [userId]);
    await client.query(
      "DELETE FROM intro_requests WHERE requester_id=$1 OR expert_id=$1",
      [userId]
    );
    // Reset preferences to defaults (account survives, content does not).
    await client.query("UPDATE users SET memory_enabled = true WHERE id=$1", [userId]);
    await client.query("COMMIT");

    // Best-effort removal of the user's raw upload directory.
    await rm(join(config.storageDir, userId), { recursive: true, force: true }).catch(() => {});

    return {
      documents: docs.rows[0].n,
      chunks: chunks.rows[0].n,
      memories: mems.rows[0].n,
      chats: chats.rows[0].n,
    };
  } catch (e) {
    await client.query("ROLLBACK").catch(() => {});
    throw e;
  } finally {
    client.release();
  }
}
