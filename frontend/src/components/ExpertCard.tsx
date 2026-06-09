import { useState } from "react";
import { Tile, Tag, Button, InlineLoading } from "@carbon/react";
import { UserAvatar, CheckmarkFilled } from "@carbon/icons-react";
import type { ExpertCardDTO } from "@curiousai/shared";
import { api } from "../api/client";

// IBM-style expert card shown when a question is routed for low confidence.
// "Request intro" is a placeholder — it durably records the ask on the backend.
export default function ExpertCard({
  expert,
  question,
}: {
  expert: ExpertCardDTO;
  question?: string;
}) {
  const lastActive = new Date(expert.lastActiveAt).toLocaleDateString();
  const [state, setState] = useState<"idle" | "sending" | "sent" | "error">("idle");

  async function requestIntro() {
    if (state === "sending" || state === "sent") return;
    setState("sending");
    try {
      await api.requestIntro(expert.userId, question);
      setState("sent");
    } catch {
      setState("error");
    }
  }

  return (
    <Tile style={{ marginBottom: "0.75rem" }}>
      <div style={{ display: "flex", gap: "0.75rem", alignItems: "center" }}>
        <UserAvatar size={32} />
        <div style={{ flex: 1 }}>
          <strong>{expert.name}</strong>
          <div style={{ color: "#525252", fontSize: "0.85rem" }}>{expert.role}</div>
        </div>
        <Tag type="blue" size="sm">{Math.round(expert.matchScore * 100)}% match</Tag>
      </div>
      <div style={{ margin: "0.5rem 0" }}>
        {expert.skills.length
          ? expert.skills.slice(0, 6).map((s) => <Tag key={s} size="sm">{s}</Tag>)
          : <span style={{ color: "#8d8d8d", fontSize: "0.85rem" }}>No skills indexed yet</span>}
      </div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <span style={{ fontSize: "0.8rem", color: "#525252" }}>Last active {lastActive}</span>
        {state === "sending" ? (
          <InlineLoading description="Requesting…" />
        ) : state === "sent" ? (
          <span style={{ display: "flex", alignItems: "center", gap: 4, fontSize: "0.8rem", color: "#42be65" }}>
            <CheckmarkFilled size={16} /> Intro requested
          </span>
        ) : (
          <Button size="sm" kind="tertiary" onClick={requestIntro}>
            {state === "error" ? "Retry intro" : "Request intro"}
          </Button>
        )}
      </div>
    </Tile>
  );
}
