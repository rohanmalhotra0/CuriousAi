// Turns an uploaded file (by mime type) into one or more plain-text documents.
// ZIPs expand recursively into their supported entries.
import { createRequire } from "node:module";
import mammoth from "mammoth";
import { simpleParser } from "mailparser";
import yauzl from "yauzl";
import { config } from "../config.js";
import { unsupported, badRequest } from "../lib/errors.js";

// pdf-parse ships as CJS with a side-effect-y index; require the lib entry directly.
const require = createRequire(import.meta.url);
const pdfParse = require("pdf-parse/lib/pdf-parse.js") as (b: Buffer) => Promise<{ text: string }>;

export interface ExtractedDoc {
  filename: string;
  text: string;
}

export async function extract(
  filename: string,
  mime: string,
  buffer: Buffer
): Promise<ExtractedDoc[]> {
  switch (mime) {
    case "application/pdf":
      return [{ filename, text: (await pdfParse(buffer)).text }];

    case "application/vnd.openxmlformats-officedocument.wordprocessingml.document":
      return [{ filename, text: (await mammoth.extractRawText({ buffer })).value }];

    case "text/plain":
      return [{ filename, text: buffer.toString("utf8") }];

    case "message/rfc822": {
      const mail = await simpleParser(buffer);
      const body = [mail.subject, mail.text].filter(Boolean).join("\n\n");
      return [{ filename, text: body }];
    }

    case "application/zip":
      return extractZip(buffer);

    default:
      throw unsupported(`Unsupported file type: ${mime}`);
  }
}

/** Detect a usable mime from filename when the browser sends a generic one. */
export function resolveMime(filename: string, mime: string): string {
  if (mime && mime !== "application/octet-stream") return mime;
  const ext = filename.toLowerCase().split(".").pop();
  const map: Record<string, string> = {
    pdf: "application/pdf",
    docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    txt: "text/plain",
    eml: "message/rfc822",
    zip: "application/zip",
  };
  return map[ext ?? ""] ?? mime;
}

function extractZip(buffer: Buffer): Promise<ExtractedDoc[]> {
  return new Promise((resolve, reject) => {
    yauzl.fromBuffer(buffer, { lazyEntries: true }, (err, zip) => {
      if (err || !zip) return reject(badRequest("Could not read zip archive"));
      const out: ExtractedDoc[] = [];
      let count = 0;
      zip.readEntry();
      zip.on("entry", (entry) => {
        if (/\/$/.test(entry.fileName)) return zip.readEntry(); // directory
        if (++count > config.maxZipEntries)
          return reject(badRequest(`Zip exceeds ${config.maxZipEntries} entries`));
        const mime = resolveMime(entry.fileName, "");
        if (!["application/pdf", "text/plain", "message/rfc822",
          "application/vnd.openxmlformats-officedocument.wordprocessingml.document"].includes(mime)) {
          return zip.readEntry(); // skip unsupported entries silently
        }
        zip.openReadStream(entry, (e, stream) => {
          if (e || !stream) return zip.readEntry();
          const chunks: Buffer[] = [];
          stream.on("data", (d) => chunks.push(d));
          stream.on("end", async () => {
            try {
              const inner = await extract(entry.fileName, mime, Buffer.concat(chunks));
              out.push(...inner);
            } catch {
              /* skip unreadable inner file */
            }
            zip.readEntry();
          });
        });
      });
      zip.on("end", () => resolve(out));
      zip.on("error", () => reject(badRequest("Corrupt zip archive")));
    });
  });
}
