"use client";

import { useEffect, useRef, useState } from "react";
import { requestPlan } from "@/lib/api";
import { colourVar } from "@/lib/colours";
import type { Plan } from "@/lib/types";
import {
  DEPARTMENTS,
  FEST_TYPES,
  validateDepartment,
  validateName,
  validatePlanInput,
  type PlanInput,
} from "@/lib/validate";

export type DescribeForm = {
  festType: string;
  days: number;
  attendance: string;
  highlights: string;
  name: string;
  department: string;
};

export const emptyForm: DescribeForm = {
  festType: FEST_TYPES[0],
  days: 2,
  attendance: "",
  highlights: "",
  name: "",
  department: DEPARTMENTS[0],
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
    };
    // Cheap checks first: no AI call, no cost, until the form makes sense.
    const problem = validatePlanInput(input) ?? validateName(form.name) ?? validateDepartment(form.department);
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
        <p className="sub">You&apos;ll get a draft task list for all 8 departments.</p>
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
        <label className="label" htmlFor="organiser">Your name</label>
        <input
          id="organiser"
          className="input"
          maxLength={30}
          placeholder="You'll be the organiser"
          value={form.name}
          onChange={(e) => set({ name: e.target.value })}
        />
      </div>
      <div className="stack">
        <span className="label">Your department</span>
        <div className="chips">
          {DEPARTMENTS.map((d) => (
            <button
              key={d}
              className={`chip tight${form.department === d ? " on" : ""}`}
              style={colourVar(d)}
              onClick={() => set({ department: d })}
            >
              {d}
            </button>
          ))}
        </div>
      </div>
      {error && <div className="note err" role="alert" ref={errorRef}>{error}</div>}
      <button className="btn spacer" onClick={draft} disabled={loading}>
        {loading ? "Drafting… up to 30 seconds" : "Draft the plan"}
      </button>
    </div>
  );
}
