// Builds an Obsidian-style topic graph from a user's indexed chunks:
//   embeddings -> cosine k-means clusters -> labelled topics -> centroid-similarity
//   edges. Rebuild is idempotent (replaces the user's topics each run).
import type { GraphDTO } from "@curiousai/shared";
import { query, toVector } from "../db/pool.js";
import { kmeans, cosine, parseVector } from "../lib/vec.js";
import { phraseCounts, firstSentence, titleCase } from "../lib/text.js";

const EDGE_THRESHOLD = 0.25;

interface ChunkRow {
  id: string;
  text: string;
  embedding: number[];
}

export async function rebuildTopics(userId: string): Promise<number> {
  const { rows } = await query(
    "SELECT id, text, embedding FROM chunks WHERE user_id=$1 AND embedding IS NOT NULL",
    [userId]
  );
  const chunks: ChunkRow[] = rows.map((r: any) => ({
    id: r.id, text: r.text, embedding: parseVector(r.embedding),
  }));

  // Replace prior topics for this user (cascades topic_chunks + topic_edges).
  await query("DELETE FROM topics WHERE user_id=$1", [userId]);
  if (chunks.length === 0) return 0;

  const k = Math.max(1, Math.min(8, Math.round(Math.sqrt(chunks.length / 2)) || 1));
  const { assignments, centroids } = kmeans(chunks.map((c) => c.embedding), k);

  // Persist each non-empty cluster as a topic.
  const topicIds: string[] = [];
  const topicCentroids: number[][] = [];
  for (let c = 0; c < centroids.length; c++) {
    const members = chunks.filter((_, i) => assignments[i] === c);
    if (members.length === 0) continue;

    const label = labelFor(members.map((m) => m.text));
    const central = mostCentral(members, centroids[c]);
    const summary = firstSentence(central.text);

    const ins = await query(
      `INSERT INTO topics (user_id, label, summary, centroid, size)
       VALUES ($1,$2,$3,$4::vector,$5) RETURNING id`,
      [userId, label, summary, toVector(centroids[c]), members.length]
    );
    const topicId = ins.rows[0].id;
    topicIds.push(topicId);
    topicCentroids.push(centroids[c]);

    for (const m of members) {
      await query("INSERT INTO topic_chunks (topic_id, chunk_id) VALUES ($1,$2)", [topicId, m.id]);
    }
  }

  // Edges between topics whose centroids are similar enough.
  for (let i = 0; i < topicIds.length; i++) {
    for (let j = i + 1; j < topicIds.length; j++) {
      const w = cosine(topicCentroids[i], topicCentroids[j]);
      if (w >= EDGE_THRESHOLD) {
        await query(
          "INSERT INTO topic_edges (src_topic_id, dst_topic_id, weight) VALUES ($1,$2,$3)",
          [topicIds[i], topicIds[j], Number(w.toFixed(3))]
        );
      }
    }
  }
  return topicIds.length;
}

export async function getGraph(userId: string): Promise<GraphDTO> {
  const nodes = await query(
    "SELECT id, label, summary, size FROM topics WHERE user_id=$1 ORDER BY size DESC",
    [userId]
  );
  const edges = await query(
    `SELECT te.src_topic_id AS source, te.dst_topic_id AS target, te.weight
       FROM topic_edges te
       JOIN topics t ON t.id = te.src_topic_id
      WHERE t.user_id = $1`,
    [userId]
  );
  return {
    nodes: nodes.rows.map((r: any) => ({
      id: r.id, label: r.label, summary: r.summary, size: r.size,
    })),
    edges: edges.rows.map((r: any) => ({
      source: r.source, target: r.target, weight: Number(r.weight),
    })),
  };
}

// Topic label = the 2 strongest distinctive phrases in the cluster.
function labelFor(texts: string[]): string {
  const counts = phraseCounts(texts);
  const top = [...counts.entries()]
    .sort((a, b) => b[1] - a[1] || b[0].length - a[0].length)
    .slice(0, 2)
    .map(([p]) => titleCase(p));
  return top.join(" · ") || "Topic";
}

function mostCentral(members: ChunkRow[], centroid: number[]): ChunkRow {
  return members.reduce((best, m) =>
    cosine(m.embedding, centroid) > cosine(best.embedding, centroid) ? m : best
  );
}
