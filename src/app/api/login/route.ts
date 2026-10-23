import { newToken } from "@/lib/codes";
import { db, failure } from "@/lib/supabase";
import { ORGANISER_DEPT, validateName } from "@/lib/validate";

// Department heads (and the organiser, getting back in) log in with an access code and a name.
export async function POST(request: Request) {
  const body = await request.json().catch(() => ({}));
  const accessCode = String(body.accessCode ?? "").trim().toUpperCase();
  const problem = (accessCode ? null : "Enter your access code.") ?? validateName(body.name);
  if (problem) return Response.json({ error: problem }, { status: 400 });
  const name = body.name.trim();

  try {
    const { data: found, error } = await db()
      .from("access_codes")
      .select("fest_code, role, department")
      .eq("code", accessCode)
      .maybeSingle();
    if (error) throw error;
    if (!found) return Response.json({ error: "Code not found. Check it with your organiser." }, { status: 404 });

    const isOrganiser = found.role === "organiser";
    const department = isOrganiser ? ORGANISER_DEPT : (found.department as string);

    // Someone with this code and name who is already in keeps their token, so a second phone works too.
    const { data: existing, error: existingError } = await db()
      .from("members")
      .select("id, token")
      .eq("fest_code", found.fest_code)
      .eq("name", name)
      .eq("department", department)
      .limit(1);
    if (existingError) throw existingError;

    let token = existing?.[0]?.token as string | null | undefined;
    if (existing?.length) {
      // Make sure this person has the head or organiser role (a volunteer who was promoted, for example).
      token = token ?? newToken();
      const { error: updateError } = await db()
        .from("members")
        .update({ token, is_head: !isOrganiser, is_organiser: isOrganiser })
        .eq("id", existing[0].id);
      if (updateError) throw updateError;
    } else {
      token = newToken();
      const { error: insertError } = await db().from("members").insert({
        fest_code: found.fest_code,
        name,
        department,
        is_organiser: isOrganiser,
        is_head: !isOrganiser,
        token,
      });
      if (insertError) throw insertError;
    }
    return Response.json({ code: found.fest_code, token, department, isOrganiser, isHead: !isOrganiser });
  } catch (e) {
    return failure(e);
  }
}
