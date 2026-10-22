"use client";

import { useState } from "react";
import { colourVar } from "@/lib/colours";
import { dayTag, phaseNames } from "@/lib/overview";
import type { Plan } from "@/lib/types";
import type { PlanInput } from "@/lib/validate";

// The organiser's review step: the AI's plan, with a footer to redraft or use it.
export default function DraftScreen({
  plan,
  input,
  backLabel,
  onBack,
  step,
  footer,
}: {
  plan: Plan;
  input: PlanInput;
  backLabel: string;
  onBack: () => void;
  step?: string;
  footer?: React.ReactNode;
}) {
  const [phase, setPhase] = useState(-1); // -1 means every phase
  const phases = phaseNames(input.days); // Preparation, Day 1.., Wrap-up
  const shown = plan.departments
    .map((d) => ({ ...d, tasks: d.tasks.filter((t) => phase < 0 || t.day === phase) }))
    .filter((d) => d.tasks.length);
  const total = plan.departments.reduce((s, d) => s + d.tasks.length, 0);

  return (
    <div style={{ flex: 1, display: "flex", flexDirection: "column" }}>
      <div className="plan-head">
        <div className="row">
          <button className="pill" onClick={onBack}>{backLabel}</button>
          {step && <span className="mono">{step}</span>}
        </div>
        <div className="stack" style={{ gap: 6 }}>
          <h1 className="display title" style={{ margin: 0 }}>Your draft plan</h1>
          <span className="mono" style={{ fontWeight: 400, textTransform: "uppercase" }}>
            {input.festType} · {input.days} day{input.days > 1 ? "s" : ""} · {input.attendance} people · {total} tasks
          </span>
        </div>
        <p className="note">
          Written by AI. The format has been checked. The content hasn&apos;t, so read it before you share.
        </p>
        <div className="chips" style={{ gap: 6 }}>
          {["All", ...phases].map((label, i) => (
            <button
              key={label}
              className={`chip plainchip tight${phase === i - 1 ? " on" : ""}`}
              onClick={() => setPhase(i - 1)}
            >
              {label}
            </button>
          ))}
        </div>
      </div>
      <div className="plan-list">
        {shown.map((d) => (
          <div className="dept-card" key={d.name} style={colourVar(d.name)}>
            <div className="dept-name">
              <i />
              {d.name}
            </div>
            {d.tasks.map((t, i) => (
              <div className="task" key={i}>
                <span>{dayTag(t.day, input.days)}</span>
                <span>{t.title}</span>
              </div>
            ))}
          </div>
        ))}
      </div>
      {footer && <div className="footer">{footer}</div>}
    </div>
  );
}
