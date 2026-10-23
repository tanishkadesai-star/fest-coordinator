// Server-only: checks who is calling. A name alone can be typed by anyone, so powers
// that matter (assigning, publishing, the phase, the report) also need the private token
// that was handed out when the person joined.
import { db } from "./supabase";

export type Caller = { name: string; department: string; isOrganiser: boolean; isHead: boolean };

export async function authenticate(code: string, name: unknown, token: unknown): Promise<Caller | null> {
  if (typeof name !== "string" || typeof token !== "string" || !name.trim() || !token) return null;
  const { data, error } = await db()
    .from("members")
    .select("name, department, is_organiser, is_head")
    .eq("fest_code", code)
    .eq("name", name.trim())
    .eq("token", token)
    .limit(1);
  if (error) throw error;
  const m = data?.[0];
  return m ? { name: m.name, department: m.department, isOrganiser: m.is_organiser, isHead: m.is_head } : null;
}

export const DENIED = (message = "You can't do that.") => Response.json({ error: message }, { status: 403 });
