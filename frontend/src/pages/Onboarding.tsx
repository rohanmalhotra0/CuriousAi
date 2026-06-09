import { useNavigate } from "react-router-dom";
import {
  ProgressIndicator,
  ProgressStep,
  Tile,
  Button,
  Grid,
  Column,
} from "@carbon/react";
import { DocumentAdd, ChatBot, Network_3 } from "@carbon/icons-react";

// First-run tutorial. Explains the flow: import -> build knowledge -> ask.
export default function Onboarding() {
  const navigate = useNavigate();
  return (
    <div>
      <h2 className="page-title">Welcome to CuriousAI</h2>
      <p className="page-sub">
        Your personal knowledge advantage — import what you know, and ask anything.
      </p>

      <ProgressIndicator currentIndex={0} spaceEqually style={{ marginBottom: "2rem" }}>
        <ProgressStep label="Import" secondaryLabel="Add your documents" />
        <ProgressStep label="Build" secondaryLabel="We index & map your knowledge" />
        <ProgressStep label="Ask" secondaryLabel="Chat with cited answers" />
      </ProgressIndicator>

      <Grid narrow>
        <Column sm={4} md={4} lg={5}>
          <Tile style={{ minHeight: 180 }}>
            <DocumentAdd size={28} />
            <h4 style={{ margin: "0.5rem 0" }}>1 · Import your files</h4>
            <p>Drag in PDFs, Word docs, text, emails, or a whole zip folder.</p>
            <Button size="sm" onClick={() => navigate("/files")}>Import documents</Button>
          </Tile>
        </Column>
        <Column sm={4} md={4} lg={5}>
          <Tile style={{ minHeight: 180 }}>
            <Network_3 size={28} />
            <h4 style={{ margin: "0.5rem 0" }}>2 · We build your graph</h4>
            <p>Text is extracted, embedded, and indexed into a searchable knowledge base.</p>
          </Tile>
        </Column>
        <Column sm={4} md={4} lg={6}>
          <Tile style={{ minHeight: 180 }}>
            <ChatBot size={28} />
            <h4 style={{ margin: "0.5rem 0" }}>3 · Ask with confidence</h4>
            <p>Every answer cites its sources and shows a confidence score.</p>
            <Button size="sm" kind="tertiary" onClick={() => navigate("/chat")}>Open chat</Button>
          </Tile>
        </Column>
      </Grid>
    </div>
  );
}
