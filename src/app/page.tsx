"use client";

import { useState } from "react";
import BoardScreen from "@/components/BoardScreen";
import CodeScreen from "@/components/CodeScreen";
import DescribeScreen, { emptyForm, type DescribeForm } from "@/components/DescribeScreen";
import DraftScreen from "@/components/DraftScreen";
import JoinScreen from "@/components/JoinScreen";
import WelcomeScreen from "@/components/WelcomeScreen";
import { postJson, requestPlan } from "@/lib/api";
import type { Plan, Session } from "@/lib/types";
import type { PlanInput } from "@/lib/validate";

type Screen = "welcome" | "join" | "describe" | "draft" | "code" | "board" | "plan";
type Draft = { plan: Plan; input: PlanInput };

export default function Home() {
  const [screen, setScreen] = useState<Screen>("welcome");
  const [session, setSession] = useState<Session | null>(null);
  const [form, setForm] = useState<DescribeForm>(emptyForm);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [busy, setBusy] = useState<"redraft" | "use" | null>(null);
  const [draftError, setDraftError] = useState<string | null>(null);

  async function redraft() {
    if (!draft) return;
    setBusy("redraft");
    setDraftError(null);
    const res = await requestPlan(draft.input);
    setBusy(null);
    if (res.plan) setDraft({ plan: res.plan, input: draft.input });
    else setDraftError(res.error ?? "Couldn't generate a plan.");
  }

  // "Use this plan" is when the fest is actually created and the code is issued.
  async function useThisPlan() {
    setBusy("use");
    setDraftError(null);
    const res = await postJson("/api/fest", { name: form.name, department: form.department });
    setBusy(null);
    if (!res.ok || !res.data.code) {
      return setDraftError(res.data.error ?? "Couldn't start the fest. Please try again.");
    }
    setSession({ festCode: res.data.code, name: form.name.trim(), department: form.department, isOrganiser: true });
    setScreen("code");
  }

  function leave() {
    setSession(null);
    setScreen("welcome");
  }

  return (
    <main className="app">
      {screen === "welcome" && (
        <WelcomeScreen onJoin={() => setScreen("join")} onCreate={() => setScreen("describe")} />
      )}

      {screen === "join" && (
        <JoinScreen
          onBack={() => setScreen("welcome")}
          onJoined={(s) => {
            setSession(s);
            setScreen("board");
          }}
        />
      )}

      {screen === "describe" && (
        <DescribeScreen
          form={form}
          setForm={setForm}
          onBack={() => setScreen("welcome")}
          onDrafted={(plan, input) => {
            setDraft({ plan, input });
            setDraftError(null);
            setScreen("draft");
          }}
        />
      )}

      {screen === "draft" && draft && (
        <DraftScreen
          plan={draft.plan}
          input={draft.input}
          backLabel="← Edit"
          step="STEP 2 / 3"
          onBack={() => setScreen("describe")}
          footer={
            <>
              {draftError && <div className="note err" role="alert">{draftError}</div>}
              <div className="btn-grid split">
                <button className="btn ghost medium" onClick={redraft} disabled={busy !== null}>
                  {busy === "redraft" ? "Drafting…" : "Redraft"}
                </button>
                <button className="btn medium" onClick={useThisPlan} disabled={busy !== null}>
                  {busy === "use" ? "Starting…" : "Use this plan"}
                </button>
              </div>
            </>
          }
        />
      )}

      {screen === "code" && session && <CodeScreen code={session.festCode} onOpen={() => setScreen("board")} />}

      {screen === "board" && session && (
        <BoardScreen
          session={session}
          onLeave={leave}
          onShowPlan={session.isOrganiser && draft ? () => setScreen("plan") : undefined}
        />
      )}

      {screen === "plan" && draft && (
        <DraftScreen plan={draft.plan} input={draft.input} backLabel="← Board" onBack={() => setScreen("board")} />
      )}
    </main>
  );
}
