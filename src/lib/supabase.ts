// Server-only: the service key must never reach the browser, so only API routes import this.
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { getEnv } from "./env";

export class NotConfiguredError extends Error {}

let client: SupabaseClient | null = null;

export function db(): SupabaseClient {
  if (client) return client;
  const url = getEnv("SUPABASE_URL");
  const key = getEnv("SUPABASE_SERVICE_KEY");
  if (!url || !key) {
    throw new NotConfiguredError(
      "The shared data store isn't set up yet. Add SUPABASE_URL and SUPABASE_SERVICE_KEY to .env.local."
    );
  }
  client = createClient(url, key, { auth: { persistSession: false } });
  return client;
}

// A fest "exists" once its organiser has been saved.
export async function festExists(code: string): Promise<boolean> {
  const { data, error } = await db()
    .from("members")
    .select("id")
    .eq("fest_code", code)
    .eq("is_organiser", true)
    .limit(1);
  if (error) throw error;
  return (data?.length ?? 0) > 0;
}

// Shared by the API routes: turns any failure into a clear JSON message.
export function failure(e: unknown): Response {
  if (e instanceof NotConfiguredError) {
    return Response.json({ error: e.message }, { status: 500 });
  }
  console.error(e);
  return Response.json(
    { error: "Couldn't reach the data store. Check your connection and try again." },
    { status: 502 }
  );
}
