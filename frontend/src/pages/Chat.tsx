import { useEffect, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import {
  Button,
  InlineNotification,
  Tag,
  TextArea,
  Tile,
} from "@carbon/react";
import { Send } from "@carbon/icons-react";
import {
  CONFIDENCE_THRESHOLD,
  type Citation,
  type ExpertCardDTO,
} from "@curiousai/shared";
import { api } from "../api/client";

interface UiMessage {
  role: "user" | "assistant";
  content: string;
  confidence?: number | null;
  citations?: Citation[];
  experts?: ExpertCardDTO[];
  streaming?: boolean;
}

function confidenceTag(confidence: number) {
  const type = confidence >= 80 ? "green" : confidence >= CONFIDENCE_THRESHOLD ? "blue" : "red";
  return <Tag type={type}>confidence {confidence}</Tag>;
}

export function ChatPage() {
  const { chatId: routeChatId } = useParams();
  const navigate = useNavigate();
  const [chatId, setChatId] = useState(routeChatId ?? "new");
  const [messages, setMessages] = useState<UiMessage[]>([]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  // Load history when navigating to an existing chat.
  useEffect(() => {
    const id = routeChatId ?? "new";
    setChatId(id);
    if (id === "new") {
      setMessages([]);
      return;
    }
    api
      .getChat(id)
      .then((msgs) =>
        setMessages(
          msgs.map((m) => ({
            role: m.role,
            content: m.content,
            confidence: m.confidence,
            citations: m.citations,
          }))
        )
      )
      .catch((e) => setError((e as Error).message));
  }, [routeChatId]);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight });
  }, [messages]);

  async function send() {
    const question = input.trim();
    if (!question || busy) return;
    setError(null);
    setInput("");
    setBusy(true);

    setMessages((prev) => [
      ...prev,
      { role: "user", content: question },
      { role: "assistant", content: "", streaming: true },
    ]);
    const assistantIdx = messages.length + 1;

    try {
      const { chatId: newId, result } = await api.sendMessage(chatId, question, (token) => {
        setMessages((prev) => {
          const next = [...prev];
          const m = next[assistantIdx];
          if (m) next[assistantIdx] = { ...m, content: m.content + token };
          return next;
        });
      });

      setMessages((prev) => {
        const next = [...prev];
        const m = next[assistantIdx];
        if (m)
          next[assistantIdx] = {
            ...m,
            streaming: false,
            confidence: result.confidence,
            citations: result.citations,
            experts: result.routed ? result.experts : undefined,
          };
        return next;
      });

      if (newId !== chatId) {
        setChatId(newId);
        navigate(`/chat/${newId}`, { replace: true });
      }
    } catch (e) {
      setError((e as Error).message);
      setMessages((prev) => prev.filter((_, i) => i !== assistantIdx));
    } finally {
      setBusy(false);
    }
  }

  function onKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      send();
    }
  }

  return (
    <div className="chat-wrap">
      <h1 className="page-title">Chat</h1>
      <p className="page-sub">Answers are grounded in your imported files, with sources and confidence.</p>

      {error && (
        <InlineNotification
          kind="error"
          title="Chat error"
          subtitle={error}
          onCloseButtonClick={() => setError(null)}
          style={{ marginBottom: "1rem" }}
        />
      )}

      <div className="chat-scroll" ref={scrollRef} aria-live="polite">
        {messages.length === 0 && (
          <p style={{ color: "#525252" }}>
            Ask a question about your knowledge base to get started.
          </p>
        )}
        {messages.map((m, i) => (
          <div key={i} className={`msg ${m.role}`}>
            <div className="bubble">{m.content || (m.streaming ? "…" : "")}</div>

            {m.role === "assistant" && !m.streaming && typeof m.confidence === "number" && (
              <div className="citations">
                <div style={{ marginBottom: "0.5rem" }}>{confidenceTag(m.confidence)}</div>

                {m.citations && m.citations.length > 0 && (
                  <div>
                    <strong>Sources:</strong>
                    <ul style={{ margin: "0.25rem 0 0 1rem" }}>
                      {m.citations.map((c, ci) => (
                        <li key={c.chunkId}>
                          [{ci + 1}] {c.filename} — <em>{c.snippet}</em>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                {m.experts && m.experts.length > 0 && <ExpertList experts={m.experts} />}
              </div>
            )}
          </div>
        ))}
      </div>

      <div className="composer">
        <div className="field">
          <TextArea
            labelText=""
            hideLabel
            rows={2}
            placeholder="Ask anything about your files…"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={onKeyDown}
          />
        </div>
        <Button renderIcon={Send} onClick={send} disabled={busy || !input.trim()}>
          Send
        </Button>
      </div>
    </div>
  );
}

function ExpertList({ experts }: { experts: ExpertCardDTO[] }) {
  return (
    <div style={{ marginTop: "0.75rem" }}>
      <strong>Low confidence — you may want to ask an expert:</strong>
      <div style={{ display: "flex", gap: "0.75rem", flexWrap: "wrap", marginTop: "0.5rem" }}>
        {experts.map((e) => (
          <Tile key={e.userId} style={{ minWidth: "220px" }}>
            <div style={{ fontWeight: 600 }}>{e.name}</div>
            <div style={{ color: "#525252", marginBottom: "0.5rem" }}>{e.role}</div>
            <div style={{ display: "flex", gap: "0.25rem", flexWrap: "wrap" }}>
              {e.skills.slice(0, 4).map((s) => (
                <Tag key={s} type="cool-gray" size="sm">
                  {s}
                </Tag>
              ))}
            </div>
          </Tile>
        ))}
      </div>
    </div>
  );
}
