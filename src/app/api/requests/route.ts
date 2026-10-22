import { db, failure, festExists } from "@/lib/supabase";
import { validateDepartment, validateName, validateRequestText } from "@/lib/validate";

// Polled every 2 seconds by every phone.
export async function GET(request: Request) {
  const params = new URL(request.url).searchParams;
  const code = (params.get("code") ?? "").toUpperCase();
  const department = params.get("department") ?? "";
  const problem = (code ? null : "Missing fest code.") ?? validateDepartment(department);
  if (problem) return Response.json({ error: problem }, { status: 400 });

  try {
    const { data, error } = await db()
      .from("requests")
      .select("*")
      .eq("fest_code", code)
      .eq("department", department)
      .order("created_at", { ascending: false })
      .limit(100);
    if (error) throw error;
    return Response.json({ requests: data });
  } catch (e) {
    return failure(e);
  }
}

export async function POST(request: Request) {
  const body = await request.json().catch(() => ({}));
  const code = String(body.code ?? "").trim().toUpperCase();
  const problem =
    (code ? null : "Missing fest code.") ??
    validateName(body.name) ??
    validateDepartment(body.department) ??
    validateRequestText(body.text);
  if (problem) return Response.json({ error: problem }, { status: 400 });

  try {
    if (!(await festExists(code))) {
      return Response.json({ error: "Code not found." }, { status: 404 });
    }
    const { data, error } = await db()
      .from("requests")
      .insert({
        fest_code: code,
        department: body.department,
        text: body.text.trim(),
        created_by: body.name.trim(),
      })
      .select()
      .single();
    if (error) throw error;
    return Response.json({ request: data });
  } catch (e) {
    return failure(e);
  }
}
