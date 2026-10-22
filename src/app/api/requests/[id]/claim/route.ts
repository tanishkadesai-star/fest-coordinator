import { db, failure } from "@/lib/supabase";
import { validateName } from "@/lib/validate";

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const body = await request.json().catch(() => ({}));
  const code = String(body.code ?? "").trim().toUpperCase();
  const problem = (code ? null : "Missing fest code.") ?? validateName(body.name);
  if (problem) return Response.json({ error: problem }, { status: 400 });
  const name = body.name.trim();

  try {
    // Only people in the request's department can take it, so the work record stays honest.
    const { data: target, error: targetError } = await db()
      .from("requests")
      .select("department")
      .eq("id", id)
      .eq("fest_code", code)
      .maybeSingle();
    if (targetError) throw targetError;
    if (!target) return Response.json({ error: "Request not found." }, { status: 404 });

    const { data: member, error: memberError } = await db()
      .from("members")
      .select("id")
      .eq("fest_code", code)
      .eq("name", name)
      .eq("department", target.department)
      .limit(1);
    if (memberError) throw memberError;
    if (!member?.length) {
      return Response.json({ error: `Only people in ${target.department} can take this request.` }, { status: 403 });
    }

    // One statement: "set the owner, but only if nobody owns it yet".
    // The database runs two simultaneous claims one after the other,
    // so exactly one gets a row back and the other gets none.
    const { data, error } = await db()
      .from("requests")
      .update({ claimed_by: name })
      .eq("id", id)
      .eq("fest_code", code)
      .is("claimed_by", null)
      .select();
    if (error) throw error;
    if (data.length === 1) return Response.json({ request: data[0] });

    // Nobody won this time: find out who got there first.
    const { data: existing, error: lookupError } = await db()
      .from("requests")
      .select("claimed_by")
      .eq("id", id)
      .eq("fest_code", code)
      .maybeSingle();
    if (lookupError) throw lookupError;
    return Response.json(
      { error: `Already taken by ${existing?.claimed_by}.`, claimedBy: existing?.claimed_by },
      { status: 409 }
    );
  } catch (e) {
    return failure(e);
  }
}
