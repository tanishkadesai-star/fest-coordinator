// Server-only: reads everything the overview and the report need and works out the numbers.
import { computeOverview } from "./overview";
import { db } from "./supabase";
import type { Overview, Plan } from "./types";
import { DEPARTMENTS } from "./validate";

export async function loadOverview(code: string): Promise<Overview> {
  const [fest, statuses, members, requests] = await Promise.all([
    db().from("fests").select("plan, plan_input, phase").eq("code", code).maybeSingle(),
    db().from("task_status").select("task_key, claimed_by, done").eq("fest_code", code),
    db().from("members").select("name, department, is_organiser").eq("fest_code", code),
    db().from("requests").select("department, text, claimed_by").eq("fest_code", code).not("claimed_by", "is", null),
  ]);
  for (const r of [fest, statuses, members, requests]) if (r.error) throw r.error;

  return computeOverview({
    departments: DEPARTMENTS,
    plan: (fest.data?.plan as Plan | undefined) ?? null,
    days: (fest.data?.plan_input as { days?: number } | undefined)?.days ?? null,
    phase: fest.data?.phase ?? 0,
    statuses: statuses.data ?? [],
    members: members.data ?? [],
    requests: requests.data ?? [],
  });
}
