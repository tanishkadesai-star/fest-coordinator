"use client";

import { useEffect, useRef, useState } from "react";
import { postJson } from "@/lib/api";
import { colourVar } from "@/lib/colours";
import type { Session } from "@/lib/types";
import { DEPARTMENTS, validateDepartment, validateName } from "@/lib/validate";

type Role = "volunteer" | "head" | "organiser";

const ROLES: { id: Role; label: string }[] = [
  { id: "volunteer", label: "Volunteer" },
  { id: "head", label: "Department head" },
  { id: "organiser", label: "Organiser" },
];

export default function JoinScreen({ onBack, onJoined }: { onBack: () => void; onJoined: (s: Session) => void }) {
  const [role, setRole] = useState<Role>("volunteer");
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
      (code.length === 6 ? null : role === "volunteer" ? "The fest code has 6 characters." : "Your access code has 6 characters.") ??
      validateName(name) ??
      (role === "volunteer" ? validateDepartment(department) : null);
    if (problem) return setError(problem);
    setError(null);
    setLoading(true);
    // Volunteers use the fest code. Heads and the organiser use the access code they were given.
    const res =
      role === "volunteer"
        ? await postJson("/api/join", { code, name, department })
        : await postJson("/api/login", { accessCode: code, name });
    setLoading(false);
    if (!res.ok || !res.data.code || !res.data.token) return setError(res.data.error ?? "Couldn't log in. Please try again.");
    onJoined({
      festCode: res.data.code,
      name: name.trim(),
      department: res.data.department,
      isOrganiser: !!res.data.isOrganiser,
      isHead: !!res.data.isHead,
      token: res.data.token,
    });
  }

  const colourFor = role === "volunteer" ? department : DEPARTMENTS[0];

  return (
    <div className="screen">
      <div>
        <button className="pill" onClick={onBack}>← Back</button>
      </div>
      <h1 className="display title" style={{ margin: 0 }}>Log in</h1>

      <div className="roles" role="tablist" aria-label="Log in as">
        {ROLES.map((r) => (
          <button
            key={r.id}
            role="tab"
            aria-selected={role === r.id}
            className={role === r.id ? "on" : ""}
            onClick={() => {
              setRole(r.id);
              setError(null);
            }}
          >
            {r.label}
          </button>
        ))}
      </div>

      <div className="stack">
        <label className="label" htmlFor="code">
          {role === "volunteer" ? "Fest code" : role === "head" ? "Your department head code" : "Your organiser code"}
        </label>
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
        {role !== "volunteer" && (
          <span className="hint">
            {role === "head"
              ? "The organiser gives each department head their own code."
              : "Shown when you created the fest. It gets you back in as organiser."}
          </span>
        )}
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
      {role === "volunteer" && (
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
      )}
      {error && <div className="note err" role="alert" ref={errorRef}>{error}</div>}
      <button className="btn colour spacer" style={colourVar(colourFor)} onClick={join} disabled={loading}>
        {loading
          ? "Logging in…"
          : role === "volunteer"
            ? `Join ${department}`
            : role === "head"
              ? "Log in as department head"
              : "Log in as organiser"}
      </button>
    </div>
  );
}
