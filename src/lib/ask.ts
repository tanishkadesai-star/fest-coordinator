// Plain-code side of "Ask CueBoard": works out what data each person's question may use,
// and checks the AI's answer before anyone sees it. No AI and no database calls in here.
// Type-only imports keep this file runnable directly with Node in the test script.
import type { Overview } from "./types";
import type { TeamStats } from "./report";

export type Caller = { name: string; department: string; isOrganiser: boolean; isHead: boolean };
export type RequestInfo = { id: string; department: string; text: string; location: string | null; created_by: string; claimed_by: string | null };
export type FileInfo = { id: string; title: string; category: string; audience: string; department: string | null; uploaded_by: string };

export type RefKind = "task" | "person" | "request" | "file";
export type Ref = { kind: RefKind; id: string; label: string; department: string | null };

const tag = (day: number, days: number | null) => (day === 0 ? "Prep" : days && day === days + 1 ? "Wrap-up" : `Day ${day}`);

export const MAX_QUESTION_LENGTH = 300;
const MAX_REQUESTS = 60;

export type AskContext = Record<string, unknown>;
export type Built = { context: AskContext; refs: Map<string, Ref> };

// Only what this person can already see in the app goes to the AI. Volunteers get no workload
// comparisons and no other department's requests, heads get their own department's workload,
// and the organiser gets everything. Codes and tokens are never included.
export function buildAskContext(a: {
  overview: Overview;
  caller: Caller;
  requests: RequestInfo[];
  files: FileInfo[];
  stats: TeamStats | null;
}): Built {
  const { overview: o, caller } = a;
  const refs = new Map<string, Ref>();
  const addRef = (r: Ref) => refs.set(`${r.kind}:${r.id}`, r);
  const personId = (dept: string, name: string) => `${dept}:${name}`;

  const tasks = o.departments.flatMap((d) =>
    d.tasks.map((t) => {
      addRef({ kind: "task", id: t.key, label: t.title, department: d.name });
      return {
        id: t.key,
        department: d.name,
        phase: tag(t.day, o.days),
        title: t.title,
        status: t.done ? "done" : t.claimedBy ? "taken" : "open",
        owner: t.claimedBy,
      };
    })
  );

  const departments = o.departments.map((d) => ({
    name: d.name,
    tasksTotal: d.total,
    tasksDone: d.done,
    tasksNobodyHasTaken: d.tasks.filter((t) => !t.claimedBy).length,
    percentDone: d.percent,
    people: d.members
      .filter((m) => !m.isOrganiser)
      .map((m) => {
        const id = personId(d.name, m.name);
        addRef({ kind: "person", id, label: m.name, department: d.name });
        return { id, name: m.name, isDepartmentHead: m.isHead };
      }),
  }));

  const requests = a.requests
    .filter((r) => caller.isOrganiser || r.department === caller.department)
    .slice(0, MAX_REQUESTS)
    .map((r) => {
      addRef({ kind: "request", id: r.id, label: r.text, department: r.department });
      return {
        id: r.id,
        department: r.department,
        text: r.text,
        location: r.location,
        from: r.created_by,
        status: r.claimed_by ? "taken" : "open",
        takenBy: r.claimed_by,
      };
    });

  const files = a.files
    .filter((f) => caller.isOrganiser || f.audience === "everyone" || f.department === caller.department)
    .map((f) => {
      addRef({ kind: "file", id: f.id, label: f.title, department: null });
      return { id: f.id, title: f.title, kind: f.category, audience: f.audience === "everyone" ? "everyone" : `${f.department} only`, publishedBy: f.uploaded_by };
    });

  // Workload comparisons: the organiser sees all, a head sees their own department, volunteers see none.
  const workload =
    a.stats && (caller.isOrganiser || caller.isHead)
      ? a.stats.departments
          .filter((d) => caller.isOrganiser || d.name === caller.department)
          .map((d) => ({
            department: d.name,
            tasksNobodyHasTaken: d.untaken,
            people: d.members.map((m) => ({
              id: personId(d.name, m.name),
              name: m.name,
              tasksDone: m.planDone,
              tasksInProgress: m.planInProgress,
              requestsTaken: m.requestsTaken,
              belowTeammates: m.belowTeammates,
            })),
          }))
      : undefined;

  // "What should I do next" is worked out here, so the AI doesn't have to sort finished and taken tasks itself.
  const phaseNowTag = o.hasPlan ? tag(o.phase, o.days) : null;
  const yourTasks = tasks.filter((t) => t.owner === caller.name && t.department === caller.department);
  const yourTasksNotDoneYet = yourTasks.filter((t) => t.status !== "done");
  const openTasksYouCouldTakeNow = caller.isOrganiser
    ? []
    : tasks.filter((t) => t.department === caller.department && t.status === "open" && t.phase === phaseNowTag).slice(0, 8);

  const role = caller.isOrganiser ? "organiser" : caller.isHead ? "department head" : "volunteer";
  const context: AskContext = {
    fest: {
      phaseNow: o.phaseLabel || "no plan saved",
      hasPlan: o.hasPlan,
      organiser: o.organisers,
      // Tells the AI what it can't see, so it never says "none" when the truth is "not visible to you".
      requestsYouCanSee: caller.isOrganiser ? "all departments" : `only ${caller.department}'s`,
      filesYouCanSee: caller.isOrganiser ? "all files" : `files for everyone and ${caller.department}-only files`,
    },
    you: {
      name: caller.name,
      role,
      department: caller.isOrganiser ? null : caller.department,
      yourTasks,
      yourTasksNotDoneYet,
      openTasksYouCouldTakeNow,
    },
    departments,
    tasks,
    requests,
    files,
    ...(workload ? { workload } : {}),
  };
  return { context, refs };
}

