import { newCode, newToken } from "@/lib/codes";
import { db, failure, festExists } from "@/lib/supabase";
import { DEPARTMENTS, ORGANISER_DEPT, validateName, validatePlan, validatePlanInput } from "@/lib/validate";

export async function POST(request: Request) {
  const body = await request.json().catch(() => ({}));
  const problem = validateName(body.name); // the organiser belongs to no department
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
      details: String(body.planInput?.details ?? ""),
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
    const token = newToken();
    const { error } = await db().from("members").insert({
      fest_code: code,
      name: body.name.trim(),
      department: ORGANISER_DEPT,
      is_organiser: true,
      token,
    });
    if (error) {
      if (plan) await db().from("fests").delete().eq("code", code); // don't leave a plan with no organiser
      throw error;
    }

    // One code to get back in as organiser, and one for each department head to log in with.
    let organiserCode = "";
    for (let attempt = 0; attempt < 5; attempt++) {
      organiserCode = newCode();
      const rows = [
        { code: organiserCode, fest_code: code, role: "organiser", department: null },
        ...DEPARTMENTS.map((d) => ({ code: newCode(), fest_code: code, role: "head", department: d })),
      ];
      const { error: codesError } = await db().from("access_codes").insert(rows);
      if (!codesError) break;
      if (codesError.code !== "23505" || attempt === 4) throw codesError; // 23505 = a code clashed, so try fresh ones
    }
    return Response.json({ code, token, organiserCode });
  } catch (e) {
    return failure(e);
  }
}
