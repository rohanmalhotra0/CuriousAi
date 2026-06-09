import { useEffect, useState } from "react";
import {
  DataTable, Table, TableHead, TableRow, TableHeader, TableBody, TableCell,
  Button, Tag, Modal, TextInput, Dropdown, InlineNotification, Tile,
} from "@carbon/react";
import { Renew, Add, Edit, TrashCan } from "@carbon/icons-react";
import type { SkillDTO, SkillLevel, ReportDTO } from "@curiousai/shared";
import { api } from "../api/client";

const LEVELS: SkillLevel[] = ["beginner", "intermediate", "advanced"];
const levelTag = (l: SkillLevel) =>
  l === "advanced" ? "green" : l === "intermediate" ? "blue" : "gray";

interface Draft {
  id?: string;
  name: string;
  summary: string;
  level: SkillLevel;
}

export default function Skills() {
  const [skills, setSkills] = useState<SkillDTO[]>([]);
  const [report, setReport] = useState<ReportDTO | null>(null);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = async () => {
    try {
      setError(null);
      const [s, r] = await Promise.all([api.listSkills(), api.getReport()]);
      setSkills(s.skills);
      setReport(r);
    } catch (e: any) {
      setError(e.message);
    }
  };
  useEffect(() => { load(); }, []);

  const rebuild = async () => {
    setBusy(true);
    try { await api.rebuildSkills(); await load(); }
    catch (e: any) { setError(e.message); }
    finally { setBusy(false); }
  };

  const save = async () => {
    if (!draft) return;
    try {
      if (draft.id) await api.updateSkill(draft.id, { name: draft.name, summary: draft.summary, level: draft.level });
      else await api.createSkill(draft.name, draft.summary, draft.level);
      setDraft(null);
      await load();
    } catch (e: any) { setError(e.message); }
  };

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <div>
          <h2 className="page-title">Skill Profile</h2>
          <p className="page-sub">Auto-extracted from your documents. Edit, add, or remove any skill.</p>
        </div>
        <div style={{ display: "flex", gap: "0.5rem" }}>
          <Button size="sm" kind="tertiary" renderIcon={Add}
            onClick={() => setDraft({ name: "", summary: "", level: "beginner" })}>
            Add skill
          </Button>
          <Button size="sm" renderIcon={Renew} onClick={rebuild} disabled={busy}>
            {busy ? "Rebuilding…" : "Rebuild"}
          </Button>
        </div>
      </div>

      {report && (
        <Tile style={{ marginBottom: "1rem", background: "#edf5ff" }}>
          {report.message}
        </Tile>
      )}
      {error && (
        <InlineNotification kind="error" title="Error" subtitle={error}
          onCloseButtonClick={() => setError(null)} style={{ marginBottom: "1rem" }} />
      )}

      <DataTable rows={skills as any} headers={[]}>
        {() => (
          <Table aria-label="Skill profile">
            <TableHead>
              <TableRow>
                <TableHeader>Skill</TableHeader>
                <TableHeader>Level</TableHeader>
                <TableHeader>Evidence</TableHeader>
                <TableHeader>Source</TableHeader>
                <TableHeader>Actions</TableHeader>
              </TableRow>
            </TableHead>
            <TableBody>
              {skills.map((s) => (
                <TableRow key={s.id}>
                  <TableCell>
                    <strong>{s.name}</strong>
                    {s.summary && <div style={{ fontSize: "0.8rem", color: "#525252" }}>{s.summary}</div>}
                  </TableCell>
                  <TableCell><Tag type={levelTag(s.level) as any} size="sm">{s.level}</Tag></TableCell>
                  <TableCell>{s.evidenceCount}</TableCell>
                  <TableCell>
                    <Tag size="sm">{s.editedByUser ? "edited" : s.source}</Tag>
                  </TableCell>
                  <TableCell>
                    <Button kind="ghost" size="sm" hasIconOnly iconDescription="Edit" renderIcon={Edit}
                      onClick={() => setDraft({ id: s.id, name: s.name, summary: s.summary ?? "", level: s.level })} />
                    <Button kind="ghost" size="sm" hasIconOnly iconDescription="Delete" renderIcon={TrashCan}
                      onClick={async () => { await api.deleteSkill(s.id); await load(); }} />
                  </TableCell>
                </TableRow>
              ))}
              {skills.length === 0 && (
                <TableRow><TableCell colSpan={5}>No skills yet — import documents, then Rebuild.</TableCell></TableRow>
              )}
            </TableBody>
          </Table>
        )}
      </DataTable>

      {draft && (
        <Modal
          open
          modalHeading={draft.id ? "Edit skill" : "Add skill"}
          primaryButtonText="Save"
          secondaryButtonText="Cancel"
          primaryButtonDisabled={!draft.name.trim()}
          onRequestClose={() => setDraft(null)}
          onRequestSubmit={save}
        >
          <TextInput id="skill-name" labelText="Name" value={draft.name}
            onChange={(e) => setDraft({ ...draft, name: e.target.value })} style={{ marginBottom: "1rem" }} />
          <TextInput id="skill-summary" labelText="Summary" value={draft.summary}
            onChange={(e) => setDraft({ ...draft, summary: e.target.value })} style={{ marginBottom: "1rem" }} />
          <Dropdown id="skill-level" titleText="Level" label="Level"
            items={LEVELS} selectedItem={draft.level}
            onChange={({ selectedItem }: any) => setDraft({ ...draft, level: selectedItem })} />
        </Modal>
      )}
    </div>
  );
}
