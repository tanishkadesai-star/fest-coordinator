import { callTool } from "@/lib/openrouter";
import { loadOverview } from "@/lib/overviewData";
import { computeStats, validateReport, type TeamStats } from "@/lib/report";
import { db, failure, isOrganiser } from "@/lib/supabase";
import type { TeamReport } from "@/lib/types";
import { DEPARTMENTS, validateName } from "@/lib/validate";

export const maxDuration = 30;

const MODEL = "google/gemini-3.5-flash-lite";

const SYSTEM = `You write a fair, factual team report for the head organiser of a college fest. You are given counts only, as JSON, worked out by the app from what people recorded.

Rules:
- Use only the names and numbers in the data. Never invent a person, a task or a number. Quote a number only exactly as it appears in the data, never add, subtract or work out a new one, and leave numbers out when a word will do.
- Never name or single out any individual person. The app shows its own table for individuals. Talk about departments and the team as a whole.
- Departments have different workloads, so never say one department did better or worse than another. Describe each department on its own.
- "completed" is plan tasks marked done plus live requests taken. "planInProgress" is plan tasks taken but not finished. "untaken" is plan tasks nobody took.
- Counts cannot show effort, difficulty, or work that was not recorded in the app. Say so plainly in the caveats. Never accuse anyone. Describe low counts neutrally, for example "recorded fewer tasks than teammates".
- Write every number as digits, for example 48, never as words.
- Mention any department that still has untaken tasks.
- Keep every note short and in plain words.

Fields:
- summary: 3 to 5 sentences on how the team did overall.
- departments: one short note for each department that has people or tasks (people count, share of tasks done, untaken tasks).
- caveats: 2 to 4 short sentences on what these counts do not show.`;

const TOOL = {
  name: "submit_report",
  description: "Submit the team report.",
  parameters: {
    type: "object",
    properties: {
      summary: { type: "string" },
      departments: {
        type: "array",
        items: {
          type: "object",
          properties: { name: { type: "string", enum: DEPARTMENTS }, note: { type: "string" } },
          required: ["name", "note"],
        },
      },
      caveats: { type: "array", items: { type: "string" } },
    },
    required: ["summary", "departments", "caveats"],
  },
};

const err = (error: string, status: number) => Response.json({ error }, { status });

async function currentStats(code: string): Promise<TeamStats> {
  return computeStats(await loadOverview(code));
}

// The organiser's view: live numbers plus the last report, if one was generated.
export async function GET(request: Request, { params }: { params: Promise<{ code: string }> }) {
  const code = (await params).code.toUpperCase();
  const name = new URL(request.url).searchParams.get("name") ?? "";
  try {
    if (validateName(name) || !(await isOrganiser(code, name))) {
      return err("Only the organiser can see the team report.", 403);
    }
    const { data, error } = await db().from("fests").select("report").eq("code", code).maybeSingle();
    if (error) throw error;
    return Response.json({ stats: await currentStats(code), report: (data?.report as TeamReport | null) ?? null });
  } catch (e) {
    return failure(e);
  }
}

// Asks the AI to write the report from the live numbers, checks it, and saves it.
export async function POST(request: Request, { params }: { params: Promise<{ code: string }> }) {
  const code = (await params).code.toUpperCase();
  const body = await request.json().catch(() => ({}));
  try {
    if (validateName(body.name) || !(await isOrganiser(code, body.name))) {
      return err("Only the organiser can generate the team report.", 403);
    }
    const stats = await currentStats(code);
    if (stats.totalPeople === 0) return err("Nobody except the organiser has joined yet, so there is nothing to report.", 409);

    const result = await callTool({
      model: MODEL,
      system: SYSTEM,
      user: `Team data:\n${JSON.stringify(stats)}`,
      tools: [TOOL],
      maxTokens: 8000,
      timeoutMs: 27_000,
    });
    if (!result.ok) {
      return result.reason === "no_key"
        ? err("The AI key isn't set up yet. Add OPENROUTER_API_KEY to .env.local.", 500)
        : err("Couldn't write the report right now. Please try again.", 502);
    }
    let args: unknown;
    try {
      args = JSON.parse(result.call?.arguments ?? "");
    } catch {
      return err("The AI's report wasn't usable. Tap Generate again.", 422);
    }
    const checked = validateReport(args, stats, DEPARTMENTS);
    if (!checked.ok) {
      console.warn("Rejected AI report:", checked.reason);
      return err("The AI's report wasn't usable. Tap Generate again.", 422);
    }

    const report: TeamReport = { ...checked.report, generatedAt: new Date().toISOString(), phaseLabel: stats.phaseLabel };
    const { error } = await db().from("fests").update({ report }).eq("code", code);
    if (error) throw error;
    return Response.json({ report, stats });
  } catch (e) {
    return failure(e);
  }
}
