"use client";

import { useState } from "react";
import { postJson } from "@/lib/api";
import { colourVar } from "@/lib/colours";
import type { Overview, Session } from "@/lib/types";

export default function OverviewScreen({
  session,
  data,
  stale,
  lastOk,
  refresh,
  onOpenDept,
  onMyBoard,
  onReport,
  onPublished,
  onAccess,
  onAsk,
  onLeave,
}: {
  session: Session;
  data: Overview | null;
  stale: boolean;
  lastOk: Date | null;
  refresh: () => void;
  onOpenDept: (name: string) => void;
  onMyBoard: () => void;
  onReport: () => void;
  onPublished: () => void;
  onAccess: () => void;
  onAsk: () => void;
  onLeave: () => void;
}) {
  const [phaseError, setPhaseError] = useState<string | null>(null);
  const [settingPhase, setSettingPhase] = useState<number | null>(null);

  async function setPhase(phase: number) {
    setSettingPhase(phase);
    setPhaseError(null);
    const res = await postJson(`/api/fest/${session.festCode}/phase`, { name: session.name, token: session.token, phase });
    if (!res.ok) setPhaseError(res.data.error ?? "Couldn't change the phase. Try again.");
    await refresh();
    setSettingPhase(null);
  }

  return (
    <div className="screen">
      <div className="row">
        <button className="pill small" onClick={onLeave}>Leave</button>
        <span className="mono" style={{ fontSize: 12 }}>
          {session.festCode} · {stale ? <span style={{ color: "var(--warn)" }}>OFFLINE</span> : "LIVE"}
        </span>
        <span style={{ width: 62 }} />
      </div>

      <div className="stack" style={{ gap: 6 }}>
        <h1 className="display title" style={{ margin: 0 }}>Overview</h1>
        {data && data.organisers.length > 0 && (
          <span className="mono" style={{ fontSize: 12 }}>
            ORGANISER · {data.organisers.join(", ").toUpperCase()}
            {session.isOrganiser ? " (YOU)" : ""}
          </span>
        )}
        {session.isHead && (
          <span className="mono" style={{ fontSize: 12 }}>
            YOU · {session.name.toUpperCase()} · {session.department.toUpperCase()} HEAD
          </span>
        )}
      </div>

      <div className="nav">
        <button className="pill small" onClick={onAsk}>Ask CueBoard</button>
        <button className="pill small" onClick={onPublished}>Published</button>
        {session.isOrganiser ? (
          <>
            <button className="pill small" onClick={onReport}>Team report</button>
            <button className="pill small" onClick={onAccess}>Access codes</button>
          </>
        ) : (
          <>
            {session.isHead && (
              <button className="pill small" onClick={() => onOpenDept(session.department)}>My department</button>
            )}
            <button className="pill small" onClick={onMyBoard}>My board</button>
          </>
        )}
      </div>

      {stale && (
        <div className="note warn" role="status">
          Can&apos;t refresh right now. {lastOk ? `Showing numbers from ${lastOk.toLocaleTimeString()}.` : "Trying again…"}
        </div>
      )}

      {!data && !stale && <p className="sub" role="status">Loading the overview…</p>}

      {data && (
        <>
          {data.hasPlan ? (
            <section className="panel" aria-label="Event phase">
              <span className="mono">PHASE RIGHT NOW</span>
              <span className="display" style={{ fontSize: 34 }}>{data.phaseLabel}</span>
              <div className="steps">
                {data.phases.map((label, i) =>
                  session.isOrganiser ? (
                    <button
                      key={label}
                      className={`chip plainchip tight${i === data.phase ? " on" : ""}`}
                      onClick={() => setPhase(i)}
                      disabled={settingPhase !== null}
                      aria-pressed={i === data.phase}
                    >
                      {label}
                    </button>
                  ) : (
                    <span key={label} className={`step${i === data.phase ? " on" : ""}`}>{label}</span>
                  )
                )}
              </div>
              <span className="hint">
                {session.isOrganiser ? "Tap a phase to tell everyone where the event is." : "The organiser updates this."}
              </span>
              {phaseError && <div className="note err" role="alert">{phaseError}</div>}
            </section>
          ) : (
            <div className="note warn">
              This fest has no saved plan, so there are no tasks or phases to show. Departments and people are below.
            </div>
          )}

          {data.hasPlan && (
            <section className="panel" aria-label="Whole fest progress">
              <div className="row">
                <span className="mono">WHOLE FEST</span>
                <span className="display" style={{ fontSize: 34 }}>{data.percent ?? 0}%</span>
              </div>
              <div className="bar" role="progressbar" aria-valuenow={data.percent ?? 0} aria-valuemin={0} aria-valuemax={100}>
                <i style={{ width: `${data.percent ?? 0}%` }} />
              </div>
              <span className="hint">{data.totalDone} of {data.totalTasks} tasks done across all departments</span>
            </section>
          )}

          <div className="tiles">
            {data.departments.map((d) => (
              <button key={d.name} className="tile" style={colourVar(d.name)} onClick={() => onOpenDept(d.name)}>
                <span className="tile-name">
                  {d.name}
                  {!session.isOrganiser && d.name === session.department && <em> · {session.isHead ? "you lead" : "yours"}</em>}
                </span>
                <span className="display tile-pct">{d.percent === null ? "–" : `${d.percent}%`}</span>
                <span className="tile-sub">
                  {d.total ? `${d.done} of ${d.total} done` : `${d.members.length} ${d.members.length === 1 ? "person" : "people"}`}
                </span>
                {d.total > 0 && (
                  <span className="bar dark"><i style={{ width: `${d.percent ?? 0}%` }} /></span>
                )}
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
