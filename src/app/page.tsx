"use client";

import { useState } from "react";
import BoardScreen from "@/components/BoardScreen";
import CodeScreen from "@/components/CodeScreen";
import DepartmentScreen from "@/components/DepartmentScreen";
import DescribeScreen, { emptyForm, type DescribeForm } from "@/components/DescribeScreen";
import DraftScreen from "@/components/DraftScreen";
import JoinScreen from "@/components/JoinScreen";
import AccessScreen from "@/components/AccessScreen";
import OverviewScreen from "@/components/OverviewScreen";
import PublishedScreen from "@/components/PublishedScreen";
import ReportScreen from "@/components/ReportScreen";
import WelcomeScreen from "@/components/WelcomeScreen";
import { postJson, requestPlan } from "@/lib/api";
import { clearSession, saveSession, useStoredSession } from "@/lib/session";
import type { Plan, Session } from "@/lib/types";
import { useOverview } from "@/lib/useOverview";
import { ORGANISER_DEPT, type PlanInput } from "@/lib/validate";

type Screen =
  | "welcome"
  | "join"
  | "describe"
  | "draft"
  | "code"
  | "overview"
  | "dept"
  | "board"
  | "report"
  | "published"
  | "access";
type Draft = { plan: Plan; input: PlanInput };

export default function Home() {
  const [screen, setScreen] = useState<Screen>("welcome");
  const session = useStoredSession(); // survives a refresh, so you are not logged out
  const [form, setForm] = useState<DescribeForm>(emptyForm);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [busy, setBusy] = useState<"redraft" | "use" | null>(null);
  const [draftError, setDraftError] = useState<string | null>(null);
  const [deptName, setDeptName] = useState<string | null>(null);
  const [boardDept, setBoardDept] = useState<string | null>(null);
  const [organiserCode, setOrganiserCode] = useState<string | null>(null); // shown once, when the fest is created

  // Someone who is already in a fest goes straight back to the overview.
  const view: Screen = session && (screen === "welcome" || screen === "join") ? "overview" : screen;

  // The overview numbers are kept fresh while the overview or a department is showing.
  const overview = useOverview(session?.festCode ?? null, view === "overview" || view === "dept");

  async function redraft() {
    if (!draft) return;
    setBusy("redraft");
    setDraftError(null);
    const res = await requestPlan(draft.input);
    setBusy(null);
    if (res.plan) setDraft({ plan: res.plan, input: draft.input });
    else setDraftError(res.error ?? "Couldn't generate a plan.");
  }

  // "Use this plan" is when the fest is actually created, the plan is saved for
  // everyone to read, and the code is issued. The organiser belongs to no department.
  async function useThisPlan() {
    if (!draft) return;
    setBusy("use");
    setDraftError(null);
    const res = await postJson("/api/fest", { name: form.name, plan: draft.plan, planInput: draft.input });
    setBusy(null);
    if (!res.ok || !res.data.code) {
      return setDraftError(res.data.error ?? "Couldn't start the fest. Please try again.");
    }
    saveSession({
      festCode: res.data.code,
      name: form.name.trim(),
      department: ORGANISER_DEPT,
      isOrganiser: true,
      isHead: false,
      token: res.data.token,
    });
    setOrganiserCode(res.data.organiserCode ?? null);
    setScreen("code");
  }

  function joined(s: Session) {
    saveSession(s);
    setScreen("overview");
  }

  function leave() {
    clearSession();
    setOrganiserCode(null);
    setScreen("welcome");
  }

  const openBoard = (department: string) => {
    setBoardDept(department);
    setScreen("board");
  };

  return (
    <main className="app">
      {view === "welcome" && <WelcomeScreen onJoin={() => setScreen("join")} onCreate={() => setScreen("describe")} />}

      {view === "join" && <JoinScreen onBack={() => setScreen("welcome")} onJoined={joined} />}

      {view === "describe" && (
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

      {view === "draft" && draft && (
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

      {view === "code" && session && (
        <CodeScreen code={session.festCode} organiserCode={organiserCode} onOpen={() => setScreen("overview")} />
      )}

      {view === "overview" && session && (
        <OverviewScreen
          session={session}
          data={overview.data}
          stale={overview.stale}
          lastOk={overview.lastOk}
          refresh={overview.refresh}
          onOpenDept={(name) => {
            setDeptName(name);
            setScreen("dept");
          }}
          onMyBoard={() => openBoard(session.department)}
          onReport={() => setScreen("report")}
          onPublished={() => setScreen("published")}
          onAccess={() => setScreen("access")}
          onLeave={leave}
        />
      )}

      {view === "dept" && session && overview.data && (
        <DepartmentScreen
          session={session}
          overview={overview.data}
          dept={overview.data.departments.find((d) => d.name === deptName) ?? overview.data.departments[0]}
          stale={overview.stale}
          refresh={overview.refresh}
          onBack={() => setScreen("overview")}
          onBoard={() => openBoard(deptName ?? session.department)}
        />
      )}

      {view === "board" && session && (
        <BoardScreen
          session={session}
          department={boardDept ?? (session.isOrganiser ? "Logistics" : session.department)}
          onBack={() => setScreen("overview")}
        />
      )}

      {view === "report" && session?.isOrganiser && <ReportScreen session={session} onBack={() => setScreen("overview")} />}

      {view === "published" && session && <PublishedScreen session={session} onBack={() => setScreen("overview")} />}

      {view === "access" && session?.isOrganiser && <AccessScreen session={session} onBack={() => setScreen("overview")} />}
    </main>
  );
}
