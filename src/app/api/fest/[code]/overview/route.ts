import { loadOverview } from "@/lib/overviewData";
import { failure, festExists } from "@/lib/supabase";

// Polled by every phone on the overview screen.
export async function GET(_request: Request, { params }: { params: Promise<{ code: string }> }) {
  const code = (await params).code.toUpperCase();
  try {
    if (!(await festExists(code))) {
      return Response.json({ error: "Fest not found." }, { status: 404 });
    }
    return Response.json({ overview: await loadOverview(code) });
  } catch (e) {
    return failure(e);
  }
}
