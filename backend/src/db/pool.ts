import pg from "pg";
import { config } from "../config.js";

export const pool = new pg.Pool({ connectionString: config.databaseUrl });

export async function query<T extends pg.QueryResultRow = any>(
  text: string,
  params?: unknown[]
): Promise<pg.QueryResult<T>> {
  return pool.query<T>(text, params as any[]);
}

/** Serialize a JS number[] into the pgvector literal format: '[0.1,0.2,...]'. */
export function toVector(v: number[]): string {
  return `[${v.join(",")}]`;
}
