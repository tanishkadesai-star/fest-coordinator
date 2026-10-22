"use client";

import { useEffect, useRef, useState } from "react";
import { requestPlan } from "@/lib/api";
import type { Plan } from "@/lib/types";
import { FEST_TYPES, MAX_DETAILS_LENGTH, validateName, validatePlanInput, type PlanInput } from "@/lib/validate";

export type DescribeForm = {
  festType: string;
  days: number;
  attendance: string;
  highlights: string;
  details: string;
  name: string;
};

export const emptyForm: DescribeForm = {
  festType: FEST_TYPES[0],
  days: 2,
  attendance: "",
  highlights: "",
  details: "",
  name: "",
};

export default function DescribeScreen({
  form,
  setForm,
  onBack,
  onDrafted,
}: {
  form: DescribeForm;
  setForm: React.Dispatch<React.SetStateAction<DescribeForm>>;
  onBack: () => void;
  onDrafted: (plan: Plan, input: PlanInput) => void;
}) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const errorRef = useRef<HTMLDivElement>(null);
  const set = (patch: Partial<DescribeForm>) => setForm((f) => ({ ...f, ...patch }));

  // The form is taller than a phone screen, so bring the message into view.
  useEffect(() => {
    if (error) errorRef.current?.scrollIntoView({ block: "center", behavior: "smooth" });
  }, [error]);

  async function draft() {
    const input: PlanInput = {
      festType: form.festType,
      days: form.days,
      attendance: Number(form.attendance),
      highlights: form.highlights,
      details: form.details,
    };
    // Cheap checks first: no AI call, no cost, until the form makes sense.
    const problem = validatePlanInput(input) ?? validateName(form.name);
    if (problem) return setError(problem);
    setError(null);
    setLoading(true);
    const res = await requestPlan(input);
    setLoading(false);
    if (!res.plan) return setError(res.error ?? "Couldn't generate a plan.");
    onDrafted(res.plan, input);
  }

  return (
    <div className="screen">
      <div className="row">
        <button className="pill" onClick={onBack}>← Back</button>
        <span className="mono">STEP 1 / 3</span>
      </div>
      <div className="stack">
        <h1 className="display title" style={{ margin: 0 }}>Describe the fest</h1>
        <p className="sub">The more you tell it, the more exact every department&apos;s tasks will be.</p>
      </div>
      <div className="stack">
        <span className="label">Type</span>
        <div className="chips">
          {FEST_TYPES.map((t) => (
            <button
              key={t}
              className={`chip plainchip${form.festType === t ? " on" : ""}`}
              onClick={() => set({ festType: t })}
            >
              {t === "Mixed / General" ? "Mixed" : t}
            </button>
          ))}
        </div>
      </div>
      <div className="two-col">
        <div className="stack">
          <span className="label">Days</span>
          <div className="segment">
            {[1, 2, 3].map((n) => (
              <button key={n} className={form.days === n ? "on" : ""} onClick={() => set({ days: n })}>
                {n}
              </button>
            ))}
          </div>
        </div>
        <div className="stack">
          <label className="label" htmlFor="people">People</label>
          <input
            id="people"
            className="input num"
            style={{ height: 48, borderRadius: 999, border: "none" }}
            inputMode="numeric"
            placeholder="800"
            value={form.attendance}
            onChange={(e) => set({ attendance: e.target.value.replace(/[^0-9]/g, "") })}
          />
        </div>
      </div>
      <div className="stack">
        <label className="label" htmlFor="events">Main events</label>
        <textarea
          id="events"
          className="area"
          maxLength={1000}
          placeholder="Battle of bands, fashion show, food stalls, a celebrity guest on day 2"
          value={form.highlights}
          onChange={(e) => set({ highlights: e.target.value })}
        />
        <span className="hint">Name the events. The draft is built around them.</span>
      </div>
      <div className="stack">
        <label className="label" htmlFor="details">Extra details (optional)</label>
        <textarea
          id="details"
          className="area"
          style={{ minHeight: 100 }}
          maxLength={MAX_DETAILS_LENGTH}
          placeholder="Chief guest arrives day 1 morning, 3 judges, guests stay at a hotel 2 km away, venues: Auditorium and Seminar Halls A to C…"
          value={form.details}
          onChange={(e) => set({ details: e.target.value })}
        />
        <span className="hint">Guests, judges, venues, timings. Tasks use these, and never invent names.</span>
      </div>
      <div className="stack">
        <label className="label" htmlFor="organiser">Your name</label>
        <input
          id="organiser"
          className="input"
          maxLength={30}
          placeholder="You'll oversee every department"
          value={form.name}
          onChange={(e) => set({ name: e.target.value })}
        />
      </div>
      {error && <div className="note err" role="alert" ref={errorRef}>{error}</div>}
      <button className="btn spacer" onClick={draft} disabled={loading}>
        {loading ? "Drafting… up to 30 seconds" : "Draft the plan"}
      </button>
    </div>
  );
}
