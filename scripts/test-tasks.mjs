// Run with the app running (npm run dev) and Supabase set up:
//   node scripts/test-tasks.mjs
// Checks plan-task claiming, done, phases and the overview against the real database,
// using a hand-made plan (no AI call). Leaves a throwaway fest behind; delete it afterwards.
const BASE = process.argv[2] ?? "http://localhost:3000";
const DEPARTMENTS = [
  "Logistics", "Hospitality", "Stage & Programme", "Tech & AV",
  "Marketing & Social", "Finance & Sponsors", "Volunteers & Crowd", "Safety & Medical",
];

let failed = 0;
function check(label, actual, expected) {
  const ok = JSON.stringify(actual) === JSON.stringify(expected);
  if (!ok) failed++;
  console.log(`${ok ? "PASS" : "FAIL"}  ${label}${ok ? "" : `  (got ${JSON.stringify(actual)}, wanted ${JSON.stringify(expected)})`}`);
}
async function post(path, body) {
  const res = await fetch(BASE + path, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
  return { status: res.status, data: await res.json().catch(() => ({})) };
}
const overview = async (code) => (await (await fetch(`${BASE}/api/fest/${code}/overview`)).json()).overview;

const plan = {
  departments: DEPARTMENTS.map((name) => ({
    name,
    tasks: [1, 2, 1].map((day, i) => ({ title: `${name} task ${i + 1}`, day })),
  })),
};
const planInput = { festType: "Cultural", days: 2, attendance: 500, highlights: "battle of bands and a hackathon" };

const fest = await post("/api/fest", { name: "Meera", department: "Logistics", plan, planInput });
if (!fest.data.code) { console.error("Could not create a fest:", fest.data); process.exit(1); }
const code = fest.data.code;
console.log("Test fest:", code);
for (const [name, department] of [["Asha", "Hospitality"], ["Ravi", "Hospitality"], ["Dev", "Logistics"]]) {
  await post("/api/join", { code, name, department });
}

let o = await overview(code);
check("starts at Preparation", o.phaseLabel, "Preparation");
check("phases are Preparation, Day 1, Day 2, Wrap-up", o.phases, ["Preparation", "Day 1", "Day 2", "Wrap-up"]);
check("24 tasks in total, 0% done", [o.totalTasks, o.percent], [24, 0]);

// Hospitality is department number 1, so its first task has the key "1-0".
const hosp = "1-0";
check("a Logistics member cannot take a Hospitality task", (await post(`/api/fest/${code}/tasks/${hosp}/claim`, { name: "Dev" })).status, 403);
check("an unknown task is not found", (await post(`/api/fest/${code}/tasks/1-9/claim`, { name: "Asha" })).status, 404);

const [a, b] = await Promise.all([
  post(`/api/fest/${code}/tasks/${hosp}/claim`, { name: "Asha" }),
  post(`/api/fest/${code}/tasks/${hosp}/claim`, { name: "Ravi" }),
]);
check("two simultaneous claims: exactly one wins, one is told 'already taken'", [a.status, b.status].sort(), [200, 409]);
const winner = a.status === 200 ? "Asha" : "Ravi";
const loser = winner === "Asha" ? "Ravi" : "Asha";

check("the loser cannot mark it done", (await post(`/api/fest/${code}/tasks/${hosp}/done`, { name: loser })).status, 403);
check("an untaken task cannot be marked done", (await post(`/api/fest/${code}/tasks/1-1/done`, { name: winner })).status, 409);
o = await overview(code);
const h = o.departments.find((d) => d.name === "Hospitality");
check("taken but not done: 0% and 1 in progress", [h.percent, h.inProgress, h.tasks[0].claimedBy], [0, 1, winner]);

check("the winner marks it done", (await post(`/api/fest/${code}/tasks/${hosp}/done`, { name: winner })).status, 200);
o = await overview(code);
const h2 = o.departments.find((d) => d.name === "Hospitality");
check("Hospitality is 1 of 3 done = 33%", [h2.done, h2.total, h2.percent], [1, 3, 33]);
check("whole fest is 1 of 24 = 4%", [o.totalDone, o.percent], [1, 4]);
const person = h2.members.find((m) => m.name === winner);
check("the roster lists the winner with their task", person.tasks.map((t) => [t.kind, t.done]), [["plan", true]]);
check("the other volunteer is listed with no tasks", h2.members.find((m) => m.name === loser).tasks.length, 0);

const req = await post("/api/requests", { code, name: "Meera", department: "Hospitality", text: "Coffee for judge 2", location: "Front row" });
await post(`/api/requests/${req.data.request.id}/claim`, { code, name: loser });
o = await overview(code);
const withReq = o.departments.find((d) => d.name === "Hospitality").members.find((m) => m.name === loser);
check("a claimed live request also shows against the volunteer", withReq.tasks.map((t) => t.kind), ["request"]);

check("a non-organiser cannot change the phase", (await post(`/api/fest/${code}/phase`, { name: "Dev", phase: 1 })).status, 403);
check("a phase that doesn't exist is refused", (await post(`/api/fest/${code}/phase`, { name: "Meera", phase: 9 })).status, 400);
check("the organiser sets Day 1", (await post(`/api/fest/${code}/phase`, { name: "Meera", phase: 1 })).status, 200);
o = await overview(code);
check("everyone now sees 'Day 1 of 2'", o.phaseLabel, "Day 1 of 2");

console.log(failed === 0 ? `\nAll checks passed. Delete fest ${code} from the database when done.` : `\n${failed} check(s) FAILED (fest ${code}).`);
process.exit(failed === 0 ? 0 : 1);
