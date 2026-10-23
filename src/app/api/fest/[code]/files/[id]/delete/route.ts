import { authenticate, DENIED } from "@/lib/auth";
import { db, failure } from "@/lib/supabase";

// The person who published a file, or the organiser, can take it down.
export async function POST(
  request: Request,
  { params }: { params: Promise<{ code: string; id: string }> }
) {
  const { code: rawCode, id } = await params;
  const code = rawCode.toUpperCase();
  const body = await request.json().catch(() => ({}));

  try {
    const caller = await authenticate(code, body.name, body.token);
    if (!caller) return DENIED("Please log in again.");

    const { data: file, error } = await db()
      .from("published_files")
      .select("uploaded_by, storage_path")
      .eq("id", id)
      .eq("fest_code", code)
      .maybeSingle();
    if (error) throw error;
    if (!file) return Response.json({ error: "File not found." }, { status: 404 });
    if (!caller.isOrganiser && !(caller.isHead && file.uploaded_by === caller.name)) {
      return DENIED("Only the person who published this file, or the organiser, can remove it.");
    }

    await db().storage.from("published").remove([file.storage_path]);
    const { error: deleteError } = await db().from("published_files").delete().eq("id", id);
    if (deleteError) throw deleteError;
    return Response.json({ ok: true });
  } catch (e) {
    return failure(e);
  }
}
