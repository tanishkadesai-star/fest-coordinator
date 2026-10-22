import { db, failure } from "@/lib/supabase";

// Anyone in the fest can read the plan, so department heads can see their tasks.
export async function GET(_request: Request, { params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;
  try {
    const { data, error } = await db()
      .from("fests")
      .select("plan, plan_input")
      .eq("code", code.toUpperCase())
      .maybeSingle();
    if (error) throw error;
    if (!data) {
      return Response.json({ error: "No plan has been shared for this fest yet." }, { status: 404 });
    }
    return Response.json({ plan: data.plan, input: data.plan_input });
  } catch (e) {
    return failure(e);
  }
}
