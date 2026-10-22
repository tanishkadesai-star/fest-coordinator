// Plain-code workload tracking and the checker for the AI's written report.
// The numbers and every statement about an individual are worked out here, never by the AI.
// Type-only imports keep this file runnable directly with Node in the test script.
import type { Overview, TeamReport } from "./types";

export type PersonStats = {
  name: string;
  department: string;
  planDone: number; // plan tasks they took and marked done
  planInProgress: number; // plan tasks they took and have not finished
  requestsTaken: number; // live requests they took
  completed: number; // planDone + requestsTaken
  belowTeammates: boolean; // fewer than half the department average, with at least 2 people
};

export type DeptStats = {
  name: string;
  people: number;
  planTotal: number;
  planDone: number;
  percentDone: number | null; // plan tasks done, as a whole-number percentage
  untaken: number; // plan tasks nobody has taken
  averageCompleted: number; // one decimal
  members: PersonStats[];
};

export type TeamStats = {
  phaseLabel: string;
  departmentCount: number;
  percentDone: number | null;
  totalPeople: number;
  totalPlanTasks: number;
  totalPlanDone: number;
  totalUntaken: number;
  departments: DeptStats[];
};

export function computeStats(o: Overview): TeamStats {
  const departments: DeptStats[] = o.departments.map((d) => {
    const members: PersonStats[] = d.members
      .filter((m) => !m.isOrganiser)
      .map((m) => {
        const planDone = m.tasks.filter((t) => t.kind === "plan" && t.done).length;
        const planInProgress = m.tasks.filter((t) => t.kind === "plan" && !t.done).length;
        const requestsTaken = m.tasks.filter((t) => t.kind === "request").length;
        return {
          name: m.name,
          department: d.name,
          planDone,
          planInProgress,
          requestsTaken,
          completed: planDone + requestsTaken,
          belowTeammates: false,
        };
      });
    const average = members.length ? members.reduce((s, p) => s + p.completed, 0) / members.length : 0;
    // Only compare people within the same department, and only when there is someone to compare with.
    for (const p of members) p.belowTeammates = members.length >= 2 && average > 0 && p.completed < average * 0.5;
    return {
      name: d.name,
      people: members.length,
      planTotal: d.total,
      planDone: d.done,
      percentDone: d.percent,
      untaken: d.tasks.filter((t) => !t.claimedBy).length,
      averageCompleted: Math.round(average * 10) / 10,
      members: members.sort((a, b) => b.completed - a.completed || a.name.localeCompare(b.name)),
    };
  });
  return {
    phaseLabel: o.phaseLabel,
    departmentCount: departments.length,
    percentDone: o.percent,
    totalPeople: departments.reduce((s, d) => s + d.people, 0),
    totalPlanTasks: o.totalTasks,
    totalPlanDone: o.totalDone,
    totalUntaken: departments.reduce((s, d) => s + d.untaken, 0),
    departments,
  };
}

const text = (v: unknown, max: number) => typeof v === "string" && v.trim() !== "" && v.length <= max;
const escape = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

export type ReportCheck = { ok: true; report: Omit<TeamReport, "generatedAt" | "phaseLabel"> } | { ok: false; reason: string };

// Rejects any report that names an individual, names a department that doesn't exist, or
// quotes a number that isn't in the data. Nothing is repaired: a bad report is simply not shown.
export function validateReport(raw: unknown, stats: TeamStats, departmentNames: string[]): ReportCheck {
  const fail = (reason: string): ReportCheck => ({ ok: false, reason });
  const r = raw as Record<string, unknown> | null;
  if (!r || !text(r.summary, 1500)) return fail("no summary");

  const notes = r.departments;
  if (!Array.isArray(notes) || notes.length > 40) return fail("departments is not a list");
  for (const n of notes) {
    const o = n as Record<string, unknown> | null;
    if (!o || typeof o.name !== "string" || !departmentNames.includes(o.name)) {
      return fail(`a department note names one that doesn't exist: ${String(o?.name)}`);
    }
    if (!text(o.note, 500)) return fail("a department note is empty or too long");
  }
  if (!Array.isArray(r.caveats) || r.caveats.length > 8 || !r.caveats.every((c) => text(c, 500))) {
    return fail("caveats are not usable");
  }

  const words = JSON.stringify([r.summary, notes, r.caveats]);

  // Statements about individuals belong to the app's own table, so the AI must not make any.
  for (const name of new Set(stats.departments.flatMap((d) => d.members.map((m) => m.name)))) {
    if (name.length >= 3 && new RegExp(`\\b${escape(name)}\\b`, "i").test(words)) {
      return fail(`it names an individual: ${name}`);
    }
  }

  // Every whole number in the AI's words must appear somewhere in the real data.
  const allowed = new Set(JSON.stringify(stats).match(/\d+/g) ?? []);
  const invented = (words.match(/\d+/g) ?? []).find((n) => !allowed.has(n));
  if (invented) return fail(`it quotes a number that isn't in the data: ${invented}`);

  return {
    ok: true,
    report: {
      summary: (r.summary as string).trim(),
      departments: notes as TeamReport["departments"],
      caveats: (r.caveats as string[]).map((c) => c.trim()),
    },
  };
}
