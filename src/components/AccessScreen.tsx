"use client";

import { useEffect, useState } from "react";
import { colourVar } from "@/lib/colours";
import type { Session } from "@/lib/types";

type Codes = { organiserCode: string | null; heads: { department: string; code: string | null }[] };

// The organiser's list of codes: one for each department head, and one to get back in as organiser.
export default function AccessScreen({ session, onBack }: { session: Session; onBack: () => void }) {
  const [codes, setCodes] = useState<Codes | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [note, setNote] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(
          `/api/fest/${session.festCode}/access?name=${encodeURIComponent(session.name)}&token=${encodeURIComponent(session.token)}`,
          { cache: "no-store" }
        );
        const json = await res.json().catch(() => ({}));
        if (cancelled) return;
        if (!res.ok) setError(json.error ?? "Couldn't load the codes. Try again.");
        else setCodes(json);
      } catch {
        if (!cancelled) setError("Couldn't load the codes. Check your connection and try again.");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [session.festCode, session.name, session.token]);

  async function copy(text: string, label: string) {
    try {
      await navigator.clipboard.writeText(text);
      setNote(`${label} copied`);
    } catch {
      setNote("Couldn't copy. Select the code and copy it by hand.");
    }
    setTimeout(() => setNote(null), 2200);
  }

  return (
    <div className="screen">
      <div className="row">
        <button className="pill small" onClick={onBack}>← Overview</button>
        <span className="mono" style={{ fontSize: 12 }}>{session.festCode}</span>
        <span style={{ width: 86 }} />
      </div>
      <div className="stack">
        <h1 className="display title" style={{ margin: 0 }}>Access codes</h1>
        <p className="sub">
          Give each department head their own code. They log in with it as &ldquo;Department head&rdquo;. Volunteers use the fest code
          instead. Share these privately.
        </p>
      </div>

      {error && <div className="note err" role="alert">{error}</div>}
      {!codes && !error && <p className="sub" role="status">Loading the codes…</p>}
      {note && <div className="note ok" role="status">{note}</div>}

      {codes && (
        <>
          <section className="panel">
            <span className="mono">FEST CODE · FOR VOLUNTEERS</span>
            <div className="code-row">
              <span className="display">{session.festCode}</span>
              <button className="pill small" onClick={() => copy(session.festCode, "Fest code")}>Copy</button>
            </div>
          </section>

          <section className="stack" style={{ gap: 10 }}>
            <h2 className="display section">Department heads</h2>
            {codes.heads.map((h) => (
              <div className="req" key={h.department} style={colourVar(h.department)}>
                <span className="owner">{h.department}</span>
                <div className="code-row">
                  <span className="display">{h.code ?? "—"}</span>
                  {h.code && (
                    <button className="pill small" onClick={() => copy(h.code!, `${h.department} code`)}>Copy</button>
                  )}
                </div>
              </div>
            ))}
          </section>

          {codes.organiserCode && (
            <section className="panel">
              <span className="mono">YOUR ORGANISER CODE · KEEP IT PRIVATE</span>
              <div className="code-row">
                <span className="display">{codes.organiserCode}</span>
                <button className="pill small" onClick={() => copy(codes.organiserCode!, "Organiser code")}>Copy</button>
              </div>
              <span className="hint">Log in as &ldquo;Organiser&rdquo; with this code and your name to get back in on a new phone.</span>
            </section>
          )}
        </>
      )}
    </div>
  );
}
