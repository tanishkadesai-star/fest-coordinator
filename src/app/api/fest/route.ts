import { db, failure, festExists } from "@/lib/supabase";
import { validateDepartment, validateName } from "@/lib/validate";

// No 0/O/1/I so codes are easy to read out over a walkie-talkie.
const ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

function newCode() {
  let code = "";
  for (let i = 0; i < 6; i++) code += ALPHABET[Math.floor(Math.random() * ALPHABET.length)];
  return code;
}

export async function POST(request: Request) {
  const body = await request.json().catch(() => ({}));
  const problem = validateName(body.name) ?? validateDepartment(body.department);
  if (problem) return Response.json({ error: problem }, { status: 400 });

  try {
    let code = newCode();
    for (let i = 0; i < 5 && (await festExists(code)); i++) code = newCode();

    const { error } = await db().from("members").insert({
      fest_code: code,
      name: body.name.trim(),
      department: body.department,
      is_organiser: true,
    });
    if (error) throw error;
    return Response.json({ code });
  } catch (e) {
    return failure(e);
  }
}
