"use client";

import { useState } from "react";
import Palette from "./Palette";

export default function CodeScreen({ code, onOpen }: { code: string; onOpen: () => void }) {
  const [note, setNote] = useState<string | null>(null);

  async function copy() {
    try {
      await navigator.clipboard.writeText(code);
      setNote("Copied");
    } catch {
      setNote("Couldn't copy. Select the code and copy it by hand.");
    }
    setTimeout(() => setNote(null), 2200);
  }

  async function share() {
    const text = `Join our fest on CueBoard with code ${code}`;
    if (typeof navigator.share === "function") {
      try {
        await navigator.share({ text });
      } catch {
        // The person closed the share sheet. Nothing to do.
      }
    } else {
      copy();
    }
  }

  return (
    <div className="screen">
      <div className="row" style={{ justifyContent: "flex-end" }}>
        <span className="mono">STEP 3 / 3</span>
      </div>
      <div className="stack" style={{ gap: 10, marginTop: 40 }}>
        <h1 className="display" style={{ margin: 0, fontSize: 40 }}>Your fest is live</h1>
        <p className="sub" style={{ fontSize: 17 }}>
          Send this code to your team. They pick their department when they join.
        </p>
      </div>
      <div className="code-card">
        <span className="code-big">{code}</span>
        <Palette thin />
      </div>
      <div className="btn-grid two">
        <button className="pill plain" onClick={copy}>{note === "Copied" ? "Copied" : "Copy code"}</button>
        <button className="pill plain" onClick={share}>Share…</button>
      </div>
      {note && note !== "Copied" && <div className="note warn" role="status">{note}</div>}
      <button className="btn spacer" onClick={onOpen}>Open the board</button>
    </div>
  );
}
