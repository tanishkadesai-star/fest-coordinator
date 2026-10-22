"use client";

import { useEffect, useRef, useState } from "react";
import { postJson } from "@/lib/api";
import { colourVar } from "@/lib/colours";
import type { Session } from "@/lib/types";
import { DEPARTMENTS, validateDepartment, validateName } from "@/lib/validate";

export default function JoinScreen({ onBack, onJoined }: { onBack: () => void; onJoined: (s: Session) => void }) {
  const [code, setCode] = useState("");
  const [name, setName] = useState("");
  const [department, setDepartment] = useState(DEPARTMENTS[1]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const errorRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (error) errorRef.current?.scrollIntoView({ block: "center", behavior: "smooth" });
  }, [error]);

  async function join() {
    const problem =
      (code.length === 6 ? null : "The fest code has 6 characters.") ??
      validateName(name) ??
      validateDepartment(department);
    if (problem) return setError(problem);
    setError(null);
    setLoading(true);
    const res = await postJson("/api/join", { code, name, department });
    setLoading(false);
    if (!res.ok || !res.data.code) return setError(res.data.error ?? "Couldn't join. Please try again.");
    onJoined({ festCode: res.data.code, name: name.trim(), department, isOrganiser: false });
  }

  return (
    <div className="screen">
      <div>
        <button className="pill" onClick={onBack}>← Back</button>
      </div>
      <h1 className="display title" style={{ margin: 0 }}>Join your fest</h1>
      <div className="stack">
        <label className="label" htmlFor="code">Fest code</label>
        <input
          id="code"
          className="input code"
          value={code}
          maxLength={6}
          placeholder="K7QM2X"
          autoCapitalize="characters"
          autoComplete="off"
          onChange={(e) => setCode(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, ""))}
        />
      </div>
      <div className="stack">
        <label className="label" htmlFor="name">Your name</label>
        <input
          id="name"
          className="input"
          value={name}
          maxLength={30}
          placeholder="How your team knows you"
          onChange={(e) => setName(e.target.value)}
        />
      </div>
      <div className="stack">
        <span className="label">Your department</span>
        <div className="chips grid">
          {DEPARTMENTS.map((d) => (
            <button
              key={d}
              className={`chip${department === d ? " on" : ""}`}
              style={colourVar(d)}
              onClick={() => setDepartment(d)}
            >
              {d}
            </button>
          ))}
        </div>
      </div>
      {error && <div className="note err" role="alert" ref={errorRef}>{error}</div>}
      <button className="btn colour spacer" style={colourVar(department)} onClick={join} disabled={loading}>
        {loading ? "Joining…" : `Join ${department}`}
      </button>
    </div>
  );
}
