// Server-only: one place that talks to OpenRouter, so the key never reaches the browser.
// Always Google models, always served by Google's own infrastructure.
import { getEnv } from "./env";

const PROVIDER = { only: ["google-vertex", "google-ai-studio"], allow_fallbacks: false };

export type ToolSpec = { name: string; description: string; parameters: Record<string, unknown> };

export type ToolResult =
  | { ok: true; call: { name: string; arguments: string } | null }
  | { ok: false; reason: "no_key" | "failed" };

export async function callTool(opts: {
  model: string;
  system: string;
  user: string;
  tools: ToolSpec[];
  maxTokens: number;
  timeoutMs: number;
}): Promise<ToolResult> {
  const apiKey = getEnv("OPENROUTER_API_KEY");
  if (!apiKey) return { ok: false, reason: "no_key" };
  try {
    const res = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      signal: AbortSignal.timeout(opts.timeoutMs),
      body: JSON.stringify({
        model: opts.model,
        provider: PROVIDER,
        max_tokens: opts.maxTokens, // the model's thinking counts against this, so keep it generous
        tools: opts.tools.map((t) => ({ type: "function", function: t })),
        tool_choice: "required",
        messages: [
          { role: "system", content: opts.system },
          { role: "user", content: opts.user },
        ],
      }),
    });
    if (!res.ok) {
      console.error("OpenRouter error", res.status, (await res.text()).slice(0, 300));
      return { ok: false, reason: "failed" };
    }
    const data = await res.json();
    const call = data.choices?.[0]?.message?.tool_calls?.[0]?.function;
    return { ok: true, call: call?.name ? { name: call.name, arguments: call.arguments ?? "" } : null };
  } catch (e) {
    console.error(e);
    return { ok: false, reason: "failed" };
  }
}
