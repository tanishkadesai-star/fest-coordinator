// Plain-code maths for the overview. No AI, no database calls, so it is easy to test.
// Type-only imports keep this file runnable directly with Node in the test script.
import type { Overview, OverviewDept, OverviewTask, Plan, RosterMember } from "./types";

export function phaseNames(days: number | null): string[] {
  if (!days) return [];
  return ["Preparation", ...Array.from({ length: days }, (_, i) => `Day ${i + 1}`), "Wrap-up"];
}

export function phaseLabel(phase: number, days: number | null): string {
  const names = phaseNames(days);
  if (!names.length) return "";
  const label = names[Math.min(Math.max(phase, 0), names.length - 1)];
  return /^Day \d+$/.test(label) ? `${label} of ${days}` : label;
}

// A task's "day" is 0 for Preparation, 1..days for event days, days + 1 for Wrap-up.
export function dayTag(day: number | null, days: number | null): string {
  if (day === null) return "Request";
  if (day === 0) return "Prep";
  if (days && day === days + 1) return "Wrap-up";
  return `Day ${day}`;
}

export const taskKey =(deptIndex: number, taskIndex: number) => `${deptIndex}-${taskIndex}`;

export function parseTaskKey(key: string): { dept: number; task: number } | null {
  const m = /^(\d+)-(\d+)$/.exec(key);
  return m ? { dept: Number(m[1]), task: Number(m[2]) } : null;
}

export type StatusRow = { task_key: string; claimed_by: string; done: boolean };
export type MemberRow = { name: string; department: string; is_organiser: boolean };
export type RequestRow = { department: string; text: string; claimed_by: string | null };

export function computeOverview(args: {
  departments: string[];
  plan: Plan | null;
  days: number | null;
  phase: number;
  statuses: StatusRow[];
  members: MemberRow[];
  requests: RequestRow[];
}): Overview {
  const { departments, plan, days, statuses, members, requests } = args;
  const byKey = new Map(statuses.map((s) => [s.task_key, s]));
  let totalDone = 0;
  let totalTasks = 0;

  const depts: OverviewDept[] = departments.map((name) => {
    const planIndex = plan ? plan.departments.findIndex((d) => d.name === name) : -1;
    const tasks: OverviewTask[] =
      planIndex >= 0
        ? plan!.departments[planIndex].tasks.map((t, i) => {
            const s = byKey.get(taskKey(planIndex, i));
            return { key: taskKey(planIndex, i), title: t.title, day: t.day, claimedBy: s?.claimed_by ?? null, done: !!s?.done };
          })
        : [];

    // One row per person, even if they joined twice. The organiser flag wins.
    const people = new Map<string, RosterMember>();
    for (const m of members.filter((m) => m.department === name)) {
      const existing = people.get(m.name);
      if (existing) existing.isOrganiser = existing.isOrganiser || m.is_organiser;
      else people.set(m.name, { name: m.name, isOrganiser: m.is_organiser, tasks: [] });
    }
    for (const person of people.values()) {
      for (const t of tasks.filter((t) => t.claimedBy === person.name)) {
        person.tasks.push({ title: t.title, day: t.day, kind: "plan", done: t.done });
      }
      for (const r of requests.filter((r) => r.department === name && r.claimed_by === person.name)) {
        person.tasks.push({ title: r.text, day: null, kind: "request", done: false });
      }
    }

    const done = tasks.filter((t) => t.done).length;
    totalDone += done;
    totalTasks += tasks.length;
    return {
      name,
      total: tasks.length,
      done,
      inProgress: tasks.filter((t) => t.claimedBy && !t.done).length,
      percent: tasks.length ? Math.round((done / tasks.length) * 100) : null,
      tasks,
      members: [...people.values()].sort((a, b) => Number(b.isOrganiser) - Number(a.isOrganiser) || a.name.localeCompare(b.name)),
    };
  });

  const phases = phaseNames(days);
  const phase = phases.length ? Math.min(Math.max(args.phase, 0), phases.length - 1) : 0;
  return {
    hasPlan: !!plan,
    organisers: [...new Set(members.filter((m) => m.is_organiser).map((m) => m.name))],
    days,
    phase,
    phaseLabel: phaseLabel(phase, days),
    phases,
    totalDone,
    totalTasks,
    percent: totalTasks ? Math.round((totalDone / totalTasks) * 100) : null,
    departments: depts,
  };
}
