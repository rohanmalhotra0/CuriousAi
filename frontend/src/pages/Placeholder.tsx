import { Tile } from "@carbon/react";

export default function Placeholder({ title, detail }: { title: string; detail: string }) {
  return (
    <div>
      <h2 className="page-title">{title}</h2>
      <p className="page-sub">{detail}</p>
      <Tile>
        This module is scaffolded and on the roadmap. The data model, services, and API
        contract for it already exist — see <code>ARCHITECTURE.md</code>.
      </Tile>
    </div>
  );
}
