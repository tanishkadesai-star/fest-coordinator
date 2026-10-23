import { randomUUID } from "node:crypto";
import { authenticate, DENIED } from "@/lib/auth";
import { db, failure } from "@/lib/supabase";
import type { PublishedFile } from "@/lib/types";
import { ALLOWED_FILE_TYPES, fileExtension, validateDepartment, validateFileUpload } from "@/lib/validate";

const BUCKET = "published";
const LINK_SECONDS = 60 * 60; // a link to open a file works for an hour

// Everyone in the fest can see the files meant for them: files for everyone, and files for their own
// department. The organiser sees them all. Each file comes with a short-lived link to open it.
export async function GET(request: Request, { params }: { params: Promise<{ code: string }> }) {
  const code = (await params).code.toUpperCase();
  const q = new URL(request.url).searchParams;
  try {
    const caller = await authenticate(code, q.get("name"), q.get("token"));
    if (!caller) return DENIED("Please log in again.");

    const { data, error } = await db()
      .from("published_files")
      .select("*")
      .eq("fest_code", code)
      .order("created_at", { ascending: false });
    if (error) throw error;
    const visible = (data ?? []).filter(
      (f) => caller.isOrganiser || f.audience === "everyone" || f.department === caller.department
    );

    const signed = visible.length
      ? await db().storage.from(BUCKET).createSignedUrls(visible.map((f) => f.storage_path), LINK_SECONDS)
      : { data: [], error: null };
    if (signed.error) throw signed.error;
    const urlByPath = new Map((signed.data ?? []).map((s) => [s.path, s.signedUrl]));

    const files: PublishedFile[] = visible.map((f) => ({
      id: f.id,
      title: f.title,
      category: f.category,
      audience: f.audience,
      department: f.department,
      uploadedBy: f.uploaded_by,
      uploaderRole: f.uploader_role,
      fileName: f.file_name,
      size: Number(f.size),
      createdAt: f.created_at,
      url: urlByPath.get(f.storage_path) ?? null,
    }));
    return Response.json({ files });
  } catch (e) {
    return failure(e);
  }
}

// The organiser and department heads publish a file (sent as a form, up to 4 MB).
export async function POST(request: Request, { params }: { params: Promise<{ code: string }> }) {
  const code = (await params).code.toUpperCase();
  const form = await request.formData().catch(() => null);
  if (!form) return Response.json({ error: "Couldn't read the upload. Please try again." }, { status: 400 });

  try {
    const caller = await authenticate(code, form.get("name"), form.get("token"));
    if (!caller) return DENIED("Please log in again.");
    if (!caller.isOrganiser && !caller.isHead) return DENIED("Only the organiser and department heads can publish files.");

    const file = form.get("file");
    if (!(file instanceof File)) return Response.json({ error: "Choose a file to upload." }, { status: 400 });
    const title = form.get("title");
    const problem = validateFileUpload({ title, category: form.get("category"), fileName: file.name, size: file.size });
    if (problem) return Response.json({ error: problem }, { status: 400 });

    // Who is it for: everyone, or one department. A head can only publish for their own department.
    const audienceRaw = String(form.get("audience") ?? "everyone");
    const forEveryone = audienceRaw === "everyone";
    if (!forEveryone) {
      const deptProblem = validateDepartment(audienceRaw);
      if (deptProblem) return Response.json({ error: deptProblem }, { status: 400 });
      if (!caller.isOrganiser && caller.department !== audienceRaw) {
        return DENIED("You can only publish for everyone or for your own department.");
      }
    }

    // The type comes from the extension we allowed, never from what the browser claims.
    const ext = fileExtension(file.name);
    const safeName = file.name.replace(/[^A-Za-z0-9._-]+/g, "_").slice(-80);
    const path = `${code}/${randomUUID()}-${safeName}`;
    const { error: uploadError } = await db()
      .storage.from(BUCKET)
      .upload(path, Buffer.from(await file.arrayBuffer()), { contentType: ALLOWED_FILE_TYPES[ext], upsert: false });
    if (uploadError) {
      console.error(uploadError);
      return Response.json({ error: "Couldn't save the file. Please try again." }, { status: 502 });
    }

    const { data, error } = await db()
      .from("published_files")
      .insert({
        fest_code: code,
        title: String(title).trim(),
        category: String(form.get("category")),
        audience: forEveryone ? "everyone" : "department",
        department: forEveryone ? null : audienceRaw,
        uploaded_by: caller.name,
        uploader_role: caller.isOrganiser ? "organiser" : "head",
        file_name: file.name.slice(-120),
        mime: ALLOWED_FILE_TYPES[ext],
        size: file.size,
        storage_path: path,
      })
      .select("id")
      .single();
    if (error) {
      await db().storage.from(BUCKET).remove([path]); // don't leave a file nobody can see
      throw error;
    }
    return Response.json({ id: data.id });
  } catch (e) {
    return failure(e);
  }
}
