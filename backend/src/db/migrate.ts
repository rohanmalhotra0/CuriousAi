// Minimal forward-only migration runner. Applies any *.sql file in migrations/
// that hasn't been recorded yet, in filename order.
import { readdir, readFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { pool } from "./pool.js";
import { logger } from "../lib/logger.js";

const here = dirname(fileURLToPath(import.meta.url));
const dir = join(here, "migrations");

async function run() {
  await pool.query(`CREATE TABLE IF NOT EXISTS _migrations (
    name text PRIMARY KEY, applied_at timestamptz NOT NULL DEFAULT now())`);

  const files = (await readdir(dir)).filter((f) => f.endsWith(".sql")).sort();
  for (const file of files) {
    const done = await pool.query("SELECT 1 FROM _migrations WHERE name=$1", [file]);
    if (done.rowCount) {
      logger.info(`migration ${file} already applied`);
      continue;
    }
    const sql = await readFile(join(dir, file), "utf8");
    logger.info(`applying migration ${file}`);
    await pool.query("BEGIN");
    try {
      await pool.query(sql);
      await pool.query("INSERT INTO _migrations(name) VALUES ($1)", [file]);
      await pool.query("COMMIT");
    } catch (e) {
      await pool.query("ROLLBACK");
      throw e;
    }
  }
  logger.info("migrations complete");
  await pool.end();
}

run().catch((e) => {
  logger.error("migration failed", e);
  process.exit(1);
});
