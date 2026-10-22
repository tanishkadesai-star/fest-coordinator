"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { postJson } from "@/lib/api";
import { colourVar } from "@/lib/colours";
import type { FestRequest, Session } from "@/lib/types";
import { DEPARTMENTS, MAX_REQUEST_LENGTH, validateRequestText } from "@/lib/validate";

const POLL_MS = 2000;

function ago(iso: string) {
  const mins = Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 60000));
  return mins === 0 ? "just now" : `${mins} min ago`;
}

export default function BoardScreen({
  session,
  onLeave,
  onShowPlan,
}: {
  session: Session;
  onLeave: () => void;
  onShowPlan?: () => void;
}) {
  const [requests, setRequests] = useState<FestRequest[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [lastOk, setLastOk] = useState<Date | null>(null);
  const [stale, setStale] = useState(false);
  const [tab, setTab] = useState<"open" | "on">("open");

  const [sheet, setSheet] = useState(false);
  const [target, setTarget] = useState(session.department);
  const [text, setText] = useState("");
  const [sheetErr, setSheetErr] = useState("");
  const [sending, setSending] = useState(false);

  const [claiming, setClaiming] = useState<string | null>(null);
  const [claimErr, setClaimErr] = useState<{ id: string; text: string } | null>(null);

  const [toast, setToast] = useState<string | null>(null);
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const busy = useRef(false);

  const say = useCallback((msg: string) => {
    setToast(msg);
    if (toastTimer.current) clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(null), 2800);
  }, []);

  const refresh = useCallback(async () => {
    if (busy.current) return;
    busy.current = true;
    try {
      const qs = new URLSearchParams({ code: session.festCode, department: session.department });
      const res = await fetch(`/api/requests?${qs}`, { cache: "no-store" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setRequests(data.requests);
      setLastOk(new Date());
      setStale(false);
      setLoaded(true);
    } catch {
      setStale(true); // keep the last list, but say it is old
    } finally {
      busy.current = false;
    }
  }, [session.festCode, session.department]);

  useEffect(() => {
    const first = setTimeout(refresh, 0);
    const id = setInterval(refresh, POLL_MS);
    return () => {
      clearTimeout(first);
      clearInterval(id);
      if (toastTimer.current) clearTimeout(toastTimer.current);
    };
  }, [refresh]);

  async function send() {
    const problem = validateRequestText(text);
    if (problem) return setSheetErr(problem);
    setSending(true);
    setSheetErr("");
    const res = await postJson("/api/requests", {
      code: session.festCode,
      name: session.name,
      department: target,
      text,
    });
    setSending(false);
    if (!res.ok) return setSheetErr(res.data.error ?? "Couldn't send. Please try again.");
    setSheet(false);
    setText("");
    say(`Sent to ${target}.`);
    refresh();
  }

  async function claim(id: string) {
    setClaiming(id);
    setClaimErr(null);
    const res = await postJson(`/api/requests/${id}/claim`, { code: session.festCode, name: session.name });
    if (!res.ok) {
      setClaimErr({ id, text: res.status === 409 ? res.data.error : "Couldn't save, try again." });
    }
    // Owner names only ever come from the server, via this refresh.
    await refresh();
    setClaiming(null);
  }

  const open = requests.filter((r) => !r.claimed_by);
  const taken = requests.filter((r) => r.claimed_by);
  const list = tab === "open" ? open : taken;
  const empty =
    tab === "open"
      ? ["Nothing open", `New requests for ${session.department} land here.`]
      : ["Nobody is on anything", "Claimed requests show up here."];

  return (
    <div className="board" style={colourVar(session.department)}>
      <div className="board-bar">
        <button className="pill small" onClick={onLeave}>Leave</button>
        <span className="mono" style={{ fontSize: 12 }}>
          {session.festCode} ·{" "}
          {stale ? (
            <span style={{ color: "var(--warn)" }}>OFFLINE</span>
          ) : (
            "LIVE"
          )}
        </span>
        {onShowPlan ? (
          <button className="pill small" onClick={onShowPlan}>Plan</button>
        ) : (
          <span style={{ width: 62 }} />
        )}
      </div>

      <div className="board-body">
        <div className="stack" style={{ gap: 4 }}>
          <span className="mono" style={{ fontSize: 12, letterSpacing: "0.06em" }}>
            YOUR DEPARTMENT · {session.name.toUpperCase()}
          </span>
          <h1 className="display dept-title" style={{ margin: 0 }}>{session.department}</h1>
        </div>

        <div className="tabs" role="tablist">
          <button role="tab" aria-selected={tab === "open"} className={`tab${tab === "open" ? " on" : ""}`} onClick={() => setTab("open")}>
            <b>{open.length}</b>
            <span>Open</span>
          </button>
          <button role="tab" aria-selected={tab === "on"} className={`tab${tab === "on" ? " on" : ""}`} onClick={() => setTab("on")}>
            <b>{taken.length}</b>
            <span>On it</span>
          </button>
        </div>

        {stale && (
          <div className="note warn" role="status">
            Can&apos;t refresh right now.{" "}
            {lastOk ? `Showing the list from ${lastOk.toLocaleTimeString()}.` : "Trying again…"}
          </div>
        )}

        {loaded && list.length === 0 && (
          <div className="empty">
            <b>{empty[0]}</b>
            <span>{empty[1]}</span>
          </div>
        )}

        {list.map((r) => {
          const mine = r.claimed_by === session.name;
          return (
            <div className="req" key={r.id}>
              <span className="req-text">{r.text}</span>
              <span className="req-meta">From {r.created_by} · {ago(r.created_at)}</span>
              {r.claimed_by ? (
                <span className="owner">{mine ? "You're on it" : `${r.claimed_by} is on it`}</span>
              ) : (
                <button className="btn colour" onClick={() => claim(r.id)} disabled={claiming === r.id}>
                  {claiming === r.id ? "Saving…" : "I'm on it"}
                </button>
              )}
              {claimErr?.id === r.id && <div className="note err" role="alert">{claimErr.text}</div>}
            </div>
          );
        })}
      </div>

      <div className="bottom">
        <button
          className="btn colour"
          onClick={() => {
            setTarget(session.department);
            setSheetErr("");
            setSheet(true);
          }}
        >
          New request
        </button>
      </div>

      {sheet && (
        <>
          <div className="backdrop" onClick={() => setSheet(false)} />
          <div className="sheet" role="dialog" aria-label="New request" style={colourVar(target)}>
            <span className="grab" />
            <div className="row">
              <span className="display" style={{ fontSize: 28 }}>New request</span>
              <button className="pill small" onClick={() => setSheet(false)}>Cancel</button>
            </div>
            <div className="stack">
              <span className="label">Send to</span>
              <div className="chips" style={{ gap: 6 }}>
                {DEPARTMENTS.map((d) => (
                  <button
                    key={d}
                    className={`chip tight${target === d ? " on" : ""}`}
                    style={colourVar(d)}
                    onClick={() => setTarget(d)}
                  >
                    {d}
                  </button>
                ))}
              </div>
            </div>
            <div className="stack" style={{ gap: 6 }}>
              <textarea
                className="area sheet-area"
                maxLength={MAX_REQUEST_LENGTH}
                placeholder="What do you need? e.g. Extension board for Stage B"
                value={text}
                onChange={(e) => {
                  setText(e.target.value);
                  setSheetErr("");
                }}
              />
              <div className="counter">
                <span role="alert">{sheetErr}</span>
                <span>{text.length} / {MAX_REQUEST_LENGTH}</span>
              </div>
            </div>
            <button className="btn colour" onClick={send} disabled={sending}>
              {sending ? "Sending…" : `Send to ${target}`}
            </button>
          </div>
        </>
      )}

      {toast && <div className="toast" role="status">{toast}</div>}
    </div>
  );
}
