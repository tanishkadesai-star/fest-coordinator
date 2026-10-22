// Browser-side helpers for talking to our own API routes.
import type { Plan } from "./types";
import type { PlanInput } from "./validate";

export async function postJson(path: string, body: unknown) {
  try {
    const res = await fetch(path, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const data = await res.json().catch(() => ({}));
    return { ok: res.ok, status: res.status, data };
  } catch {
    return {
      ok: false,
      status: 0,
      data: { error: "Couldn't reach the server. Check your connection and try again." },
    };
  }
}

export async function requestPlan(input: PlanInput): Promise<{ plan?: Plan; error?: string }> {
  const res = await postJson("/api/plan", input);
  if (!res.ok || !res.data.plan) {
    return { error: res.data.error ?? "Couldn't generate a plan. Please try again." };
  }
  return { plan: res.data.plan };
}
