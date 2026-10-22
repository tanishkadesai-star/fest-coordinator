"use client";

import { useState } from "react";
import type { Plan } from "@/lib/types";
import { FEST_TYPES, validatePlanInput, type PlanInput } from "@/lib/validate";

type Shown = { plan: Plan; input: PlanInput };

export default function PlanPanel() {
  const [festType, setFestType] = useState(FEST_TYPES[0]);
  const [days, setDays] = useState("2");
  const [attendance, setAttendance] = useState("");
  const [highlights, setHighlights] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [shown, setShown] = useState<Shown | null>(null);

  async function generate() {
    const input: PlanInput = {
      festType,
      days: Number(days),
      attendance: Number(attendance),
      highlights,
    };
    const problem = validatePlanInput(input);
    if (problem) {
      setError(problem);
      return;
    }
    setError(null);
    setShown(null); // never leave an old plan on screen next to a new request
    setLoading(true);
    try {
      const res = await fetch("/api/plan", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(input),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.plan) {
        setError(data.error ?? "Couldn't generate a plan. Please try again.");
      } else {
        setShown({ plan: data.plan, input });
      }
    } catch {
      setError("Couldn't reach the server. Check your connection and try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <section className="card">
      <div>
        <h2>1. Plan your fest</h2>
        <p className="muted">Describe the fest once and get a draft plan for each department.</p>
      </div>

      <div className="row">
        <label>
          Fest type
          <select value={festType} onChange={(e) => setFestType(e.target.value)}>
            {FEST_TYPES.map((t) => (
              <option key={t}>{t}</option>
            ))}
          </select>
        </label>
        <label>
          Number of days
          <select value={days} onChange={(e) => setDays(e.target.value)}>
            <option>1</option>
            <option>2</option>
            <option>3</option>
          </select>
        </label>
      </div>
      <label>
        Expected attendance
        <input
          inputMode="numeric"
          placeholder="e.g. 800"
          value={attendance}
          onChange={(e) => setAttendance(e.target.value)}
        />
      </label>
      <label>
        Highlights
        <textarea
          placeholder="e.g. Battle of bands, 24-hour hackathon, food stalls, a celebrity guest"
          value={highlights}
          onChange={(e) => setHighlights(e.target.value)}
        />
      </label>

      {error && <div className="notice err">{error}</div>}

      <div>
        <button onClick={generate} disabled={loading}>
          {loading ? "Planning… (up to 30 seconds)" : shown ? "Regenerate" : "Generate plan"}
        </button>
      </div>

      {shown && (
        <div className="plan">
          <div className="notice warn">AI draft. Please review before using.</div>
          <p className="muted">
            Plan for: {shown.input.days}-day {shown.input.festType.toLowerCase()} fest ·{" "}
            {shown.input.attendance} people · {shown.input.highlights.trim()}
          </p>
          <div className="notice ok">
            Structure checked: {shown.plan.departments.length} departments, 3–5 tasks each, days 1–
            {shown.input.days}. (Quality is not checked, so please read it.)
          </div>
          {shown.plan.departments.map((d) => (
            <div className="dept" key={d.name}>
              <h2>{d.name}</h2>
              {d.tasks.map((t, i) => (
                <div className="task" key={i}>
                  <span className="day">Day {t.day}</span>
                  <span>{t.title}</span>
                </div>
              ))}
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
