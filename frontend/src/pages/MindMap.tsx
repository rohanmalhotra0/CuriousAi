import { useEffect, useRef, useState } from "react";
import cytoscape from "cytoscape";
import { Button, Tile, InlineLoading, InlineNotification } from "@carbon/react";
import { Renew } from "@carbon/icons-react";
import type { GraphDTO, GraphNodeDTO } from "@curiousai/shared";
import { api } from "../api/client";

// Obsidian-style topic graph rendered with Cytoscape. Node size scales with the
// number of chunks in the topic; edges show centroid similarity between topics.
export default function MindMap() {
  const containerRef = useRef<HTMLDivElement>(null);
  const cyRef = useRef<cytoscape.Core | null>(null);
  const [graph, setGraph] = useState<GraphDTO | null>(null);
  const [selected, setSelected] = useState<GraphNodeDTO | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = async () => {
    try {
      setError(null);
      setGraph(await api.getGraph());
    } catch (e: any) {
      setError(e.message);
    }
  };

  const rebuild = async () => {
    setBusy(true);
    try {
      await api.rebuildGraph();
      await load();
    } catch (e: any) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  // (Re)render the graph whenever data changes.
  useEffect(() => {
    if (!containerRef.current || !graph) return;
    cyRef.current?.destroy();
    const cy = cytoscape({
      container: containerRef.current,
      elements: [
        ...graph.nodes.map((n) => ({
          data: { id: n.id, label: n.label, size: 24 + n.size * 6 },
        })),
        ...graph.edges.map((e) => ({
          data: { source: e.source, target: e.target, weight: e.weight },
        })),
      ],
      style: [
        {
          selector: "node",
          style: {
            "background-color": "#0f62fe",
            label: "data(label)",
            color: "#161616",
            "font-size": 11,
            "text-valign": "bottom",
            "text-margin-y": 4,
            width: "data(size)",
            height: "data(size)",
          },
        },
        {
          selector: "edge",
          style: {
            "line-color": "#a6c8ff",
            width: "mapData(weight, 0.25, 1, 1, 6)",
            "curve-style": "haystack",
          },
        },
        { selector: "node:selected", style: { "background-color": "#0043ce" } },
      ],
      layout: { name: "cose", animate: false, padding: 30 },
    });
    cy.on("tap", "node", (evt) => {
      const id = evt.target.id();
      setSelected(graph.nodes.find((n) => n.id === id) ?? null);
    });
    cy.on("tap", (evt) => {
      if (evt.target === cy) setSelected(null);
    });
    cyRef.current = cy;
    return () => cy.destroy();
  }, [graph]);

  const empty = graph && graph.nodes.length === 0;

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <div>
          <h2 className="page-title">Mind Map</h2>
          <p className="page-sub">Topics clustered from your documents, linked by similarity.</p>
        </div>
        <Button size="sm" renderIcon={Renew} onClick={rebuild} disabled={busy}>
          {busy ? "Rebuilding…" : "Rebuild"}
        </Button>
      </div>

      {error && (
        <InlineNotification kind="error" title="Error" subtitle={error} style={{ marginBottom: "1rem" }} />
      )}

      {!graph && <InlineLoading description="Loading graph…" />}

      {empty && (
        <Tile>
          No topics yet. Import documents on the <strong>Documents</strong> page, then click
          <strong> Rebuild</strong>.
        </Tile>
      )}

      <div style={{ display: empty ? "none" : "flex", gap: "1rem" }}>
        <div
          ref={containerRef}
          aria-label="Topic mind map"
          style={{
            flex: 1,
            height: "60vh",
            border: "1px solid #e0e0e0",
            borderRadius: 6,
            background: "#fff",
          }}
        />
        {selected && (
          <Tile style={{ width: 280 }}>
            <h4 style={{ marginTop: 0 }}>{selected.label}</h4>
            <p style={{ fontSize: "0.85rem", color: "#525252" }}>{selected.size} passage(s)</p>
            <p style={{ fontSize: "0.9rem" }}>{selected.summary ?? "No summary."}</p>
          </Tile>
        )}
      </div>
    </div>
  );
}
