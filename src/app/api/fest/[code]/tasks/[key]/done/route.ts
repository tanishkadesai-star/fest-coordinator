import { db, failure } from "@/lib/supabase";
import { validateName } from "@/lib/validate";

// Only the person who took a task can mark it done.
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
    const { data: updated, error } = await db()
      .from("task_status")
      .update({ done: true, done_at: new Date().toISOString() })
      .eq("fest_code", code)
      .eq("task_key", key)
      .eq("claimed_by", name)
      .select();
    if (error) throw error;
    if (updated.length === 1) return Response.json({ ok: true });

    const { data: existing, error: lookupError } = await db()
      .from("task_status")
      .select("claimed_by")
      .eq("fest_code", code)
      .eq("task_key", key)
      .maybeSingle();
    if (lookupError) throw lookupError;
    if (!existing) return Response.json({ error: "Take the task first, then mark it done." }, { status: 409 });
    return Response.json({ error: `Only ${existing.claimed_by} can mark this done.` }, { status: 403 });
  } catch (e) {
    return failure(e);
  }
}
