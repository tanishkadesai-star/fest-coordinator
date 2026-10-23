"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { colourVar } from "@/lib/colours";
import type { PublishedFile, Session } from "@/lib/types";
import { postJson } from "@/lib/api";
import {
  ALLOWED_FILE_TYPES,
  DEPARTMENTS,
  FILE_CATEGORIES,
  MAX_TITLE_LENGTH,
  validateFileUpload,
} from "@/lib/validate";

const POLL_MS = 15000;

const size = (bytes: number) => (bytes < 1024 * 1024 ? `${Math.max(1, Math.round(bytes / 1024))} KB` : `${(bytes / 1024 / 1024).toFixed(1)} MB`);

// Files the organiser and department heads publish: schedules, attendance sheets, timetables, flow documents.
export default function PublishedScreen({ session, onBack }: { session: Session; onBack: () => void }) {
  const canPublish = session.isOrganiser || session.isHead;
  const audiences = session.isOrganiser ? DEPARTMENTS : [session.department];

  const [files, setFiles] = useState<PublishedFile[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [stale, setStale] = useState(false);

  const [title, setTitle] = useState("");
  const [category, setCategory] = useState(FILE_CATEGORIES[0]);
  const [audience, setAudience] = useState("everyone");
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [removing, setRemoving] = useState<string | null>(null);
  const picker = useRef<HTMLInputElement>(null);

  const load = useCallback(async () => {
    try {
      const res = await fetch(
        `/api/fest/${session.festCode}/files?name=${encodeURIComponent(session.name)}&token=${encodeURIComponent(session.token)}`,
        { cache: "no-store" }
      );
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(json.error ?? "Couldn't load the files. Try again.");
        return;
      }
      setFiles(json.files);
      setError(null);
      setStale(false);
    } catch {
      setStale(true); // keep what we have, but say it may be old
    }
  }, [session.festCode, session.name, session.token]);

  useEffect(() => {
    const first = setTimeout(load, 0);
    const id = setInterval(load, POLL_MS);
    return () => {
      clearTimeout(first);
      clearInterval(id);
    };
  }, [load]);

  async function publish() {
    if (!file) return setFormError("Choose a file first.");
    const problem = validateFileUpload({ title, category, fileName: file.name, size: file.size });
    if (problem) return setFormError(problem);
    setFormError(null);
    setUploading(true);
    try {
      const form = new FormData();
      form.set("name", session.name);
      form.set("token", session.token);
      form.set("title", title);
      form.set("category", category);
      form.set("audience", audience);
      form.set("file", file);
      const res = await fetch(`/api/fest/${session.festCode}/files`, { method: "POST", body: form });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) return setFormError(json.error ?? "Couldn't publish the file. Try again.");
      setTitle("");
      setFile(null);
      if (picker.current) picker.current.value = "";
      setNotice("Published.");
      setTimeout(() => setNotice(null), 2500);
      await load();
    } catch {
      setFormError("Couldn't publish the file. Check your connection and try again.");
    } finally {
      setUploading(false);
    }
  }

  async function remove(id: string) {
    setRemoving(id);
    const res = await postJson(`/api/fest/${session.festCode}/files/${id}/delete`, { name: session.name, token: session.token });
    if (!res.ok) setError(res.data.error ?? "Couldn't remove the file. Try again.");
    await load();
    setRemoving(null);
  }

  const groups = FILE_CATEGORIES.map((c) => ({ category: c, items: (files ?? []).filter((f) => f.category === c) })).filter(
    (g) => g.items.length
  );

  return (
    <div className="screen">
      <div className="row">
        <button className="pill small" onClick={onBack}>← Overview</button>
        <span className="mono" style={{ fontSize: 12 }}>
          {session.festCode} · {stale ? <span style={{ color: "var(--warn)" }}>OFFLINE</span> : "LIVE"}
        </span>
        <span style={{ width: 86 }} />
      </div>

      <div className="stack">
        <h1 className="display title" style={{ margin: 0 }}>Published</h1>
        <p className="sub">Schedules, attendance sheets, meeting times and flow documents from the organiser and department heads.</p>
      </div>

      {error && <div className="note err" role="alert">{error}</div>}

      {canPublish && (
        <section className="panel" aria-label="Publish a file">
          <span className="mono">PUBLISH A FILE</span>
          <div className="stack">
            <label className="label" htmlFor="file-title">Title</label>
            <input
              id="file-title"
              className="input"
              maxLength={MAX_TITLE_LENGTH}
              placeholder="e.g. Day 1 running order"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
            />
          </div>
          <div className="stack" style={{ gap: 14 }}>
            <div className="stack">
              <label className="label" htmlFor="file-category">Kind</label>
              <select id="file-category" className="input" value={category} onChange={(e) => setCategory(e.target.value)}>
                {FILE_CATEGORIES.map((c) => (
                  <option key={c}>{c}</option>
                ))}
              </select>
            </div>
            <div className="stack">
              <label className="label" htmlFor="file-audience">Who sees it</label>
              <select id="file-audience" className="input" value={audience} onChange={(e) => setAudience(e.target.value)}>
                <option value="everyone">Everyone</option>
                {audiences.map((d) => (
                  <option key={d} value={d}>{d} only</option>
                ))}
              </select>
            </div>
          </div>
          <div className="stack">
            <label className="label" htmlFor="file-pick">File (up to 4 MB)</label>
            <input
              id="file-pick"
              ref={picker}
              className="file-input"
              type="file"
              accept={Object.keys(ALLOWED_FILE_TYPES).map((e) => `.${e}`).join(",")}
              onChange={(e) => setFile(e.target.files?.[0] ?? null)}
            />
            <span className="hint">PDF, Word, Excel, PowerPoint, CSV, text or an image.</span>
          </div>
          {formError && <div className="note err" role="alert">{formError}</div>}
          {notice && <div className="note ok" role="status">{notice}</div>}
          <button className="btn" onClick={publish} disabled={uploading}>
            {uploading ? "Publishing…" : "Publish"}
          </button>
        </section>
      )}

      {files === null && !error && <p className="sub" role="status">Loading the files…</p>}
      {files !== null && files.length === 0 && (
        <div className="empty" style={{ padding: "24px 8px" }}>
          <b style={{ color: "var(--text)" }}>Nothing published yet</b>
          <span>{canPublish ? "Publish the first file above." : "Files from the organiser and your department head will appear here."}</span>
        </div>
      )}

      {groups.map((g) => (
        <section className="stack" style={{ gap: 10 }} key={g.category}>
          <h2 className="display section">{g.category}</h2>
          {g.items.map((f) => {
            const canRemove = session.isOrganiser || (session.isHead && f.uploadedBy === session.name);
            return (
              <div className="req file" key={f.id} style={f.department ? colourVar(f.department) : undefined}>
                <span className="file-title">{f.title}</span>
                <span className="req-meta">
                  {f.fileName} · {size(f.size)}
                </span>
                <span className="req-meta">
                  {f.uploaderRole === "organiser" ? "Organiser" : "Department head"} {f.uploadedBy} ·{" "}
                  {new Date(f.createdAt).toLocaleString([], { dateStyle: "medium", timeStyle: "short" })}
                </span>
                <span className={f.audience === "everyone" ? "req-meta" : "owner"}>
                  {f.audience === "everyone" ? "For everyone" : `${f.department} only`}
                </span>
                <div className="file-actions">
                  {f.url ? (
                    <a className="pill small" href={f.url} target="_blank" rel="noreferrer">Open</a>
                  ) : (
                    <span className="req-meta">Link unavailable. Refresh the page.</span>
                  )}
                  {canRemove && (
                    <button className="pill small" onClick={() => remove(f.id)} disabled={removing === f.id}>
                      {removing === f.id ? "Removing…" : "Remove"}
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </section>
      ))}
    </div>
  );
}
