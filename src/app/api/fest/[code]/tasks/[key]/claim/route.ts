import { parseTaskKey } from "@/lib/overview";
import { db, failure } from "@/lib/supabase";
import type { Plan } from "@/lib/types";
import { validateName } from "@/lib/validate";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ code: string; key: string }> }
) {
  const { code: rawCode, key } = await params;
  const code = rawCode.toUpperCase();
  const body = await request.json().catch(() => ({}));
  const problem = validateName(body.name);
  if (problem) return Response.json({ error: problem }, { status: 400 });
  const name = body.name.trim();

  try {
    const { data: fest, error: festError } = await db().from("fests").select("plan").eq("code", code).maybeSingle();
    if (festError) throw festError;
    const parsed = parseTaskKey(key);
    const dept = fest && parsed ? (fest.plan as Plan).departments[parsed.dept] : undefined;
    if (!dept || !parsed || !dept.tasks[parsed.task]) {
      return Response.json({ error: "Task not found." }, { status: 404 });
    }

    // Only people who joined this department can take its tasks.
    const { data: member, error: memberError } = await db()
      .from("members")
      .select("id")
      .eq("fest_code", code)
      .eq("name", name)
      .eq("department", dept.name)
      .limit(1);
    if (memberError) throw memberError;
    if (!member?.length) {
      return Response.json({ error: `Only people in ${dept.name} can take this task.` }, { status: 403 });
    }

    // The primary key (fest_code, task_key) lets exactly one insert succeed,
    // so two people tapping together cannot both own the task.
    const { error } = await db().from("task_status").insert({ fest_code: code, task_key: key, claimed_by: name });
    if (error?.code === "23505") {
      const { data: existing } = await db()
        .from("task_status")
        .select("claimed_by")
        .eq("fest_code", code)
        .eq("task_key", key)
        .maybeSingle();
      return Response.json(
        { error: `Already taken by ${existing?.claimed_by ?? "someone else"}.` },
        { status: 409 }
      );
    }
    if (error) throw error;
    return Response.json({ ok: true });
  } catch (e) {
    return failure(e);
  }
}
