type Level = "info" | "warn" | "error";

function log(level: Level, msg: string, meta?: unknown) {
  const ts = new Date().toISOString();
  const line = `${ts} [${level.toUpperCase()}] ${msg}`;
  const fn = level === "error" ? console.error : console.log;
  meta !== undefined ? fn(line, meta) : fn(line);
}

export const logger = {
  info: (m: string, meta?: unknown) => log("info", m, meta),
  warn: (m: string, meta?: unknown) => log("warn", m, meta),
  error: (m: string, meta?: unknown) => log("error", m, meta),
};
