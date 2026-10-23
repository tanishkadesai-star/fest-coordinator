// Run with: node scripts/test-ask.mjs
// Checks what data each kind of person's question may use, and the checker for the AI's answer.
// No network, no AI.
import { buildAskContext, validateAnswer } from "../src/lib/ask.ts";
import { computeOverview } from "../src/lib/overview.ts";
import { computeStats } from "../src/lib/report.ts";

let failed = 0;
function check(label, actual, expected) {
  const ok = JSON.stringify(actual) === JSON.stringify(expected);
  if (!ok) failed++;
  console.log(`${ok ? "PASS" : "FAIL"}  ${label}${ok ? "" : `  (got ${JSON.stringify(actual)}, wanted ${JSON.stringify(expected)})`}`);
}

const DEPARTMENTS = ["Logistics", "Hospitality"];
const plan = {
  departments: [
    { name: "Logistics", tasks: [{ title: "Book Main Hall", day: 0 }, { title: "7:00 am: Open the hall", day: 1 }] },
    { name: "Hospitality", tasks: [{ title: "Book hotel rooms", day: 0 }, { title: "1:00 pm: Serve lunch", day: 1 }, { title: "Confirm menu", day: 0 }] },
  ],
};
const members = [
  { name: "Meera", department: "Organiser", is_organiser: true },
  { name: "Hari", department: "Logistics", is_organiser: false, is_head: true },
  { name: "Dev", department: "Logistics", is_organiser: false },
  { name: "Asha", department: "Hospitality", is_organiser: false },
  { name: "Ravi", department: "Hospitality", is_organiser: false },
];
const statuses = [
  { task_key: "1-0", claimed_by: "Asha", done: true },
  { task_key: "0-0", claimed_by: "Dev", done: false, assigned_by: "Hari" },
];
const requestRows = [
  { id: "r1", department: "Hospitality", text: "Coffee for judge 2", location: "Front row", created_by: "Meera", claimed_by: "Asha" },
  { id: "r77", department: "Logistics", text: "Extension board near the mixing desk", location: null, created_by: "Hari", claimed_by: null },
];
const files = [
  { id: "f1", title: "Day 1 running order", category: "Schedule", audience: "everyone", department: null, uploaded_by: "Hari" },
  { id: "f2", title: "Logistics crew roster", category: "Attendance sheet", audience: "department", department: "Logistics", uploaded_by: "Hari" },
  { id: "f3", title: "Hospitality meeting times", category: "Meeting timetable", audience: "department", department: "Hospitality", uploaded_by: "Meera" },
];
const overview = computeOverview({
  departments: DEPARTMENTS,
  plan,
  days: 1,
  phase: 1,
  statuses,
  members,
  requests: requestRows.map((r) => ({ department: r.department, text: r.text, claimed_by: r.claimed_by })),
});
const stats = computeStats(overview);
const build = (caller) => buildAskContext({ overview, caller, requests: requestRows, files, stats });

const volunteer = build({ name: "Asha", department: "Hospitality", isOrganiser: false, isHead: false });
const head = build({ name: "Hari", department: "Logistics", isOrganiser: false, isHead: true });
const organiser = build({ name: "Meera", department: "Organiser", isOrganiser: true, isHead: false });

// ----- What each person's question may use -----
check("a volunteer is described as a volunteer in their department", [volunteer.context.you.role, volunteer.context.you.department], ["volunteer", "Hospitality"]);
check("a volunteer's own tasks are listed", volunteer.context.you.yourTasks.map((t) => t.title), ["Book hotel rooms"]);
check("finished tasks are left out of 'not done yet'", volunteer.context.you.yourTasksNotDoneYet.map((t) => t.title), []);
check("open tasks to take now: own department, open, in the current phase only", volunteer.context.you.openTasksYouCouldTakeNow.map((t) => t.title), ["1:00 pm: Serve lunch"]);
check("the head's task that is taken but not done shows as not done yet", head.context.you.yourTasksNotDoneYet.map((t) => t.title), []);
check("the organiser has no tasks to take", organiser.context.you.openTasksYouCouldTakeNow, []);
check("a volunteer gets no workload section", "workload" in volunteer.context, false);
check("a volunteer only sees their own department's requests", volunteer.context.requests.map((r) => r.id), ["r1"]);
check("a volunteer sees public files and their department's files, not another department's", volunteer.context.files.map((f) => f.id), ["f1", "f3"]);
check("a head gets workload for their own department only", head.context.workload.map((w) => w.department), ["Logistics"]);
check("a head sees their own department's requests only", head.context.requests.map((r) => r.id), ["r77"]);
check("the organiser gets workload for every department", organiser.context.workload.map((w) => w.department), ["Logistics", "Hospitality"]);
check("the organiser sees all requests and all files", [organiser.context.requests.length, organiser.context.files.length], [2, 3]);
check("the organiser belongs to no department", organiser.context.you.department, null);
check("the organiser is not listed as a department member", organiser.context.departments.flatMap((d) => d.people.map((p) => p.name)).includes("Meera"), false);

const everything = JSON.stringify([volunteer.context, head.context, organiser.context]);
check("no tokens or access codes ever reach the AI", /token|access_code|accessCode/i.test(everything), false);
check("tasks show who has them and their phase", volunteer.context.tasks.find((t) => t.title === "Book Main Hall"), {
  id: "0-0",
  department: "Logistics",
  phase: "Prep",
  title: "Book Main Hall",
  status: "taken",
  owner: "Dev",
});

// ----- Checking the AI's answer -----
const ok = (answer, references, built = volunteer, question = "what should I do next?") => validateAnswer({ answer, references }, built, question);
check("a grounded answer is accepted and its references resolved", ok("Serve lunch at 1:00 pm. It is on you.", [{ kind: "task", id: "1-1" }]).references?.map((r) => r.label), ["1:00 pm: Serve lunch"]);
check("an answer with no references is fine", ok("You have no tasks yet.", []).ok, true);
check("citing a task that doesn't exist is rejected", ok("Do this.", [{ kind: "task", id: "9-9" }]).ok, false);
check("citing a person who doesn't exist is rejected", ok("Ask Zara.", [{ kind: "person", id: "Hospitality:Zara" }]).ok, false);
check("citing a request the person can't see is rejected", ok("There is a board request.", [{ kind: "request", id: "r77" }]).ok, false);
check("citing a file the person can't see is rejected", ok("See the roster.", [{ kind: "file", id: "f2" }]).ok, false);
check("a real person reference is accepted", ok("Asha has it.", [{ kind: "person", id: "Hospitality:Asha" }]).ok, true);
check("quoting an invented number is rejected", ok("There are 73 tasks left.", []).ok, false);
check("quoting a number that is in the data is accepted", ok("Lunch is at 1:00 pm.", []).ok, true);
check("a number that only appears inside an id is not allowed", ok("There are 77 open requests.", [], organiser).ok, false);
check("a number from the question itself is allowed", ok("Nothing about gate 9 in the data.", [], volunteer, "any news from gate 9?").ok, true);
check("an empty answer is rejected", ok("   ", []).ok, false);
check("garbage is rejected", validateAnswer("hello", volunteer, "hi").ok, false);
check("too many references are rejected", ok("Many.", Array.from({ length: 9 }, () => ({ kind: "task", id: "1-1" }))).ok, false);
check("a malformed reference is rejected", ok("x", [{ kind: "banana", id: "1" }]).ok, false);

console.log(failed === 0 ? "\nAll checks passed." : `\n${failed} check(s) FAILED.`);
process.exit(failed === 0 ? 0 : 1);
