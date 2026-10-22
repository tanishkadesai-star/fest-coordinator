"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { FestRequest, Session } from "@/lib/types";
import { DEPARTMENTS, MAX_REQUEST_LENGTH, validateRequestText } from "@/lib/validate";

const POLL_MS = 2000;

export default function Board({ session }: { session: Session }) {
  const [requests, setRequests] = useState<FestRequest[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [lastOk, setLastOk] = useState<Date | null>(null);
  const [stale, setStale] = useState(false);

  const [target, setTarget] = useState(session.department);
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);
  const [sendMsg, setSendMsg] = useState<{ kind: "ok" | "err"; text: string } | null>(null);

  const [claiming, setClaiming] = useState<string | null>(null);
  const [claimMsg, setClaimMsg] = useState<{ id: string; text: string } | null>(null);

  const busy = useRef(false);

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
    };
  }, [refresh]);

  async function send() {
    const problem = validateRequestText(text);
    if (problem) {
      setSendMsg({ kind: "err", text: problem });
      return;
    }
    setSending(true);
    setSendMsg(null);
    try {
      const res = await fetch("/api/requests", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          code: session.festCode,
          name: session.name,
          department: target,
          text,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setSendMsg({ kind: "err", text: data.error ?? "Couldn't send. Please try again." });
        return;
      }
      setText("");
      setSendMsg({ kind: "ok", text: `Sent to ${target}.` });
      refresh();
    } catch {
      setSendMsg({ kind: "err", text: "Couldn't send. Check your connection and try again." });
    } finally {
      setSending(false);
    }
  }

  async function claim(id: string) {
    setClaiming(id);
    setClaimMsg(null);
    try {
      const res = await fetch(`/api/requests/${id}/claim`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code: session.festCode, name: session.name }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setClaimMsg({
          id,
          text: res.status === 409 ? data.error : "Couldn't save, try again.",
        });
      }
      // Owner names only ever come from the server, via this refresh.
      await refresh();
    } catch {
      setClaimMsg({ id, text: "Couldn't save, try again." });
    } finally {
      setClaiming(null);
    }
  }

  return (
    <>
      <section className="card">
        <div>
          <h2>Send a request</h2>
          <p className="muted">It appears for everyone in that department.</p>
        </div>
        <label>
          To department
          <select value={target} onChange={(e) => setTarget(e.target.value)}>
            {DEPARTMENTS.map((d) => (
              <option key={d}>{d}</option>
            ))}
          </select>
        </label>
        <label>
          Request
          <textarea
            value={text}
            maxLength={MAX_REQUEST_LENGTH}
            placeholder="e.g. Coffee for judge 2, front row"
            onChange={(e) => setText(e.target.value)}
          />
        </label>
        {sendMsg && <div className={`notice ${sendMsg.kind}`}>{sendMsg.text}</div>}
        <div>
          <button onClick={send} disabled={sending}>
            {sending ? "Sending…" : "Send request"}
          </button>
        </div>
      </section>

      <section className="card">
        <div>
          <h2>{session.department}: requests</h2>
          {lastOk && !stale && (
            <p className="muted">Live · updated {lastOk.toLocaleTimeString()}</p>
          )}
        </div>
        {stale && (
          <div className="notice warn">
            Can&apos;t refresh right now.{" "}
            {lastOk ? `Showing the list from ${lastOk.toLocaleTimeString()}.` : "Trying again…"}
          </div>
        )}
        {loaded && requests.length === 0 && <p className="muted">No requests yet.</p>}
        {requests.map((r) => (
          <div className="request" key={r.id}>
            <p>{r.text}</p>
            <p className="muted">From {r.created_by}</p>
            {r.claimed_by ? (
              <p className="owner">{r.claimed_by} is on it</p>
            ) : (
              <div>
                <button onClick={() => claim(r.id)} disabled={claiming === r.id}>
                  {claiming === r.id ? "Saving…" : "I'm on it"}
                </button>
              </div>
            )}
            {claimMsg?.id === r.id && <div className="notice err">{claimMsg.text}</div>}
          </div>
        ))}
      </section>
    </>
  );
}
