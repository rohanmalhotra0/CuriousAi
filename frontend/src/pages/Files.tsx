import { useEffect, useRef, useState } from "react";
import {
  Button,
  FileUploaderDropContainer,
  InlineLoading,
  InlineNotification,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableHeader,
  TableRow,
  Tag,
} from "@carbon/react";
import { TrashCan } from "@carbon/icons-react";
import type { DocumentDTO, DocumentStatus } from "@curiousai/shared";
import { api } from "../api/client";

const IN_PROGRESS: DocumentStatus[] = ["uploaded", "extracting", "embedding"];

function StatusCell({ doc }: { doc: DocumentDTO }) {
  if (doc.status === "indexed")
    return <Tag type="green">indexed · {doc.chunkCount} chunks</Tag>;
  if (doc.status === "failed")
    return <Tag type="red">failed{doc.error ? ` · ${doc.error}` : ""}</Tag>;
  return <InlineLoading description={doc.status} status="active" />;
}

export function FilesPage() {
  const [docs, setDocs] = useState<DocumentDTO[]>([]);
  const [error, setError] = useState<string | null>(null);
  const docsRef = useRef<DocumentDTO[]>([]);
  docsRef.current = docs;

  async function refresh() {
    try {
      setDocs(await api.listFiles());
    } catch (e) {
      setError((e as Error).message);
    }
  }

  useEffect(() => {
    refresh();
    // Live pipeline status: patch the matching row, or refetch if it's new.
    const off = api.onFileStatus((evt) => {
      const known = docsRef.current.some((d) => d.id === evt.documentId);
      if (!known) {
        refresh();
        return;
      }
      setDocs((prev) =>
        prev.map((d) =>
          d.id === evt.documentId
            ? {
                ...d,
                status: evt.status,
                chunkCount: evt.chunkCount || d.chunkCount,
                error: evt.error ?? d.error,
              }
            : d
        )
      );
    });
    return off;
  }, []);

  async function onAdd(files: File[]) {
    setError(null);
    try {
      const created = await api.uploadFiles(files);
      // Show new rows immediately; SSE will advance their status.
      setDocs((prev) => [...created, ...prev]);
    } catch (e) {
      setError((e as Error).message);
    }
  }

  async function onDelete(id: string) {
    try {
      await api.deleteFile(id);
      setDocs((prev) => prev.filter((d) => d.id !== id));
    } catch (e) {
      setError((e as Error).message);
    }
  }

  return (
    <div>
      <h1 className="page-title">Files</h1>
      <p className="page-sub">
        Import documents into your knowledge base. Supported: PDF, DOCX, TXT, EML, and ZIP.
      </p>

      {error && (
        <InlineNotification
          kind="error"
          title="Something went wrong"
          subtitle={error}
          onCloseButtonClick={() => setError(null)}
          style={{ marginBottom: "1rem" }}
        />
      )}

      <FileUploaderDropContainer
        accept={[".pdf", ".docx", ".txt", ".eml", ".zip"]}
        labelText="Drag and drop files here or click to upload"
        multiple
        onAddFiles={(_e: unknown, { addedFiles }: { addedFiles: File[] }) => onAdd(addedFiles)}
      />

      <TableContainer title="Your documents" style={{ marginTop: "1.5rem" }}>
        <Table>
          <TableHead>
            <TableRow>
              <TableHeader>Filename</TableHeader>
              <TableHeader>Type</TableHeader>
              <TableHeader>Size</TableHeader>
              <TableHeader>Status</TableHeader>
              <TableHeader>{""}</TableHeader>
            </TableRow>
          </TableHead>
          <TableBody>
            {docs.length === 0 && (
              <TableRow>
                <TableCell colSpan={5}>No documents yet — import some above.</TableCell>
              </TableRow>
            )}
            {docs.map((d) => (
              <TableRow key={d.id}>
                <TableCell>{d.filename}</TableCell>
                <TableCell>{shortType(d.mimeType)}</TableCell>
                <TableCell>{formatSize(d.sizeBytes)}</TableCell>
                <TableCell>
                  <StatusCell doc={d} />
                </TableCell>
                <TableCell>
                  <Button
                    kind="ghost"
                    size="sm"
                    hasIconOnly
                    iconDescription="Delete"
                    renderIcon={TrashCan}
                    disabled={IN_PROGRESS.includes(d.status)}
                    onClick={() => onDelete(d.id)}
                  />
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </TableContainer>
    </div>
  );
}

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function shortType(mime: string): string {
  const map: Record<string, string> = {
    "application/pdf": "PDF",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document": "DOCX",
    "text/plain": "TXT",
    "message/rfc822": "EML",
    "application/zip": "ZIP",
  };
  return map[mime] ?? mime;
}
