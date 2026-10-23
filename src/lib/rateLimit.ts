// Server-only: stops people guessing codes by trying many. Failed attempts are counted per
// visitor address in the database (a hosted app has no memory between requests).
import { db } from "./supabase";

type Rule = { limit: number; windowMs: number; blockMs: number };

// Head and organiser codes: few people use them, so be strict.
export const LOGIN_RULE: Rule = { limit: 8, windowMs: 10 * 60_000, blockMs: 10 * 60_000 };
// The shared fest code: a whole college can sit behind one Wi-Fi address and typos are common, so be loose.
export const JOIN_RULE: Rule = { limit: 40, windowMs: 10 * 60_000, blockMs: 5 * 60_000 };

// Questions to the AI cost a little each time, so each person gets a generous but finite number.
export const ASK_RULE: Rule = { limit: 30, windowMs: 10 * 60_000, blockMs: 5 * 60_000 };

export function clientIp(request: Request): string {
  const forwarded = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  return forwarded || request.headers.get("x-real-ip") || "unknown";
}

// If the limiter itself ever breaks, logging in still works: it fails open and logs the problem.
export async function secondsBlocked(kind: string, ip: string): Promise<number> {
  try {
    const { data } = await db().from("login_attempts").select("blocked_until").eq("key", `${kind}:${ip}`).maybeSingle();
    if (!data?.blocked_until) return 0;
    const ms = new Date(data.blocked_until).getTime() - Date.now();
    return ms > 0 ? Math.ceil(ms / 1000) : 0;
  } catch (e) {
    console.error("rate limit check failed", e);
    return 0;
  }
}

export async function recordFailure(kind: string, ip: string, rule: Rule): Promise<void> {
  try {
    const key = `${kind}:${ip}`;
    const now = Date.now();
    const { data } = await db().from("login_attempts").select("failures, window_started, blocked_until").eq("key", key).maybeSingle();
    const windowOver = !data || now - new Date(data.window_started).getTime() > rule.windowMs;
    const blockOver = !!data?.blocked_until && new Date(data.blocked_until).getTime() <= now;
    const fresh = windowOver || blockOver; // a finished block or window starts the count again
    const failures = fresh ? 1 : data!.failures + 1;
    await db().from("login_attempts").upsert({
      key,
      failures,
      window_started: fresh ? new Date(now).toISOString() : data!.window_started,
      blocked_until: failures >= rule.limit ? new Date(now + rule.blockMs).toISOString() : null,
    });
  } catch (e) {
    console.error("rate limit record failed", e);
  }
}

export function tooManyTries(seconds: number) {
  const minutes = Math.max(1, Math.ceil(seconds / 60));
  return Response.json(
    { error: `Too many wrong codes. Try again in ${minutes} minute${minutes === 1 ? "" : "s"}.` },
    { status: 429 }
  );
}
