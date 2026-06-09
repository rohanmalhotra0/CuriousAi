import { test } from "node:test";
import assert from "node:assert/strict";
import { resolveMime } from "../src/services/extraction.service.js";
import { SUPPORTED_MIME } from "@curiousai/shared";

test("resolveMime keeps a specific browser-provided mime", () => {
  assert.equal(resolveMime("a.pdf", "application/pdf"), "application/pdf");
});

test("resolveMime infers from extension when mime is generic", () => {
  assert.equal(resolveMime("notes.pdf", "application/octet-stream"), "application/pdf");
  assert.equal(resolveMime("notes.txt", ""), "text/plain");
  assert.equal(resolveMime("mail.eml", ""), "message/rfc822");
  assert.equal(resolveMime("archive.zip", ""), "application/zip");
  assert.equal(
    resolveMime("paper.docx", ""),
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
  );
});

test("resolved mimes for supported extensions are all in SUPPORTED_MIME", () => {
  for (const name of ["a.pdf", "a.txt", "a.eml", "a.zip", "a.docx"]) {
    assert.ok(SUPPORTED_MIME[resolveMime(name, "")], `${name} should resolve to a supported mime`);
  }
});

test("resolveMime leaves unknown extensions unsupported", () => {
  assert.ok(!SUPPORTED_MIME[resolveMime("image.png", "image/png")]);
  assert.ok(!SUPPORTED_MIME[resolveMime("data.bin", "application/octet-stream")]);
});
