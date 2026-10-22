import { computeOverview } from "@/lib/overview";
import { db, failure, festExists } from "@/lib/supabase";
import type { Plan } from "@/lib/types";
import { DEPARTMENTS } from "@/lib/validate";

// Polled by every phone on the overview screen.
export async function GET(_request: Request, { params }: { params: Promise<{ code: string }> }) {
  const code = (await params).code.toUpperCase();
  try {
    if (!(await festExists(code))) {
      return Response.json({ error: "Fest not found." }, { status: 404 });
    }
    const [fest, statuses, members, requests] = await Promise.all([
      db().from("fests").select("plan, plan_input, phase").eq("code", code).maybeSingle(),
      db().from("task_status").select("task_key, claimed_by, done").eq("fest_code", code),
      db().from("members").select("name, department, is_organiser").eq("fest_code", code),
      db().from("requests").select("department, text, claimed_by").eq("fest_code", code).not("claimed_by", "is", null),
    ]);
    for (const r of [fest, statuses, members, requests]) if (r.error) throw r.error;

    const overview = computeOverview({
      departments: DEPARTMENTS,
      plan: (fest.data?.plan as Plan | undefined) ?? null,
      days: (fest.data?.plan_input as { days?: number } | undefined)?.days ?? null,
      phase: fest.data?.phase ?? 0,
      statuses: statuses.data ?? [],
      members: members.data ?? [],
      requests: requests.data ?? [],
    });
    return Response.json({ overview });
  } catch (e) {
    return failure(e);
  }
}
