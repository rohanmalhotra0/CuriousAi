import { Button, ClickableTile, Grid, Column } from "@carbon/react";
import { useNavigate } from "react-router-dom";

const STEPS = [
  {
    title: "1 · Import your knowledge",
    body: "Drop in PDFs, Word docs, plain text, emails, or a zip of files. CuriousAI extracts, chunks, and indexes them.",
    to: "/files",
  },
  {
    title: "2 · Ask grounded questions",
    body: "Chat against everything you've imported. Answers are built only from your sources and cite where they came from.",
    to: "/chat",
  },
  {
    title: "3 · Get routed to experts",
    body: "When confidence is low, CuriousAI surfaces the people whose skills best match your question.",
    to: "/chat",
  },
];

export function HomePage() {
  const navigate = useNavigate();
  return (
    <div>
      <h1 className="page-title">Your knowledge advantage</h1>
      <p className="page-sub">
        A personalized AI knowledge system. Import what you know, ask anything, and get answers
        grounded in your own sources — with citations and confidence on every reply.
      </p>

      <Grid narrow>
        {STEPS.map((s) => (
          <Column key={s.title} sm={4} md={4} lg={5} style={{ marginBottom: "1rem" }}>
            <ClickableTile onClick={() => navigate(s.to)} style={{ height: "100%" }}>
              <h4 style={{ marginBottom: "0.5rem" }}>{s.title}</h4>
              <p style={{ color: "#525252" }}>{s.body}</p>
            </ClickableTile>
          </Column>
        ))}
      </Grid>

      <div style={{ marginTop: "1.5rem", display: "flex", gap: "0.75rem" }}>
        <Button onClick={() => navigate("/files")}>Import files</Button>
        <Button kind="tertiary" onClick={() => navigate("/chat")}>
          Start a chat
        </Button>
      </div>
    </div>
  );
}
