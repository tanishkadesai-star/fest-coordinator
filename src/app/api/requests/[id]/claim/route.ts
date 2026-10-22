import { db, failure } from "@/lib/supabase";
import { validateName } from "@/lib/validate";

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const body = await request.json().catch(() => ({}));
  const code = String(body.code ?? "").trim().toUpperCase();
  const problem = (code ? null : "Missing fest code.") ?? validateName(body.name);
  if (problem) return Response.json({ error: problem }, { status: 400 });

  try {
    // One statement: "set the owner, but only if nobody owns it yet".
    // The database runs two simultaneous claims one after the other,
    // so exactly one gets a row back and the other gets none.
    const { data, error } = await db()
      .from("requests")
      .update({ claimed_by: body.name.trim() })
      .eq("id", id)
      .eq("fest_code", code)
      .is("claimed_by", null)
      .select();
    if (error) throw error;
    if (data.length === 1) return Response.json({ request: data[0] });

    // Nobody won this time: find out why.
    const { data: existing, error: lookupError } = await db()
      .from("requests")
      .select("claimed_by")
      .eq("id", id)
      .eq("fest_code", code)
      .maybeSingle();
    if (lookupError) throw lookupError;
    if (!existing) return Response.json({ error: "Request not found." }, { status: 404 });
    return Response.json(
      { error: `Already taken by ${existing.claimed_by}.`, claimedBy: existing.claimed_by },
      { status: 409 }
    );
  } catch (e) {
    return failure(e);
  }
}
