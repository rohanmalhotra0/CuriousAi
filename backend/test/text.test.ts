import { test } from "node:test";
import assert from "node:assert/strict";
import { terms, firstSentence, phraseCounts, titleCase } from "../src/lib/text.js";

test("terms lowercases, drops stopwords and tokens <=2 chars", () => {
  const t = terms("The Quick brown FOX is a fox");
  assert.ok(!t.includes("the"));
  assert.ok(!t.includes("is")); // length 2
  assert.deepEqual(
    t.filter((w) => w === "fox"),
    ["fox", "fox"]
  );
  assert.ok(t.includes("quick"));
  assert.ok(t.includes("brown"));
});

test("terms handles empty / punctuation-only input", () => {
  assert.deepEqual(terms(""), []);
  assert.deepEqual(terms("!!! ... ???"), []);
});

test("firstSentence returns the first sentence and truncates long ones", () => {
  assert.equal(firstSentence("Hello world. Second one."), "Hello world.");
  const long = "a ".repeat(300);
  const fs = firstSentence(long);
  assert.ok(fs.length <= 240);
  assert.ok(fs.endsWith("..."));
});

test("phraseCounts counts unigrams and bigrams (stopwords removed)", () => {
  const counts = phraseCounts(["machine learning machine"]);
  assert.equal(counts.get("machine"), 2);
  assert.equal(counts.get("learning"), 1);
  assert.equal(counts.get("machine learning"), 1);
  assert.equal(counts.get("learning machine"), 1);
});

test("titleCase capitalizes each word", () => {
  assert.equal(titleCase("hello world"), "Hello World");
  assert.equal(titleCase("data structures"), "Data Structures");
});
