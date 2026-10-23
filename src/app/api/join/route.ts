import { newToken } from "@/lib/codes";
import { clientIp, JOIN_RULE, recordFailure, secondsBlocked, tooManyTries } from "@/lib/rateLimit";
import { db, failure, festExists } from "@/lib/supabase";
import { validateDepartment, validateName } from "@/lib/validate";

// A volunteer joins with the fest code, a name and a department.
export async function POST(request: Request) {
  const body = await request.json().catch(() => ({}));
  const code = String(body.code ?? "").trim().toUpperCase();
  const problem =
    (code ? null : "Enter the fest code.") ?? validateName(body.name) ?? validateDepartment(body.department);
  if (problem) return Response.json({ error: problem }, { status: 400 });

  const ip = clientIp(request);

  try {
    const blocked = await secondsBlocked("join", ip);
    if (blocked > 0) return tooManyTries(blocked);

    if (!(await festExists(code))) {
      await recordFailure("join", ip, JOIN_RULE);
      return Response.json({ error: "Code not found. Check it with your organiser." }, { status: 404 });
    }
    const name = body.name.trim();
    const token = newToken();
    const { error } = await db().from("members").insert({
      fest_code: code,
      name,
      department: body.department,
      is_organiser: false,
      is_head: false,
      token,
    });
    if (error) throw error;
    return Response.json({ code, token, department: body.department, isOrganiser: false, isHead: false });
  } catch (e) {
    return failure(e);
  }
}
