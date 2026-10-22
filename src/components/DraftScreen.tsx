"use client";

import { useState } from "react";
import { colourVar } from "@/lib/colours";
import type { Plan } from "@/lib/types";
import type { PlanInput } from "@/lib/validate";

// Shows the AI's plan. With `footer` it is the review step; without, it is a read-only view.
export default function DraftScreen({
  plan,
  input,
  backLabel,
  onBack,
  step,
  footer,
  focusDept,
}: {
  plan: Plan;
  input: PlanInput;
  backLabel: string;
  onBack: () => void;
  step?: string;
  footer?: React.ReactNode;
  focusDept?: string; // when set, this department's tasks are listed first
}) {
  const [day, setDay] = useState(0); // 0 means all days
  const days = Array.from({ length: input.days }, (_, i) => i + 1);
  const shown = plan.departments
    .map((d) => ({ ...d, tasks: d.tasks.filter((t) => !day || t.day === day) }))
    .filter((d) => d.tasks.length)
    .sort((a, b) => Number(b.name === focusDept) - Number(a.name === focusDept));

  return (
    <div style={{ flex: 1, display: "flex", flexDirection: "column" }}>
      <div className="plan-head">
        <div className="row">
          <button className="pill" onClick={onBack}>{backLabel}</button>
          {step && <span className="mono">{step}</span>}
        </div>
        <div className="stack" style={{ gap: 6 }}>
          <h1 className="display title" style={{ margin: 0 }}>{focusDept ? "The fest plan" : "Your draft plan"}</h1>
          <span className="mono" style={{ fontWeight: 400, textTransform: "uppercase" }}>
            {input.festType} · {input.days} day{input.days > 1 ? "s" : ""} · {input.attendance} people
          </span>
        </div>
        <p className="note">
          Written by AI. The format has been checked. The content hasn&apos;t, so read it before you share.
        </p>
        {days.length > 1 && (
          <div className="chips" style={{ gap: 6 }}>
            {["All days", ...days.map((d) => `Day ${d}`)].map((label, i) => (
              <button
                key={label}
                className={`chip plainchip tight${day === i ? " on" : ""}`}
                onClick={() => setDay(i)}
              >
                {label}
              </button>
            ))}
          </div>
        )}
      </div>
      <div className="plan-list">
        {shown.map((d) => (
          <div className="dept-card" key={d.name} style={colourVar(d.name)}>
            <div className="dept-name">
              <i />
              {d.name}
              {d.name === focusDept && (
                <span className="mono" style={{ marginLeft: "auto", fontSize: 11, color: "var(--c)" }}>YOUR TASKS</span>
              )}
            </div>
            {d.tasks.map((t, i) => (
              <div className="task" key={i}>
                <span>Day {t.day}</span>
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
