import { authenticate, DENIED } from "@/lib/auth";
import { parseTaskKey } from "@/lib/overview";
import { db, failure } from "@/lib/supabase";
import type { Plan } from "@/lib/types";

// A department head (or the organiser) gives a task to a named person, moves it to someone
// else, or frees it up again. `assignee: null` frees it. A finished task can't be changed.
export async function POST(
  request: Request,
  { params }: { params: Promise<{ code: string; key: string }> }
) {
  const { code: rawCode, key } = await params;
  const code = rawCode.toUpperCase();
  const body = await request.json().catch(() => ({}));

  try {
    const caller = await authenticate(code, body.name, body.token);
    if (!caller) return DENIED("Please log in again.");

    const { data: fest, error: festError } = await db().from("fests").select("plan").eq("code", code).maybeSingle();
    if (festError) throw festError;
    const parsed = parseTaskKey(key);
    const dept = fest && parsed ? (fest.plan as Plan).departments[parsed.dept] : undefined;
    if (!dept || !parsed || !dept.tasks[parsed.task]) {
      return Response.json({ error: "Task not found." }, { status: 404 });
    }

    // Only that department's head, or the organiser, can assign its tasks.
    const allowed = caller.isOrganiser || (caller.isHead && caller.department === dept.name);
    if (!allowed) return DENIED(`Only the ${dept.name} head or the organiser can assign this task.`);

    const { data: existing, error: existingError } = await db()
      .from("task_status")
      .select("claimed_by, done")
      .eq("fest_code", code)
      .eq("task_key", key)
      .maybeSingle();
    if (existingError) throw existingError;
    if (existing?.done) return Response.json({ error: "That task is already done, so it can't be changed." }, { status: 409 });

    // Freeing the task up.
    if (body.assignee === null) {
      if (existing) {
        const { error } = await db().from("task_status").delete().eq("fest_code", code).eq("task_key", key).eq("done", false);
        if (error) throw error;
      }
      return Response.json({ ok: true, assignee: null });
    }

    // Giving it to someone: they must be a (non-organiser) member of this department.
    const assignee = typeof body.assignee === "string" ? body.assignee.trim() : "";
    if (!assignee) return Response.json({ error: "Choose who to give this task to." }, { status: 400 });
    const { data: member, error: memberError } = await db()
      .from("members")
      .select("id")
      .eq("fest_code", code)
      .eq("name", assignee)
      .eq("department", dept.name)
      .eq("is_organiser", false)
      .limit(1);
    if (memberError) throw memberError;
    if (!member?.length) {
      return Response.json({ error: `${assignee} isn't in ${dept.name}.` }, { status: 400 });
    }

    if (existing) {
      const { error } = await db()
        .from("task_status")
        .update({ claimed_by: assignee, assigned_by: caller.name })
        .eq("fest_code", code)
        .eq("task_key", key)
        .eq("done", false);
      if (error) throw error;
    } else {
      const { error } = await db()
        .from("task_status")
        .insert({ fest_code: code, task_key: key, claimed_by: assignee, assigned_by: caller.name });
      if (error?.code === "23505") {
        // A volunteer took it a moment earlier. The head's decision wins.
        const { error: updateError } = await db()
          .from("task_status")
          .update({ claimed_by: assignee, assigned_by: caller.name })
          .eq("fest_code", code)
          .eq("task_key", key)
          .eq("done", false);
        if (updateError) throw updateError;
      } else if (error) {
        throw error;
      }
    }
    return Response.json({ ok: true, assignee });
  } catch (e) {
    return failure(e);
  }
}
