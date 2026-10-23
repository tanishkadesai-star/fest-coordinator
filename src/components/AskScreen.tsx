"use client";

import { useEffect, useRef, useState } from "react";
import { postJson } from "@/lib/api";
import { MAX_QUESTION_LENGTH, type Ref } from "@/lib/ask";
import type { Session } from "@/lib/types";

type Message = {
  q: string;
  a?: string; // the answer
  refs?: Ref[]; // the tasks, people, requests and files it is talking about
  note?: string; // "I can't find that"
  error?: string;
};

const KIND: Record<Ref["kind"], string> = { task: "Task", person: "Person", request: "Request", file: "File" };

function suggestions(s: Session): string[] {
  if (s.isOrganiser) {
    return ["Which department has the most tasks nobody has taken?", "What requests are still open?", "Where is the schedule?", "Who in each department has done the least?"];
  }
  if (s.isHead) {
    return ["Which tasks in my department are still untaken?", "Who in my team has the lightest workload?", "What requests are open for us?", "Where is the schedule?"];
  }
  return ["What should I do next?", "Which tasks in my department are still untaken?", "Who is on the hotel and cab tasks?", "Where is the schedule?"];
}

// Anyone in the fest can ask a question. The answer comes only from this fest's live data
// that the person can already see, and it links to the tasks, people and files it mentions.
export default function AskScreen({
  session,
  onBack,
  onOpenRef,
}: {
  session: Session;
  onBack: () => void;
  onOpenRef: (ref: Ref) => void;
}) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [text, setText] = useState("");
  const [asking, setAsking] = useState(false);
  const end = useRef<HTMLDivElement>(null);

  useEffect(() => {
    end.current?.scrollIntoView({ block: "end", behavior: "smooth" });
  }, [messages, asking]);

  async function ask(question: string) {
    const q = question.trim();
    if (!q || asking) return;
    // The last few answered questions give a follow-up like "and who is doing that?" something to refer to.
    const history = messages.filter((m) => m.a).slice(-3).map((m) => ({ q: m.q, a: m.a }));
    setMessages((m) => [...m, { q }]);
    setText("");
    setAsking(true);
    const res = await postJson(`/api/fest/${session.festCode}/ask`, { name: session.name, token: session.token, question: q, history });
    setAsking(false);
    setMessages((all) => {
      const last = all[all.length - 1];
      const done: Message = res.ok
        ? res.data.cannotAnswer
          ? { ...last, note: res.data.message }
          : { ...last, a: res.data.answer, refs: res.data.references }
        : { ...last, error: res.data.error ?? "Couldn't answer. Please try again." };
      return [...all.slice(0, -1), done];
    });
  }

  return (
    <div className="screen" style={{ paddingBottom: 0 }}>
      <div className="row">
        <button className="pill small" onClick={onBack}>← Overview</button>
        <span className="mono" style={{ fontSize: 12 }}>{session.festCode}</span>
        <span style={{ width: 86 }} />
      </div>

      <div className="stack">
        <h1 className="display title" style={{ margin: 0 }}>Ask CueBoard</h1>
        <p className="sub">
          Ask about tasks, teams, requests and files. It only uses this fest&apos;s live data that you can already see, and it can still
          be wrong, so check the linked items.
        </p>
      </div>

      {messages.length === 0 && (
        <div className="stack" style={{ gap: 10 }}>
          <span className="label">Try asking</span>
          <div className="chips">
            {suggestions(session).map((s) => (
              <button key={s} className="chip plainchip tight" onClick={() => ask(s)} disabled={asking}>
                {s}
              </button>
            ))}
          </div>
        </div>
      )}

      <div className="chat" aria-live="polite">
        {messages.map((m, i) => (
          <div className="turn" key={i}>
            <div className="bubble q">{m.q}</div>
            {m.a && (
              <div className="bubble a">
                <span className="mono" style={{ fontSize: 11 }}>AI ANSWER FROM THE LIVE DATA</span>
                <span className="answer-text">{m.a}</span>
                {m.refs && m.refs.length > 0 && (
                  <div className="chips" style={{ gap: 6 }}>
                    {m.refs.map((r) => (
                      <button key={`${r.kind}:${r.id}`} className="ref" onClick={() => onOpenRef(r)}>
                        <b>{KIND[r.kind]}</b> {r.label}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}
            {m.note && <div className="note">{m.note}</div>}
            {m.error && <div className="note err" role="alert">{m.error}</div>}
            {!m.a && !m.note && !m.error && <div className="note" role="status">Looking through the live data…</div>}
          </div>
        ))}
        <div ref={end} />
      </div>

      <form
        className="ask-bar"
        onSubmit={(e) => {
          e.preventDefault();
          ask(text);
        }}
      >
        <textarea
          className="ask-input"
          rows={2}
          maxLength={MAX_QUESTION_LENGTH}
          placeholder="Ask a question…"
          aria-label="Your question"
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              ask(text);
            }
          }}
        />
        <button className="btn" type="submit" disabled={asking || !text.trim()}>
          {asking ? "…" : "Ask"}
        </button>
      </form>
    </div>
  );
}
