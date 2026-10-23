import { authenticate, DENIED } from "@/lib/auth";
import { phaseNames } from "@/lib/overview";
import { db, failure } from "@/lib/supabase";

// Only the organiser moves the fest from one phase to the next.
export async function POST(request: Request, { params }: { params: Promise<{ code: string }> }) {
  const code = (await params).code.toUpperCase();
  const body = await request.json().catch(() => ({}));

  try {
    const caller = await authenticate(code, body.name, body.token);
    if (!caller?.isOrganiser) return DENIED("Only the organiser can change the phase.");

    const { data: fest, error: festError } = await db()
      .from("fests")
      .select("plan_input")
      .eq("code", code)
      .maybeSingle();
    if (festError) throw festError;
    if (!fest) return Response.json({ error: "This fest has no plan, so it has no phases." }, { status: 404 });

    const count = phaseNames((fest.plan_input as { days: number }).days).length;
    const phase = body.phase;
    if (!Number.isInteger(phase) || phase < 0 || phase >= count) {
      return Response.json({ error: "That phase doesn't exist." }, { status: 400 });
    }
    const { error } = await db().from("fests").update({ phase }).eq("code", code);
    if (error) throw error;
    return Response.json({ phase });
  } catch (e) {
    return failure(e);
  }
}
