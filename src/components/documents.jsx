import React, { useState, useRef } from 'react';
import { uid, kb, MAX_FILE, ALLOWED_MIME, DOC_LABEL } from '../lib/utils.js';
import { uploadDocument, documentUrl } from '../lib/db.js';

// Загрузка и просмотр документов психолога.
// Файлы хранятся в приватном бакете Supabase Storage; в БД — только ключ объекта.

export function DocUploader({ docs, setDocs, note }) {
  const [type, setType] = useState("DIPLOMA");
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);
  const ref = useRef(null);

  const pick = async (e) => {
    const file = e.target.files && e.target.files[0];
    e.target.value = "";
    if (!file) return;
    if (!ALLOWED_MIME.includes(file.type)) return setErr("Подходят только PDF, JPG и PNG");
    if (file.size > MAX_FILE) return setErr(`Файл ${kb(file.size)} — больше лимита в 3 МБ`);
    setErr(""); setBusy(true);
    try {
      const id = uid();
      await uploadDocument(id, file);
      setDocs([...docs, { id, type, fileName: file.name, mimeType: file.type, size: file.size, storageKey: id }]);
    } catch { setErr("Не удалось сохранить файл. Попробуйте ещё раз."); }
    setBusy(false);
  };

  return (
    <div className="stack">
      <div>
        <span className="tiny">Тип документа</span>
        <div className="row" style={{ flexWrap: "wrap", gap: 6, marginTop: 8 }}>
          {Object.entries(DOC_LABEL).map(([k, l]) => (
            <button key={k} className={"chip" + (type === k ? " on" : "")} onClick={() => setType(k)}>{l}</button>
          ))}
        </div>
      </div>
      <input ref={ref} type="file" accept=".pdf,.jpg,.jpeg,.png" onChange={pick} style={{ display: "none" }} />
      <button className="btn ghost" disabled={busy} onClick={() => ref.current && ref.current.click()}>
        {busy ? "Загружаю…" : `Выбрать файл · ${DOC_LABEL[type].toLowerCase()}`}
      </button>
      <p className="tiny">{note || "PDF, JPG или PNG, до 3 МБ. Документы видит только администратор — студентам они не показываются."}</p>
      {err && <p className="tiny" style={{ color: "var(--ochre)" }}>{err}</p>}
      {docs.map((d) => (
        <div key={d.id} className="card between">
          <div style={{ flex: 1, minWidth: 0 }}>
            <p style={{ fontSize: 14, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{d.fileName}</p>
            <p className="tiny">{DOC_LABEL[d.type]} · {kb(d.size || 0)}</p>
          </div>
          <button className="link" onClick={() => setDocs(docs.filter((x) => x.id !== d.id))}>Удалить</button>
        </div>
      ))}
    </div>
  );
}

export function DocItem({ doc }) {
  const [url, setUrl] = useState(null);
  const [open, setOpen] = useState(false);
  const [err, setErr] = useState("");

  const show = async () => {
    if (open) return setOpen(false);
    if (!url) {
      const u = await documentUrl(doc.storage_key || doc.storageKey);
      if (!u) { setErr("Файл недоступен"); return; }
      setUrl(u);
    }
    setOpen(true);
  };

  return (
    <div className="card">
      <div className="between">
        <div style={{ flex: 1, minWidth: 0 }}>
          <p style={{ fontSize: 14, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{doc.file_name || doc.fileName}</p>
          <p className="tiny">{DOC_LABEL[doc.type] || doc.type}{(doc.size_bytes || doc.size) ? ` · ${kb(doc.size_bytes || doc.size)}` : ""}</p>
        </div>
        <button className="btn quiet sm" onClick={show}>{open ? "Свернуть" : "Открыть"}</button>
      </div>
      {err && <p className="tiny" style={{ color: "var(--ochre)", marginTop: 8 }}>{err}</p>}
      {open && url && (
        <div style={{ marginTop: 12 }}>
          {(doc.mime_type || doc.mimeType) === "application/pdf" ? (
            <iframe title={doc.file_name || doc.fileName} src={url} style={{ width: "100%", height: 420, border: "1px solid var(--line)" }} />
          ) : (
            <img alt={doc.file_name || doc.fileName} src={url} style={{ width: "100%", border: "1px solid var(--line)" }} />
          )}
        </div>
      )}
    </div>
  );
}
