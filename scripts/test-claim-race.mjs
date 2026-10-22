// Run with the app running (npm run dev) and Supabase set up:
//   node scripts/test-claim-race.mjs
// Starts a throwaway fest, then 20 times: creates a request and fires two claims at the same moment.
// Passes only if exactly one claim wins every time and the other is told "already taken".
const BASE = process.argv[2] ?? "http://localhost:3000";

async function post(path, body) {
  const res = await fetch(BASE + path, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  return { status: res.status, data: await res.json().catch(() => ({})) };
}

const fest = await post("/api/fest", { name: "RaceTest", department: "Logistics" });
if (!fest.data.code) {
  console.error("Could not start a test fest:", fest.data.error ?? fest.status);
  process.exit(1);
}
const code = fest.data.code;

let bad = 0;
for (let round = 1; round <= 20; round++) {
  const created = await post("/api/requests", {
    code,
    name: "RaceTest",
    department: "Logistics",
    text: `Race round ${round}`,
  });
  const id = created.data.request?.id;
  if (!id) {
    console.error("Could not create a request:", created.data.error);
    process.exit(1);
  }
  const [a, b] = await Promise.all([
    post(`/api/requests/${id}/claim`, { code, name: "Asha" }),
    post(`/api/requests/${id}/claim`, { code, name: "Ravi" }),
  ]);
  const wins = [a, b].filter((r) => r.status === 200).length;
  const taken = [a, b].filter((r) => r.status === 409).length;
  const ok = wins === 1 && taken === 1;
  if (!ok) bad++;
  console.log(`${ok ? "PASS" : "FAIL"}  round ${round}: ${wins} winner(s), ${taken} told "already taken"`);
}
console.log(bad === 0 ? "\nAll 20 races had exactly one winner." : `\n${bad} round(s) FAILED.`);
process.exit(bad === 0 ? 0 : 1);
