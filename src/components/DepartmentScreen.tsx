"use client";

import { useState } from "react";
import { postJson } from "@/lib/api";
import { colourVar } from "@/lib/colours";
import type { OverviewDept, Session } from "@/lib/types";

export default function DepartmentScreen({
  session,
  dept,
  stale,
  refresh,
  onBack,
  onMyBoard,
}: {
  session: Session;
  dept: OverviewDept;
  stale: boolean;
  refresh: () => void;
  onBack: () => void;
  onMyBoard: () => void;
}) {
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<{ key: string; text: string } | null>(null);
  const mine = session.department === dept.name;

  async function act(key: string, action: "claim" | "done") {
    setBusy(key);
    setError(null);
    const res = await postJson(`/api/fest/${session.festCode}/tasks/${key}/${action}`, { name: session.name });
    if (!res.ok) {
      setError({ key, text: res.data.error ?? "Couldn't save, try again." });
    }
    // Names and ticks only ever come from the server, via this refresh.
    await refresh();
    setBusy(null);
  }

  return (
    <div className="screen" style={colourVar(dept.name)}>
      <div className="row">
        <button className="pill small" onClick={onBack}>← Overview</button>
        <span className="mono" style={{ fontSize: 12 }}>
          {session.festCode} · {stale ? <span style={{ color: "var(--warn)" }}>OFFLINE</span> : "LIVE"}
        </span>
        <span style={{ width: 86 }} />
      </div>

      <div className="stack" style={{ gap: 6 }}>
        <span className="mono" style={{ fontSize: 12, letterSpacing: "0.06em" }}>
          {mine ? "YOUR DEPARTMENT" : "DEPARTMENT"}
        </span>
        <h1 className="display dept-title" style={{ margin: 0 }}>{dept.name}</h1>
      </div>

      {dept.total > 0 ? (
        <section className="panel">
          <div className="row">
            <span className="mono">TASKS DONE</span>
            <span className="display" style={{ fontSize: 34, color: "var(--c)" }}>{dept.percent}%</span>
          </div>
          <div className="bar" role="progressbar" aria-valuenow={dept.percent ?? 0} aria-valuemin={0} aria-valuemax={100}>
            <i style={{ width: `${dept.percent}%` }} />
          </div>
          <span className="hint">{dept.done} of {dept.total} done · {dept.inProgress} in progress</span>
        </section>
      ) : (
        <div className="note">No plan was saved for this fest, so there are no tasks here.</div>
      )}

      {dept.tasks.length > 0 && (
        <section className="stack" style={{ gap: 10 }}>
          <h2 className="display section">Tasks</h2>
          {dept.tasks.map((t) => (
            <div className="req" key={t.key}>
              <div className="task-line">
                <span className="daytag">Day {t.day}</span>
                <span className="req-text">{t.title}</span>
              </div>
              {t.done ? (
                <span className="owner">✓ Done by {t.claimedBy === session.name ? "you" : t.claimedBy}</span>
              ) : t.claimedBy ? (
                <div className="row">
                  <span className="owner">{t.claimedBy === session.name ? "You're on it" : `${t.claimedBy} is on it`}</span>
                  {t.claimedBy === session.name && (
                    <button className="pill small" onClick={() => act(t.key, "done")} disabled={busy === t.key}>
                      {busy === t.key ? "Saving…" : "Mark done"}
                    </button>
                  )}
                </div>
              ) : mine ? (
                <button className="btn colour" onClick={() => act(t.key, "claim")} disabled={busy === t.key}>
                  {busy === t.key ? "Saving…" : "I'm on it"}
                </button>
              ) : (
                <span className="req-meta">Open · {dept.name} members can take this</span>
              )}
              {error?.key === t.key && <div className="note err" role="alert">{error.text}</div>}
            </div>
          ))}
        </section>
      )}

      <section className="stack" style={{ gap: 10 }}>
        <h2 className="display section">Who to contact</h2>
        {dept.members.length === 0 && <p className="sub">Nobody has joined {dept.name} yet.</p>}
        {dept.members.map((m) => (
          <div className="req" key={m.name}>
            <div className="row">
              <span className="req-text">{m.name}</span>
              {m.isOrganiser && <span className="mono" style={{ fontSize: 11, color: "var(--c)" }}>ORGANISER</span>}
            </div>
            {m.tasks.length === 0 ? (
              <span className="req-meta">No tasks yet</span>
            ) : (
              m.tasks.map((t, i) => (
                <div className="task-line" key={i}>
                  <span className="daytag">{t.kind === "request" ? "Request" : `Day ${t.day}`}</span>
                  <span className="roster-task">
                    {t.title}
                    {t.done && " ✓"}
                  </span>
                </div>
              ))
            )}
          </div>
        ))}
      </section>

      {mine && (
        <button className="btn colour" onClick={onMyBoard}>Open requests board</button>
      )}
    </div>
  );
}
