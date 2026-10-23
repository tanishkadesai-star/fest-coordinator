// Run with the app running (npm run dev) and Supabase set up:
//   node scripts/test-tasks.mjs
// Checks claiming, done, phases, the organiser's role, department-head login and assigning,
// the Published files rules, and the team report's access rules against the real database,
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
async function get(path) {
  const res = await fetch(BASE + path);
  return { status: res.status, data: await res.json().catch(() => ({})) };
}
const overview = async (code) => (await get(`/api/fest/${code}/overview`)).data.overview;

// 2 event days: day 0 is Preparation, days 1 and 2 are event days, day 3 is Wrap-up.
const plan = {
  departments: DEPARTMENTS.map((name) => ({
    name,
    tasks: [0, 0, 1, 2, 1, 3].map((day, i) => ({ title: `${name} task ${i + 1}`, day })),
  })),
};
const planInput = { festType: "Cultural", days: 2, attendance: 500, highlights: "battle of bands and a hackathon" };

// The organiser gives only a name: they belong to no department.
const fest = await post("/api/fest", { name: "Meera", plan, planInput });
if (!fest.data.code) { console.error("Could not create a fest:", fest.data); process.exit(1); }
const code = fest.data.code;
const org = { name: "Meera", token: fest.data.token };
console.log("Test fest:", code);

// People: volunteers join with the fest code; heads log in with the head code for their department.
const joinVol = async (name, department) => (await post("/api/join", { code, name, department })).data;
const dev = { name: "Dev", ...(await joinVol("Dev", "Logistics")) };
const mia = { name: "Mia", ...(await joinVol("Mia", "Logistics")) };
const asha = { name: "Asha", ...(await joinVol("Asha", "Hospitality")) };
const ravi = { name: "Ravi", ...(await joinVol("Ravi", "Hospitality")) };
const access = await get(`/api/fest/${code}/access?name=${org.name}&token=${org.token}`);
const headCode = (d) => access.data.heads.find((h) => h.department === d).code;

check("a volunteer has no head powers", [dev.isHead, dev.isOrganiser], [false, false]);
check("the organiser can read the access codes (8 heads + organiser code)", [access.data.heads.length, !!access.data.organiserCode], [8, true]);
check("the fest response also hands the organiser their code", fest.data.organiserCode, access.data.organiserCode);
check("a volunteer cannot read the access codes", (await get(`/api/fest/${code}/access?name=Dev&token=${dev.token}`)).status, 403);
check("a wrong token cannot read the access codes", (await get(`/api/fest/${code}/access?name=Meera&token=nope`)).status, 403);

const hari = { name: "Hari", ...(await post("/api/login", { accessCode: headCode("Logistics"), name: "Hari" })).data };
const hema = { name: "Hema", ...(await post("/api/login", { accessCode: headCode("Hospitality"), name: "Hema" })).data };
check("logging in with a head code makes a department head", [hari.isHead, hari.department, hari.code], [true, "Logistics", code]);
check("the head is not the organiser", hari.isOrganiser, false);
check("a wrong head code is refused", (await post("/api/login", { accessCode: "ZZZZZZ", name: "Hari" })).status, 404);
check("logging in again as the same head gives the same token (a second phone works)", (await post("/api/login", { accessCode: headCode("Logistics"), name: "Hari" })).data.token, hari.token);
const org2 = (await post("/api/login", { accessCode: access.data.organiserCode, name: "Meera" })).data;
check("the organiser code gets the organiser back in with their token", [org2.isOrganiser, org2.token], [true, org.token]);

let o = await overview(code);
check("the organiser is not in any department's team list", o.departments.flatMap((d) => d.members.map((m) => m.name)).includes("Meera"), false);
check("heads are marked as heads in their department", o.departments.find((d) => d.name === "Logistics").members.find((m) => m.name === "Hari").isHead, true);
check("the organiser is listed on the overview", o.organisers, ["Meera"]);
check("phases are Preparation, Day 1, Day 2, Wrap-up", o.phases, ["Preparation", "Day 1", "Day 2", "Wrap-up"]);
check("48 tasks in total, 0% done", [o.totalTasks, o.percent], [48, 0]);

// ----- Claiming (names only, as before) -----
const hosp = "1-0"; // Hospitality is department number 1
check("a Logistics member cannot take a Hospitality task", (await post(`/api/fest/${code}/tasks/${hosp}/claim`, { name: "Dev" })).status, 403);
check("the organiser cannot take a department's task", (await post(`/api/fest/${code}/tasks/${hosp}/claim`, { name: "Meera" })).status, 403);
const [a, b] = await Promise.all([
  post(`/api/fest/${code}/tasks/${hosp}/claim`, { name: "Asha" }),
  post(`/api/fest/${code}/tasks/${hosp}/claim`, { name: "Ravi" }),
]);
check("two simultaneous claims: exactly one wins, one is told 'already taken'", [a.status, b.status].sort(), [200, 409]);
const winner = a.status === 200 ? "Asha" : "Ravi";
const loser = winner === "Asha" ? "Ravi" : "Asha";
check("the loser cannot mark it done", (await post(`/api/fest/${code}/tasks/${hosp}/done`, { name: loser })).status, 403);
check("the winner marks it done", (await post(`/api/fest/${code}/tasks/${hosp}/done`, { name: winner })).status, 200);
o = await overview(code);
const h2 = o.departments.find((d) => d.name === "Hospitality");
check("Hospitality is 1 of 6 done = 17%", [h2.done, h2.total, h2.percent], [1, 6, 17]);

