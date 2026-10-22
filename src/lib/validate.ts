// Plain-code checks. No AI in this file.
// Imports are type-only so the test script can run this file directly with Node.
import type { Plan } from "./types";

export const DEPARTMENTS = [
  "Logistics",
  "Hospitality",
  "Stage & Programme",
  "Tech & AV",
  "Marketing & Social",
  "Finance & Sponsors",
  "Volunteers & Crowd",
  "Safety & Medical",
];

export const FEST_TYPES = ["Cultural", "Technical", "Sports", "Mixed / General"];

export const MAX_REQUEST_LENGTH = 200;

export type PlanInput = {
  festType: string;
  days: number;
  attendance: number;
  highlights: string;
};

// Returns a message to show the user, or null if the form is fine.
export function validatePlanInput(input: PlanInput): string | null {
  if (!FEST_TYPES.includes(input.festType)) return "Choose a fest type.";
  if (!Number.isInteger(input.days) || input.days < 1 || input.days > 3) {
    return "Number of days must be 1, 2 or 3.";
  }
  if (!Number.isInteger(input.attendance) || input.attendance < 1 || input.attendance > 100000) {
    return "Enter the expected attendance as a number, e.g. 800.";
  }
  const highlights = (input.highlights ?? "").trim();
  if (highlights.split(/\s+/).filter(Boolean).length < 4) {
    return "Describe the highlights in a few more words, e.g. the main events you plan.";
  }
  if (highlights.length > 1000) return "Highlights are too long (max 1000 characters).";
  return null;
}

export type PlanCheck = { ok: true; plan: Plan } | { ok: false; reason: string };

// Strictly checks the AI's answer. Anything unexpected is rejected, never repaired.
export function validatePlan(raw: unknown, days: number): PlanCheck {
  const fail = (reason: string): PlanCheck => ({ ok: false, reason });
  const departments = (raw as { departments?: unknown } | null)?.departments;
  if (!Array.isArray(departments)) return fail("no departments list");
  if (departments.length !== DEPARTMENTS.length) {
    return fail(`expected ${DEPARTMENTS.length} departments, got ${departments.length}`);
  }

  const byName = new Map<string, unknown>();
  for (const d of departments) {
    const name = (d as { name?: unknown } | null)?.name;
    if (typeof name !== "string" || !DEPARTMENTS.includes(name)) {
      return fail(`unknown department "${String(name)}"`);
    }
    if (byName.has(name)) return fail(`department "${name}" appears twice`);
    byName.set(name, d);
  }

  const daysUsed = new Set<number>();
  const checked: Plan["departments"] = [];
  for (const name of DEPARTMENTS) {
    const tasks = (byName.get(name) as { tasks?: unknown }).tasks;
    if (!Array.isArray(tasks) || tasks.length < 3 || tasks.length > 5) {
      return fail(`"${name}" must have 3 to 5 tasks`);
    }
    const cleanTasks = [];
    for (const t of tasks) {
      const title = (t as { title?: unknown } | null)?.title;
      const day = (t as { day?: unknown } | null)?.day;
      if (typeof title !== "string" || title.trim() === "" || title.length > 200) {
        return fail(`"${name}" has a task with no usable title`);
      }
      if (typeof day !== "number" || !Number.isInteger(day) || day < 1 || day > days) {
        return fail(`"${name}" has a task on day ${String(day)}, but the fest has ${days} day(s)`);
      }
      daysUsed.add(day);
      cleanTasks.push({ title: title.trim(), day });
    }
    checked.push({ name, tasks: cleanTasks });
  }

  for (let d = 1; d <= days; d++) {
    if (!daysUsed.has(d)) return fail(`no task is planned for day ${d}`);
  }
  return { ok: true, plan: { departments: checked } };
}

export function validateName(name: unknown): string | null {
  if (typeof name !== "string" || name.trim() === "") return "Enter your name.";
  if (name.trim().length > 30) return "Name is too long (max 30 characters).";
  return null;
}

export function validateDepartment(dep: unknown): string | null {
  if (typeof dep !== "string" || !DEPARTMENTS.includes(dep)) return "Choose a department.";
  return null;
}

export function validateRequestText(text: unknown): string | null {
  if (typeof text !== "string" || text.trim() === "") return "Type what you need first.";
  if (text.trim().length > MAX_REQUEST_LENGTH) {
    return `Keep it under ${MAX_REQUEST_LENGTH} characters.`;
  }
  return null;
}
