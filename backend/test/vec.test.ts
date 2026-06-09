import { test } from "node:test";
import assert from "node:assert/strict";
import { cosine, dot, normalize, mean, kmeans, parseVector } from "../src/lib/vec.js";

const approx = (a: number, b: number, eps = 1e-9) => Math.abs(a - b) <= eps;

test("normalize returns a unit vector", () => {
  const v = normalize([3, 4]);
  assert.ok(approx(Math.hypot(v[0], v[1]), 1));
});

test("normalize is safe on the zero vector", () => {
  assert.deepEqual(normalize([0, 0, 0]), [0, 0, 0]);
});

test("cosine of identical normalized vectors is 1, opposite is -1", () => {
  const a = normalize([1, 2, 3]);
  assert.ok(approx(cosine(a, a), 1, 1e-12));
  const b = a.map((x) => -x);
  assert.ok(approx(cosine(a, b), -1, 1e-12));
});

test("cosine is clamped into [-1, 1]", () => {
  const c = cosine([10, 10], [10, 10]); // un-normalized -> dot > 1
  assert.ok(c <= 1 && c >= -1);
});

test("dot matches a hand computation", () => {
  assert.equal(dot([1, 2, 3], [4, 5, 6]), 32);
});

test("mean averages then re-normalizes to unit length", () => {
  const m = mean([normalize([1, 0]), normalize([0, 1])]);
  assert.ok(approx(Math.hypot(m[0], m[1]), 1));
});

test("parseVector reads the pgvector literal format", () => {
  assert.deepEqual(parseVector("[0.5,1,-2]"), [0.5, 1, -2]);
  assert.deepEqual(parseVector([1, 2]), [1, 2]);
});

test("kmeans separates two well-defined clusters and is deterministic", () => {
  const clusterA = [normalize([1, 0]), normalize([0.99, 0.01]), normalize([0.98, 0.02])];
  const clusterB = [normalize([0, 1]), normalize([0.01, 0.99]), normalize([0.02, 0.98])];
  const vectors = [...clusterA, ...clusterB];

  const r1 = kmeans(vectors, 2);
  const r2 = kmeans(vectors, 2);
  assert.deepEqual(r1.assignments, r2.assignments); // deterministic with fixed seed

  // The first three and last three points should each share a label.
  const first = r1.assignments.slice(0, 3);
  const last = r1.assignments.slice(3);
  assert.ok(first.every((x) => x === first[0]));
  assert.ok(last.every((x) => x === last[0]));
  assert.notEqual(first[0], last[0]);
});

test("kmeans clamps k to the number of points", () => {
  const { centroids } = kmeans([normalize([1, 0]), normalize([0, 1])], 9);
  assert.ok(centroids.length <= 2);
});
