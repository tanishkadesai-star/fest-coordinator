"use client";

import { useCallback, useEffect, useState } from "react";
import { postJson } from "@/lib/api";
import { colourVar } from "@/lib/colours";
import type { TeamStats } from "@/lib/report";
import type { Session, TeamReport } from "@/lib/types";
import WorkloadTable from "./WorkloadTable";

// The organiser's team report: live workload numbers (worked out by the app) and an AI-written summary.
export default function ReportScreen({ session, onBack }: { session: Session; onBack: () => void }) {
  const [stats, setStats] = useState<TeamStats | null>(null);
  const [report, setReport] = useState<TeamReport | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [writing, setWriting] = useState(false);

  const load = useCallback(async () => {
    try {
      const res = await fetch(
        `/api/fest/${session.festCode}/report?name=${encodeURIComponent(session.name)}&token=${encodeURIComponent(session.token)}`,
        { cache: "no-store" }
      );
      const json = await res.json().catch(() => ({}));
      if (!res.ok) return setError(json.error ?? "Couldn't load the report. Try again.");
      setStats(json.stats);
      setReport(json.report);
      setError(null);
    } catch {
      setError("Couldn't load the report. Check your connection and try again.");
    }
  }, [session.festCode, session.name, session.token]);

  useEffect(() => {
    const first = setTimeout(load, 0);
    return () => clearTimeout(first);
  }, [load]);

  async function generate() {
    setWriting(true);
    setError(null);
    const res = await postJson(`/api/fest/${session.festCode}/report`, { name: session.name, token: session.token });
    setWriting(false);
    if (!res.ok) return setError(res.data.error ?? "Couldn't write the report. Try again.");
    setStats(res.data.stats);
    setReport(res.data.report);
  }

  return (
    <div className="screen">
      <div className="row">
        <button className="pill small" onClick={onBack}>← Overview</button>
        <span className="mono" style={{ fontSize: 12 }}>{session.festCode}</span>
        <span style={{ width: 86 }} />
      </div>
      <div className="stack">
        <h1 className="display title" style={{ margin: 0 }}>Team report</h1>
        <p className="sub">Who has done what, for a fair review. Only you can see this.</p>
      </div>

      {error && <div className="note err" role="alert">{error}</div>}
      {!stats && !error && <p className="sub" role="status">Loading the numbers…</p>}

      {stats && (
        <>
          <section className="panel">
            <div className="row">
              <span className="mono">RIGHT NOW · {stats.phaseLabel.toUpperCase()}</span>
              <span className="display" style={{ fontSize: 34 }}>{stats.percentDone ?? 0}%</span>
            </div>
            <span className="hint">
              {stats.totalPlanDone} of {stats.totalPlanTasks} plan tasks done · {stats.totalUntaken} nobody has taken ·{" "}
              {stats.totalPeople} {stats.totalPeople === 1 ? "person" : "people"} recorded
            </span>
          </section>

          <section className="stack" style={{ gap: 12 }}>
            <h2 className="display section">Who did what</h2>
            <p className="hint">
              Counted by the app from what people tapped. &ldquo;Below teammates&rdquo; means under half their department&apos;s average,
              compared only within the same department.
            </p>
            {stats.departments
              .filter((d) => d.people > 0 || d.planTotal > 0)
              .map((d) => (
                <div className="req" key={d.name} style={colourVar(d.name)}>
                  <div className="row">
                    <span className="owner" style={{ fontSize: 17 }}>{d.name}</span>
                    <span className="hint">{d.untaken} untaken · {d.percentDone ?? 0}% done</span>
                  </div>
                  <WorkloadTable dept={d} />
                </div>
              ))}
            <p className="hint">Done = plan tasks finished · Doing = taken, not finished · Req. = live requests taken</p>
          </section>

          <section className="stack" style={{ gap: 12 }}>
            <h2 className="display section">AI summary</h2>
            {report ? (
              <>
                <p className="note warn">
                  Written by AI from the numbers above, at {new Date(report.generatedAt).toLocaleString()} ({report.phaseLabel}). Read it
                  before you rely on it.
                </p>
                <p className="lead" style={{ fontSize: 17 }}>{report.summary}</p>
                {report.departments.map((d) => (
                  <div className="req" key={d.name} style={colourVar(d.name)}>
                    <span className="owner">{d.name}</span>
                    <span className="roster-task">{d.note}</span>
                  </div>
                ))}
                <h2 className="display section">What the counts can&apos;t show</h2>
                <ul className="bullets">
                  {report.caveats.map((c, i) => (
                    <li key={i}>{c}</li>
                  ))}
                </ul>
              </>
            ) : (
              <p className="sub">No summary yet. Write one when the event is over, or any time you want a snapshot.</p>
            )}
            <button className="btn" onClick={generate} disabled={writing}>
              {writing ? "Writing… up to 30 seconds" : report ? "Write a fresh summary" : "Write the summary"}
            </button>
          </section>
        </>
      )}
    </div>
  );
}
