import { useEffect, useState } from "react";
import {
  FileUploaderDropContainer,
  DataTable,
  Table,
  TableHead,
  TableRow,
  TableHeader,
  TableBody,
  TableCell,
  Tag,
  Button,
  InlineNotification,
} from "@carbon/react";
import { TrashCan } from "@carbon/icons-react";
import type { DocumentDTO, DocumentStatus } from "@curiousai/shared";
import { api } from "../api/client";

const STATUS_STEPS: DocumentStatus[] = ["uploaded", "extracting", "embedding", "indexed"];

function statusTag(status: DocumentStatus) {
  if (status === "failed") return <Tag type="red" size="sm">Failed</Tag>;
  if (status === "indexed") return <Tag type="green" size="sm">Indexed</Tag>;
  const step = STATUS_STEPS.indexOf(status) + 1;
  const label = status[0].toUpperCase() + status.slice(1);
  return <Tag type="blue" size="sm">{label} ({step}/4)</Tag>;
}

export default function FileManager() {
  const [docs, setDocs] = useState<DocumentDTO[]>([]);
  const [error, setError] = useState<string | null>(null);

  const refresh = () => api.listFiles().then((r) => setDocs(r.documents)).catch((e) => setError(e.message));

  useEffect(() => {
    refresh();
    // Live pipeline updates via SSE.
    const off = api.onFileStatus((evt) => {
      setDocs((prev) =>
        prev.map((d) =>
          d.id === evt.documentId
            ? { ...d, status: evt.status, chunkCount: evt.chunkCount, error: evt.error ?? null }
            : d
        )
      );
    });
    return off;
  }, []);

  async function onAdd(files: File[]) {
    setError(null);
    try {
      const res = await api.upload(files);
      setDocs((prev) => [...res.documents, ...prev]); // optimistic, then SSE drives status
    } catch (e: any) {
      setError(e.message);
    }
  }

  return (
    <div>
      <h2 className="page-title">Documents</h2>
      <p className="page-sub">
        Drag in PDFs, Word docs, text, emails (.eml), or a zip folder. Bulk import supported.
      </p>

      {error && (
        <InlineNotification
          kind="error"
          title="Upload error"
          subtitle={error}
          onCloseButtonClick={() => setError(null)}
          style={{ marginBottom: "1rem" }}
        />
      )}

      <FileUploaderDropContainer
        labelText="Drag and drop files here, or click to upload"
        multiple
        accept={[".pdf", ".docx", ".txt", ".eml", ".zip"]}
        onAddFiles={(_e: any, { addedFiles }: { addedFiles: File[] }) => onAdd(addedFiles)}
        style={{ marginBottom: "2rem", maxWidth: "100%" }}
      />

      <DataTable rows={docs as any} headers={[]} isSortable>
        {() => (
          <Table aria-label="Uploaded documents">
            <TableHead>
              <TableRow>
                <TableHeader>Name</TableHeader>
                <TableHeader>Type</TableHeader>
                <TableHeader>Chunks</TableHeader>
                <TableHeader>Status</TableHeader>
                <TableHeader>Actions</TableHeader>
              </TableRow>
            </TableHead>
            <TableBody>
              {docs.map((d) => (
                <TableRow key={d.id}>
                  <TableCell>{d.filename}</TableCell>
                  <TableCell>{d.mimeType.split("/").pop()?.toUpperCase()}</TableCell>
                  <TableCell>{d.chunkCount}</TableCell>
                  <TableCell>
                    {statusTag(d.status)}
                    {d.error && <div style={{ color: "#da1e28", fontSize: "0.75rem" }}>{d.error}</div>}
                  </TableCell>
                  <TableCell>
                    <Button
                      kind="ghost"
                      size="sm"
                      hasIconOnly
                      iconDescription="Delete"
                      renderIcon={TrashCan}
                      onClick={async () => {
                        await api.deleteFile(d.id);
                        setDocs((p) => p.filter((x) => x.id !== d.id));
                      }}
                    />
                  </TableCell>
                </TableRow>
              ))}
              {docs.length === 0 && (
                <TableRow>
                  <TableCell colSpan={5}>No documents yet — drop some files above to begin.</TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        )}
      </DataTable>
    </div>
  );
}
