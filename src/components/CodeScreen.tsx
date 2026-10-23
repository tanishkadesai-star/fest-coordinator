"use client";

import { useState } from "react";
import Palette from "./Palette";

export default function CodeScreen({
  code,
  organiserCode,
  onOpen,
}: {
  code: string;
  organiserCode: string | null;
  onOpen: () => void;
}) {
  const [note, setNote] = useState<string | null>(null);

  async function copy(text: string, label = "Copied") {
    try {
      await navigator.clipboard.writeText(text);
      setNote(label);
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
      copy(code);
    }
  }

  return (
    <div className="screen">
      <div className="row" style={{ justifyContent: "flex-end" }}>
        <span className="mono">STEP 3 / 3</span>
      </div>
      <div className="stack" style={{ gap: 10, marginTop: 24 }}>
        <h1 className="display" style={{ margin: 0, fontSize: 40 }}>Your fest is live</h1>
        <p className="sub" style={{ fontSize: 17 }}>
          Send this code to your volunteers. They pick their department when they join.
        </p>
      </div>
      <div className="code-card">
        <span className="code-big">{code}</span>
        <Palette thin />
      </div>
      <div className="btn-grid two">
        <button className="pill plain" onClick={() => copy(code)}>{note === "Copied" ? "Copied" : "Copy code"}</button>
        <button className="pill plain" onClick={share}>Share…</button>
      </div>
      {organiserCode && (
        <div className="panel">
          <span className="mono">YOUR ORGANISER CODE · KEEP IT SAFE</span>
          <div className="row">
            <span className="display" style={{ fontSize: 30, letterSpacing: "0.08em" }}>{organiserCode}</span>
            <button className="pill small" onClick={() => copy(organiserCode)}>Copy</button>
          </div>
          <span className="hint">
            If you lose this phone or log out, this code and your name get you back in as organiser. The codes for
            each department head are on the Access codes page.
          </span>
        </div>
      )}
      {note && note !== "Copied" && <div className="note warn" role="status">{note}</div>}
      <button className="btn spacer" onClick={onOpen}>Open the overview</button>
    </div>
  );
}