// Every whole number the AI may quote: numbers in the data, but not the ids and keys (which are just labels).
function allowedNumbers(value: unknown, into = new Set<string>(), skip = false): Set<string> {
  if (typeof value === "number") into.add(String(value));
  else if (typeof value === "string") {
    if (!skip) for (const n of value.match(/\d+/g) ?? []) into.add(n);
  } else if (Array.isArray(value)) value.forEach((v) => allowedNumbers(v, into, skip));
  else if (value && typeof value === "object") {
    for (const [k, v] of Object.entries(value)) allowedNumbers(v, into, k === "id" || k === "key");
  }
  return into;
}

const KINDS: RefKind[] = ["task", "person", "request", "file"];

export type AnswerCheck = { ok: true; answer: string; references: Ref[] } | { ok: false; reason: string };

// Rejects an answer that cites something that doesn't exist or quotes a number that isn't in the data.
// Nothing is repaired: a bad answer is simply not shown.
export function validateAnswer(raw: unknown, built: Built, question: string): AnswerCheck {
  const fail = (reason: string): AnswerCheck => ({ ok: false, reason });
  const r = raw as { answer?: unknown; references?: unknown } | null;
  if (!r || typeof r.answer !== "string" || r.answer.trim() === "" || r.answer.length > 1200) return fail("no usable answer");
  const list = r.references ?? [];
  if (!Array.isArray(list) || list.length > 8) return fail("references are not a short list");

  const references: Ref[] = [];
  for (const item of list) {
    const o = item as { kind?: unknown; id?: unknown } | null;
    if (!o || !KINDS.includes(o.kind as RefKind) || typeof o.id !== "string") return fail("a reference is malformed");
    const found = built.refs.get(`${o.kind}:${o.id}`);
    if (!found) return fail(`it cites a ${o.kind} that doesn't exist: ${o.id}`);
    if (!references.some((x) => x.kind === found.kind && x.id === found.id)) references.push(found);
  }

  const allowed = allowedNumbers(built.context);
  for (const n of question.match(/\d+/g) ?? []) allowed.add(n);
  const invented = (r.answer.match(/\d+/g) ?? []).find((n) => !allowed.has(n));
  if (invented) return fail(`it quotes a number that isn't in the data: ${invented}`);

  return { ok: true, answer: r.answer.trim(), references };
}
