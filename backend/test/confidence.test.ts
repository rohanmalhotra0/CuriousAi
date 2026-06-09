import { test } from "node:test";
import assert from "node:assert/strict";
import {
  scoreConfidence,
  shouldRoute,
  confidenceColor,
} from "../src/services/confidence.service.js";
import { CONFIDENCE_THRESHOLD } from "@curiousai/shared";

test("no hits -> zero confidence and routes", () => {
  assert.equal(scoreConfidence([]), 0);
  assert.equal(shouldRoute(0), true);
});

test("score is bounded to 0..100", () => {
  for (const s of [0, 0.1, 0.32, 0.5, 1]) {
    const c = scoreConfidence([{ score: s }, { score: s }, { score: s }]);
    assert.ok(c >= 0 && c <= 100, `score ${s} -> ${c} out of range`);
  }
});

test("stronger retrieval yields higher confidence (monotonic)", () => {
  const weak = scoreConfidence([{ score: 0.1 }]);
  const strong = scoreConfidence([{ score: 0.6 }, { score: 0.55 }, { score: 0.5 }]);
  assert.ok(strong > weak, `expected ${strong} > ${weak}`);
});

test("deterministic: identical inputs give identical output", () => {
  const hits = [{ score: 0.42 }, { score: 0.31 }, { score: 0.2 }];
  assert.equal(scoreConfidence(hits), scoreConfidence([...hits]));
});

test("shouldRoute flips exactly at the threshold", () => {
  assert.equal(shouldRoute(CONFIDENCE_THRESHOLD), false);
  assert.equal(shouldRoute(CONFIDENCE_THRESHOLD - 1), true);
});

test("confidenceColor buckets: green >=80, blue >=65, red below", () => {
  assert.equal(confidenceColor(90), "green");
  assert.equal(confidenceColor(80), "green");
  assert.equal(confidenceColor(79), "blue");
  assert.equal(confidenceColor(CONFIDENCE_THRESHOLD), "blue");
  assert.equal(confidenceColor(CONFIDENCE_THRESHOLD - 1), "red");
});
