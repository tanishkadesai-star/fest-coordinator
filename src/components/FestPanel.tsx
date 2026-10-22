"use client";

import { useState } from "react";
import type { Session } from "@/lib/types";
import { DEPARTMENTS } from "@/lib/validate";

// Start a new fest (organiser) or join one with a code (everyone else).
export default function FestPanel({ onJoined }: { onJoined: (s: Session) => void }) {
  const [mode, setMode] = useState<"start" | "join">("start");
  const [code, setCode] = useState("");
  const [name, setName] = useState("");
  const [department, setDepartment] = useState(DEPARTMENTS[0]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit() {
    setError(null);
    setLoading(true);
    try {
      const res = await fetch(mode === "start" ? "/api/fest" : "/api/join", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code, name, department }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.code) {
        setError(data.error ?? "Something went wrong. Please try again.");
        return;
      }
      onJoined({
        festCode: data.code,
        name: name.trim(),
        department,
        isOrganiser: mode === "start",
      });
    } catch {
      setError("Couldn't reach the server. Check your connection and try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <section className="card">
      <div>
        <h2>2. Run the fest</h2>
        <p className="muted">
          Organisers start a fest and share the code. Everyone else joins with that code and a name.
        </p>
      </div>
      <div className="row">
        <button className={mode === "start" ? "" : "secondary"} onClick={() => setMode("start")}>
          Start a fest
        </button>
        <button className={mode === "join" ? "" : "secondary"} onClick={() => setMode("join")}>
          Join with a code
        </button>
      </div>

      {mode === "join" && (
        <label>
          Fest code
          <input
            placeholder="e.g. K7QM2X"
            value={code}
            onChange={(e) => setCode(e.target.value.toUpperCase())}
          />
        </label>
      )}
      <label>
        Your name
        <input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Asha" />
      </label>
      <label>
        Your department
        <select value={department} onChange={(e) => setDepartment(e.target.value)}>
          {DEPARTMENTS.map((d) => (
            <option key={d}>{d}</option>
          ))}
        </select>
      </label>

      {error && <div className="notice err">{error}</div>}

      <div>
        <button onClick={submit} disabled={loading}>
          {loading ? "Please wait…" : mode === "start" ? "Start fest" : "Join fest"}
        </button>
      </div>
    </section>
  );
}
