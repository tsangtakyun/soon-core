"use client";

import { useState } from "react";

type Document = {
  id: string;
  title: string;
  template_type: string | null;
  invoice_client: string | null;
  created_at: string;
};
type Client = {
  id: string;
  name: string;
  legal_name: string | null;
  contact_email: string | null;
};

export function UnmatchedDocumentsPanel({
  documents,
  clients,
  onChanged,
}: {
  documents: Document[];
  clients: Client[];
  onChanged: () => Promise<void>;
}) {
  return (
    <section className="command-panel">
      <div className="section-heading">
        <div>
          <span>文件配對</span>
          <h2>未配對文件</h2>
        </div>
        <aside>{documents.length} 份待人工確認 · 0 自動猜測</aside>
      </div>
      {documents.length ? (
        <div className="unmatched-list">
          {documents.map((document) => (
            <DocumentRow
              key={document.id}
              document={document}
              clients={clients}
              onChanged={onChanged}
            />
          ))}
        </div>
      ) : (
        <div className="empty-state">所有商業文件都有明確客戶配對</div>
      )}
      <small className="evidence">
        只接受人工選擇；文件內文字只供參考，不會使用模糊比對自動配對。
      </small>
    </section>
  );
}

function DocumentRow({
  document,
  clients,
  onChanged,
}: {
  document: Document;
  clients: Client[];
  onChanged: () => Promise<void>;
}) {
  const [clientId, setClientId] = useState(""),
    [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  async function confirm() {
    if (!clientId) return;
    setBusy(true);
    setError("");
    try {
      const response = await fetch("/api/control-tower", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          operation: "link_document_to_client",
          document_id: document.id,
          client_id: clientId,
        }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "配對失敗");
      await onChanged();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "配對失敗");
    } finally {
      setBusy(false);
    }
  }
  async function remove() {
    setBusy(true);
    setError("");
    try {
      const response = await fetch("/api/control-tower", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          operation: "delete_unmatched_document",
          document_id: document.id,
        }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "刪除失敗");
      await onChanged();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "刪除失敗");
    } finally {
      setBusy(false);
    }
  }
  return (
    <article>
      <div>
        <strong>{document.title}</strong>
        <small>
          {document.template_type?.toUpperCase()} ·{" "}
          {new Date(document.created_at).toLocaleDateString("zh-HK")}
          {document.invoice_client
            ? ` · 文件文字：${document.invoice_client}`
            : ""}
        </small>
      </div>
      <select
        aria-label={`為 ${document.title} 選擇客戶`}
        value={clientId}
        onChange={(event) => setClientId(event.target.value)}
      >
        <option value="">請人工選擇客戶</option>
        {clients.map((client) => (
          <option key={client.id} value={client.id}>
            {client.legal_name || client.name}
            {client.contact_email ? ` · ${client.contact_email}` : ""}
          </option>
        ))}
      </select>
      <div className="unmatched-actions">
        <button disabled={!clientId || busy} onClick={() => void confirm()}>
          {busy ? "處理中…" : "確認配對"}
        </button>
        <button
          className="delete"
          disabled={busy}
          onClick={() => void remove()}
        >
          刪除假文件
        </button>
      </div>
      {error && <small className="client-error">{error}</small>}
    </article>
  );
}