const req = await post("/api/requests", { code, name: "Meera", department: "Hospitality", text: "Coffee for judge 2", location: "Front row" });
const rid = req.data.request.id;
check("a Logistics member cannot take a Hospitality request", (await post(`/api/requests/${rid}/claim`, { code, name: "Dev" })).status, 403);
check("a Hospitality member takes it", (await post(`/api/requests/${rid}/claim`, { code, name: loser })).status, 200);
o = await overview(code);
check("request counts per department: 0 open, 1 taken", [o.departments[1].requestsOpen, o.departments[1].requestsTaken], [0, 1]);

// ----- Phase and report need the private token -----
check("a volunteer cannot change the phase", (await post(`/api/fest/${code}/phase`, { name: "Dev", token: dev.token, phase: 1 })).status, 403);
check("the organiser's name with a wrong token cannot change the phase", (await post(`/api/fest/${code}/phase`, { name: "Meera", token: "nope", phase: 1 })).status, 403);
check("a head cannot change the phase", (await post(`/api/fest/${code}/phase`, { name: "Hari", token: hari.token, phase: 1 })).status, 403);
check("a phase that doesn't exist is refused", (await post(`/api/fest/${code}/phase`, { name: "Meera", token: org.token, phase: 9 })).status, 400);
check("the organiser sets Day 1", (await post(`/api/fest/${code}/phase`, { name: "Meera", token: org.token, phase: 1 })).status, 200);
check("everyone now sees 'Day 1 of 2'", (await overview(code)).phaseLabel, "Day 1 of 2");

check("a volunteer cannot read the team report", (await get(`/api/fest/${code}/report?name=Asha&token=${asha.token}`)).status, 403);
check("a head cannot read the team report", (await get(`/api/fest/${code}/report?name=Hari&token=${hari.token}`)).status, 403);
check("a volunteer cannot generate the team report", (await post(`/api/fest/${code}/report`, { name: "Asha", token: asha.token })).status, 403);
const rep = await get(`/api/fest/${code}/report?name=Meera&token=${org.token}`);
check("the organiser can read live workload numbers", rep.status, 200);

// ----- Assigning tasks -----
const logi = "0-0"; // Logistics' first task
check("a volunteer cannot assign tasks", (await post(`/api/fest/${code}/tasks/${logi}/assign`, { name: "Dev", token: dev.token, assignee: "Mia" })).status, 403);
check("a head with a wrong token cannot assign", (await post(`/api/fest/${code}/tasks/${logi}/assign`, { name: "Hari", token: "nope", assignee: "Dev" })).status, 403);
check("the Hospitality head cannot assign a Logistics task", (await post(`/api/fest/${code}/tasks/${logi}/assign`, { name: "Hema", token: hema.token, assignee: "Dev" })).status, 403);
check("the Logistics head cannot assign a Hospitality task", (await post(`/api/fest/${code}/tasks/1-1/assign`, { name: "Hari", token: hari.token, assignee: "Asha" })).status, 403);
check("a head cannot give a task to someone from another department", (await post(`/api/fest/${code}/tasks/${logi}/assign`, { name: "Hari", token: hari.token, assignee: "Asha" })).status, 400);
check("a head cannot give a task to the organiser", (await post(`/api/fest/${code}/tasks/${logi}/assign`, { name: "Hari", token: hari.token, assignee: "Meera" })).status, 400);
check("the Logistics head assigns a task to Dev", (await post(`/api/fest/${code}/tasks/${logi}/assign`, { name: "Hari", token: hari.token, assignee: "Dev" })).status, 200);
o = await overview(code);
const t0 = o.departments[0].tasks[0];
check("the task shows Dev as owner, assigned by Hari", [t0.claimedBy, t0.assignedBy, t0.done], ["Dev", "Hari", false]);
check("the head reassigns it to Mia", (await post(`/api/fest/${code}/tasks/${logi}/assign`, { name: "Hari", token: hari.token, assignee: "Mia" })).status, 200);
check("now Mia has it", (await overview(code)).departments[0].tasks[0].claimedBy, "Mia");
check("the head frees the task up again", (await post(`/api/fest/${code}/tasks/${logi}/assign`, { name: "Hari", token: hari.token, assignee: null })).status, 200);
const freed = (await overview(code)).departments[0].tasks[0];
check("the task is open again with no owner", [freed.claimedBy, freed.assignedBy], [null, null]);
check("the organiser can assign any department's task", (await post(`/api/fest/${code}/tasks/1-2/assign`, { name: "Meera", token: org.token, assignee: "Ravi" })).status, 200);
await post(`/api/fest/${code}/tasks/${logi}/assign`, { name: "Hari", token: hari.token, assignee: "Dev" });
check("the assignee marks their assigned task done", (await post(`/api/fest/${code}/tasks/${logi}/done`, { name: "Dev" })).status, 200);
check("a finished task can't be reassigned", (await post(`/api/fest/${code}/tasks/${logi}/assign`, { name: "Hari", token: hari.token, assignee: "Mia" })).status, 409);
check("a finished task can't be freed up", (await post(`/api/fest/${code}/tasks/${logi}/assign`, { name: "Hari", token: hari.token, assignee: null })).status, 409);

