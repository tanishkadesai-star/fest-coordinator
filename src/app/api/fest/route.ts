import { db, failure, festExists } from "@/lib/supabase";
import { validateDepartment, validateName, validatePlan, validatePlanInput } from "@/lib/validate";

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

  // The plan is optional, but if one is sent it is checked again here, never trusted as-is.
  let plan = null;
  let planInput = null;
  if (body.plan !== undefined) {
    planInput = {
      festType: String(body.planInput?.festType ?? ""),
      days: Number(body.planInput?.days),
      attendance: Number(body.planInput?.attendance),
      highlights: String(body.planInput?.highlights ?? ""),
    };
    const inputProblem = validatePlanInput(planInput);
    const checked = inputProblem ? null : validatePlan(body.plan, planInput.days);
    if (!checked?.ok) {
      return Response.json({ error: "That plan didn't pass the checks. Please draft it again." }, { status: 400 });
    }
    plan = checked.plan;
  }

  try {
    let code = newCode();
    for (let i = 0; i < 5 && (await festExists(code)); i++) code = newCode();

    if (plan) {
      const { error } = await db().from("fests").insert({ code, plan, plan_input: planInput });
      if (error) throw error;
    }
    const { error } = await db().from("members").insert({
      fest_code: code,
      name: body.name.trim(),
      department: body.department,
      is_organiser: true,
    });
    if (error) {
      if (plan) await db().from("fests").delete().eq("code", code); // don't leave a plan with no organiser
      throw error;
    }
    return Response.json({ code });
  } catch (e) {
    return failure(e);
  }
}
