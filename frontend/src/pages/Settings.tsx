import { useEffect, useState } from "react";
import {
  Toggle, Tile, Button, Modal, InlineNotification, InlineLoading,
} from "@carbon/react";
import { TrashCan } from "@carbon/icons-react";
import { api } from "../api/client";

// Privacy + memory controls. Memory toggle persists server-side; data deletion
// removes all of this user's content after explicit confirmation.
export default function Settings() {
  const [memoryEnabled, setMemoryEnabled] = useState<boolean | null>(null);
  const [confirming, setConfirming] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api.getSettings().then((s) => setMemoryEnabled(s.memoryEnabled)).catch((e) => setError(e.message));
  }, []);

  const toggleMemory = async (next: boolean) => {
    setMemoryEnabled(next);
    try {
      await api.updateSettings(next);
      setNotice(`Memory ${next ? "enabled" : "disabled"}.`);
    } catch (e: any) {
      setError(e.message);
    }
  };

  const deleteAll = async () => {
    setConfirming(false);
    try {
      await api.deleteAllData();
      setNotice("All your documents, memories, topics, skills, and chats were deleted.");
    } catch (e: any) {
      setError(e.message);
    }
  };

  return (
    <div>
      <h2 className="page-title">Settings</h2>
      <p className="page-sub">Privacy, memory, and data controls.</p>

      {notice && (
        <InlineNotification kind="success" title="Saved" subtitle={notice}
          onCloseButtonClick={() => setNotice(null)} style={{ marginBottom: "1rem" }} />
      )}
      {error && (
        <InlineNotification kind="error" title="Error" subtitle={error}
          onCloseButtonClick={() => setError(null)} style={{ marginBottom: "1rem" }} />
      )}

      <Tile style={{ marginBottom: "1rem", maxWidth: 640 }}>
        <h4 style={{ marginTop: 0 }}>Memory</h4>
        <p style={{ color: "#525252", marginBottom: "1rem" }}>
          When on, CuriousAI remembers durable facts from your chats and recalls them in
          later conversations. When off, no long-term memories are recalled or written.
        </p>
        {memoryEnabled === null ? (
          <InlineLoading description="Loading…" />
        ) : (
          <Toggle id="memory-setting" size="sm" labelText="" labelA="Off" labelB="On"
            toggled={memoryEnabled} onToggle={toggleMemory} />
        )}
      </Tile>

      <Tile style={{ maxWidth: 640, border: "1px solid #ffd7d9" }}>
        <h4 style={{ marginTop: 0 }}>Delete all data</h4>
        <p style={{ color: "#525252", marginBottom: "1rem" }}>
          Permanently removes all your documents, embeddings, memories, topics, skills, and
          chat history. This cannot be undone.
        </p>
        <Button kind="danger" size="sm" renderIcon={TrashCan} onClick={() => setConfirming(true)}>
          Delete all my data
        </Button>
      </Tile>

      <Modal
        open={confirming}
        danger
        modalHeading="Delete all data?"
        primaryButtonText="Delete everything"
        secondaryButtonText="Cancel"
        onRequestClose={() => setConfirming(false)}
        onRequestSubmit={deleteAll}
      >
        This permanently deletes every document, memory, topic, skill, and chat tied to your
        account. This action cannot be undone.
      </Modal>
    </div>
  );
}
