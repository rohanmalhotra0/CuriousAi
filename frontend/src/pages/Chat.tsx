import { useRef, useState } from "react";
import { TextInput, Button, Toggle, Tag, InlineLoading } from "@carbon/react";
import { Send } from "@carbon/icons-react";
import type { Citation, ExpertCardDTO } from "@curiousai/shared";
import { api } from "../api/client";
import ConfidenceBadge from "../components/ConfidenceBadge";
import ExpertCard from "../components/ExpertCard";

interface UiMessage {
  role: "user" | "assistant";
  content: string;
  confidence?: number;
  citations?: Citation[];
  experts?: ExpertCardDTO[];
  routed?: boolean;
}

export default function Chat() {
  const [messages, setMessages] = useState<UiMessage[]>([]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [memoryOn, setMemoryOn] = useState(true);
  const chatIdRef = useRef<string>("new");
  const scrollRef = useRef<HTMLDivElement>(null);

  const scrollToEnd = () =>
    requestAnimationFrame(() => scrollRef.current?.scrollTo(0, scrollRef.current.scrollHeight));

  async function send() {
    const q = input.trim();
    if (!q || busy) return;
    setInput("");
    setBusy(true);
    setMessages((m) => [...m, { role: "user", content: q }, { role: "assistant", content: "" }]);
    scrollToEnd();

    try {
      await api.sendMessage(
        chatIdRef.current,
        q,
        (token) => {
          setMessages((m) => {
            const copy = [...m];
            copy[copy.length - 1] = {
              ...copy[copy.length - 1],
              content: copy[copy.length - 1].content + token,
            };
            return copy;
          });
          scrollToEnd();
        },
        (result) => {
          if (result.chatId) chatIdRef.current = result.chatId;
          setMessages((m) => {
            const copy = [...m];
            copy[copy.length - 1] = {
              ...copy[copy.length - 1],
              confidence: result.confidence,
              citations: result.citations,
              experts: result.experts,
              routed: result.routed,
            };
            return copy;
          });
          scrollToEnd();
        }
      );
    } catch (e: any) {
      setMessages((m) => {
        const copy = [...m];
        copy[copy.length - 1] = { role: "assistant", content: `Error: ${e.message}` };
        return copy;
      });
    } finally {
      setBusy(false);
    }
  }

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <div>
          <h2 className="page-title">Chat</h2>
          <p className="page-sub">Grounded answers from your knowledge base, with citations.</p>
        </div>
        <Toggle
          id="memory-toggle"
          size="sm"
          labelText="Memory"
          labelA="Off"
          labelB="On"
          toggled={memoryOn}
          onToggle={setMemoryOn}
        />
      </div>

      <div className="chat-wrap">
        <div
          className="chat-scroll"
          ref={scrollRef}
          role="log"
          aria-label="Conversation"
          aria-live="polite"
          aria-relevant="additions text"
          aria-busy={busy}
        >
          {messages.length === 0 && (
            <p style={{ color: "#8d8d8d" }}>Ask a question about your imported documents to begin.</p>
          )}
          {messages.map((m, i) => (
            <div key={i} className={`msg ${m.role}`}>
              <div className="bubble">
                {m.content || (busy && i === messages.length - 1 ? <InlineLoading description="Thinking…" /> : "")}
              </div>

              {m.role === "assistant" && m.confidence !== undefined && (
                <div className="citations">
                  <div style={{ marginBottom: 4 }}>
                    <ConfidenceBadge value={m.confidence} />
                  </div>
                  {m.citations && m.citations.length > 0 && (
                    <div>
                      <strong>Sources:</strong>{" "}
                      {m.citations.map((c, n) => (
                        <Tag key={c.chunkId} size="sm" title={c.snippet}>
                          [{n + 1}] {c.filename}
                        </Tag>
                      ))}
                    </div>
                  )}
                  {m.routed && m.experts && m.experts.length > 0 && (
                    <div style={{ marginTop: 12 }}>
                      <strong>Low confidence — try these experts:</strong>
                      <div style={{ marginTop: 8 }}>
                        {m.experts.map((e) => (
                          <ExpertCard key={e.userId} expert={e} question={messages[i - 1]?.content} />
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>

        <div className="composer">
          <div className="field">
            <TextInput
              id="chat-input"
              labelText="Ask a question about your documents"
              hideLabel
              placeholder="Ask anything about your documents…"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && send()}
            />
          </div>
          <Button renderIcon={Send} onClick={send} disabled={busy}>
            Send
          </Button>
        </div>
      </div>
    </div>
  );
}
