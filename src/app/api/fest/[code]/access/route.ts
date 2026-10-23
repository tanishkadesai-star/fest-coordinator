import { authenticate, DENIED } from "@/lib/auth";
import { db, failure } from "@/lib/supabase";
import { DEPARTMENTS } from "@/lib/validate";

// The organiser's list of codes: one per department head, and one to get back in as organiser.
export async function GET(request: Request, { params }: { params: Promise<{ code: string }> }) {
  const code = (await params).code.toUpperCase();
  const q = new URL(request.url).searchParams;
  try {
    const caller = await authenticate(code, q.get("name"), q.get("token"));
    if (!caller?.isOrganiser) return DENIED("Only the organiser can see the access codes.");

    const { data, error } = await db().from("access_codes").select("code, role, department").eq("fest_code", code);
    if (error) throw error;
    const rows = data ?? [];
    return Response.json({
      organiserCode: rows.find((r) => r.role === "organiser")?.code ?? null,
      heads: DEPARTMENTS.map((d) => ({ department: d, code: rows.find((r) => r.role === "head" && r.department === d)?.code ?? null })),
    });
  } catch (e) {
    return failure(e);
  }
}
