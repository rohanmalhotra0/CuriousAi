import express from "express";
import cors from "cors";
import { config } from "./config.js";
import { logger } from "./lib/logger.js";
import { resolveUser, errorHandler } from "./api/middleware.js";
import { filesRouter } from "./api/files.routes.js";
import { chatRouter } from "./api/chat.routes.js";
import { expertsRouter } from "./api/experts.routes.js";
import { graphRouter } from "./api/graph.routes.js";
import { skillsRouter } from "./api/skills.routes.js";
import { settingsRouter } from "./api/settings.routes.js";

const app = express();
app.use(cors());
app.use(express.json({ limit: "2mb" }));
app.use(resolveUser);

app.get("/health", (_req, res) => res.json({ ok: true, provider: config.aiProvider }));

app.use("/api/files", filesRouter);
// Chat lives under two prefixes: /api/chats (history) and /api/chat (messaging).
app.use("/api/chats", chatRouter);
app.use("/api/chat", chatRouter);
app.use("/api/experts", expertsRouter);
app.use("/api/graph", graphRouter);
app.use("/api/skills", skillsRouter);
// settingsRouter also serves POST /api/settings/report.
app.use("/api/settings", settingsRouter);

app.use(errorHandler);

app.listen(config.port, () => {
  logger.info(`CuriousAI API on :${config.port} (provider=${config.aiProvider})`);
});
