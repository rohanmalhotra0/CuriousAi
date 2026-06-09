import { test } from "node:test";
import assert from "node:assert/strict";
import { chunkText } from "../src/services/embedding.service.js";
import { DeterministicEmbeddingProvider } from "../src/providers/embedding/deterministic.js";
import { cosine } from "../src/lib/vec.js";

test("chunkText returns [] for empty / whitespace input", () => {
  assert.deepEqual(chunkText(""), []);
  assert.deepEqual(chunkText("   \n\n  "), []);
});

test("chunkText splits long text into multiple ordered chunks", () => {
  const text = Array.from({ length: 40 }, (_, i) => `Sentence number ${i} about knowledge.`).join(" ");
  const chunks = chunkText(text);
  assert.ok(chunks.length > 1, "expected multiple chunks");
  chunks.forEach((c, i) => assert.equal(c.ordinal, i));
  assert.ok(chunks.every((c) => c.text.length > 0 && c.tokenCount > 0));
});

test("chunkText carries overlap between consecutive windows", () => {
  const text = Array.from({ length: 30 }, (_, i) => `alpha${i} word here today.`).join(" ");
  const chunks = chunkText(text);
  if (chunks.length >= 2) {
    const tailWords = chunks[0].text.split(/\s+/).slice(-3);
    const headOfNext = chunks[1].text.split(/\s+/).slice(0, 12);
    assert.ok(tailWords.some((w) => headOfNext.includes(w)), "expected overlapping words");
  }
});

test("deterministic embedding: fixed dim, unit length, reproducible", () => {
  const provider = new DeterministicEmbeddingProvider(384);
  return provider.embed(["hello knowledge graph"]).then(async ([v]) => {
    assert.equal(v.length, 384);
    assert.ok(Math.abs(Math.hypot(...v) - 1) < 1e-9, "vector should be L2-normalized");
    const [again] = await provider.embed(["hello knowledge graph"]);
    assert.deepEqual(v, again);
  });
});

test("deterministic embedding: overlapping text is closer than unrelated text", async () => {
  const provider = new DeterministicEmbeddingProvider(384);
  const [a, b, c] = await provider.embed([
    "machine learning and neural networks",
    "neural networks and machine learning",
    "the price of bananas at the market",
  ]);
  assert.ok(cosine(a, b) > cosine(a, c), "shared-vocabulary texts should be more similar");
});