// ----- Published files -----
async function upload(who, fields, fileName = "schedule.txt", content = "Day 1: 9am opening ceremony") {
  const form = new FormData();
  form.set("name", who.name);
  form.set("token", who.token);
  for (const [k, v] of Object.entries(fields)) form.set(k, v);
  form.set("file", new File([content], fileName, { type: "text/plain" }));
  const res = await fetch(`${BASE}/api/fest/${code}/files`, { method: "POST", body: form });
  return { status: res.status, data: await res.json().catch(() => ({})) };
}
const list = async (who) => (await get(`/api/fest/${code}/files?name=${who.name}&token=${who.token}`)).data.files ?? [];
const del = (who, id) => post(`/api/fest/${code}/files/${id}/delete`, { name: who.name, token: who.token });

const sched = { title: "Day 1 schedule", category: "Schedule", audience: "everyone" };
check("a volunteer cannot publish a file", (await upload(dev, sched)).status, 403);
check("a wrong token cannot publish a file", (await upload({ name: "Hari", token: "nope" }, sched)).status, 403);
check("a file with no title is refused", (await upload(hari, { ...sched, title: " " })).status, 400);
check("an unknown category is refused", (await upload(hari, { ...sched, category: "Memes" })).status, 400);
check("a program file (.exe) is refused", (await upload(hari, sched, "virus.exe")).status, 400);
check("a web page (.html) is refused", (await upload(hari, sched, "page.html", "<script>alert(1)</script>")).status, 400);
check("a file over 4 MB is refused", (await upload(hari, sched, "big.txt", "x".repeat(4 * 1024 * 1024 + 1))).status, 400);
check("the Logistics head cannot publish for Hospitality", (await upload(hari, { ...sched, audience: "Hospitality" })).status, 403);

const forAll = await upload(hari, sched);
check("a head publishes a file for everyone", forAll.status, 200);
const forLogistics = await upload(hari, { title: "Logistics crew roster", category: "Attendance sheet", audience: "Logistics" }, "roster.csv", "name,present\nDev,yes");
check("a head publishes a file for their own department", forLogistics.status, 200);
const forHosp = await upload(org, { title: "Hospitality meeting times", category: "Meeting timetable", audience: "Hospitality" }, "meeting.txt", "Daily 8am");
check("the organiser publishes for a chosen department", forHosp.status, 200);

const titles = async (who) => (await list(who)).map((f) => f.title).sort();
check("Dev (Logistics) sees the public file and the Logistics file", await titles(dev), ["Day 1 schedule", "Logistics crew roster"]);
check("Asha (Hospitality) sees the public file and the Hospitality file", await titles(asha), ["Day 1 schedule", "Hospitality meeting times"]);
check("the organiser sees every file", (await titles(org)).length, 3);
check("a wrong token cannot list files", (await get(`/api/fest/${code}/files?name=Dev&token=nope`)).status, 403);
const mine = (await list(dev)).find((f) => f.title === "Day 1 schedule");
check("a file comes with a link that opens it", mine.url !== null && (await (await fetch(mine.url)).text()), "Day 1: 9am opening ceremony");
check("the file records who published it", [mine.uploadedBy, mine.uploaderRole, mine.category], ["Hari", "head", "Schedule"]);

check("another head cannot remove someone else's file", (await del(hema, forAll.data.id)).status, 403);
check("a volunteer cannot remove a file", (await del(dev, forAll.data.id)).status, 403);
check("the head removes their own file", (await del(hari, forAll.data.id)).status, 200);
check("the organiser removes anyone's file", (await del(org, forLogistics.data.id)).status, 200);
check("the organiser removes the last file", (await del(org, forHosp.data.id)).status, 200);
check("no files are left", (await list(org)).length, 0);

console.log(failed === 0 ? `\nAll checks passed. Delete fest ${code} from the database when done.` : `\n${failed} check(s) FAILED (fest ${code}).`);
process.exit(failed === 0 ? 0 : 1);
