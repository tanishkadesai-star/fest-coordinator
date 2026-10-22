import { db, failure, festExists } from "@/lib/supabase";
import { validateDepartment, validateName } from "@/lib/validate";

export async function POST(request: Request) {
  const body = await request.json().catch(() => ({}));
  const code = String(body.code ?? "").trim().toUpperCase();
  const problem =
    (code ? null : "Enter the fest code.") ?? validateName(body.name) ?? validateDepartment(body.department);
  if (problem) return Response.json({ error: problem }, { status: 400 });

  try {
    if (!(await festExists(code))) {
      return Response.json({ error: "Code not found. Check it with your organiser." }, { status: 404 });
    }
    const { error } = await db().from("members").insert({
      fest_code: code,
      name: body.name.trim(),
      department: body.department,
      is_organiser: false,
    });
    if (error) throw error;
    return Response.json({ code });
  } catch (e) {
    return failure(e);
  }
}
