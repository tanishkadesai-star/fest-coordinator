// Run with: node scripts/test-report.mjs
// Checks the workload statistics and the checker for the AI's written report. No network, no AI.
import { computeOverview } from "../src/lib/overview.ts";
import { computeStats, validateReport } from "../src/lib/report.ts";

let failed = 0;
function check(label, actual, expected) {
  const ok = JSON.stringify(actual) === JSON.stringify(expected);
  if (!ok) failed++;
  console.log(`${ok ? "PASS" : "FAIL"}  ${label}${ok ? "" : `  (got ${JSON.stringify(actual)}, wanted ${JSON.stringify(expected)})`}`);
}

const DEPARTMENTS = ["Logistics", "Hospitality"];
const plan = {
  departments: [
    { name: "Logistics", tasks: [{ title: "L1", day: 0 }, { title: "L2", day: 1 }] },
    { name: "Hospitality", tasks: ["H1", "H2", "H3", "H4"].map((title, i) => ({ title, day: i === 0 ? 0 : 1 })) },
  ],
};
// Hospitality: Asha did 3 tasks and took 1 request, Ravi did nothing, Priya did 1. Logistics: Dev did 1.
const statuses = [
  { task_key: "1-0", claimed_by: "Asha", done: true },
  { task_key: "1-1", claimed_by: "Asha", done: true },
  { task_key: "1-2", claimed_by: "Asha", done: false },
  { task_key: "1-3", claimed_by: "Priya", done: true },
  { task_key: "0-0", claimed_by: "Dev", done: true },
];
const members = [
  { name: "Meera", department: "Organiser", is_organiser: true },
  { name: "Asha", department: "Hospitality", is_organiser: false },
  { name: "Ravi", department: "Hospitality", is_organiser: false },
  { name: "Priya", department: "Hospitality", is_organiser: false },
  { name: "Dev", department: "Logistics", is_organiser: false },
];
const requests = [{ department: "Hospitality", text: "Coffee", claimed_by: "Asha" }];
const overview = computeOverview({ departments: DEPARTMENTS, plan, days: 1, phase: 1, statuses, members, requests });
const stats = computeStats(overview);

check("the organiser belongs to no department", overview.departments.flatMap((d) => d.members.map((m) => m.name)).includes("Meera"), false);
check("the organiser is listed separately", overview.organisers, ["Meera"]);
const hosp = stats.departments.find((d) => d.name === "Hospitality");
const by = (n) => hosp.members.find((m) => m.name === n);
check("Asha: 2 done, 1 in progress, 1 request, 3 completed", [by("Asha").planDone, by("Asha").planInProgress, by("Asha").requestsTaken, by("Asha").completed], [2, 1, 1, 3]);
check("Ravi did nothing", by("Ravi").completed, 0);
check("members are ranked most to least", hosp.members.map((m) => m.name), ["Asha", "Priya", "Ravi"]);
check("department average is (3+1+0)/3 = 1.3", hosp.averageCompleted, 1.3);
check("Ravi is flagged (below half the average)", by("Ravi").belowTeammates, true);
check("Priya is not flagged (1 is above half of 1.3)", by("Priya").belowTeammates, false);
check("a one-person department is never flagged", stats.departments.find((d) => d.name === "Logistics").members[0].belowTeammates, false);
check("untaken tasks are counted (Logistics has 1)", stats.departments.find((d) => d.name === "Logistics").untaken, 1);
check("team totals", [stats.totalPeople, stats.totalPlanTasks, stats.totalPlanDone, stats.totalUntaken], [4, 6, 4, 1]);

const goodReport = {
  summary: "Hospitality has 3 people and 4 plan tasks are done in total.",
  departments: [{ name: "Hospitality", note: "3 people, 1 untaken task." }],
  caveats: ["Counts do not show effort or difficulty."],
};
check("a faithful report is accepted", validateReport(goodReport, stats, DEPARTMENTS).ok, true);
check("a report that names an individual is rejected", validateReport({ ...goodReport, summary: "Asha did the most work." }, stats, DEPARTMENTS).ok, false);
check("a name inside a department note is rejected too", validateReport({ ...goodReport, departments: [{ name: "Hospitality", note: "Ravi did nothing." }] }, stats, DEPARTMENTS).ok, false);
check("a report quoting an invented number is rejected", validateReport({ ...goodReport, summary: "47 plan tasks are done." }, stats, DEPARTMENTS).ok, false);
check("a report naming a department that doesn't exist is rejected", validateReport({ ...goodReport, departments: [{ name: "Catering", note: "Fine." }] }, stats, DEPARTMENTS).ok, false);
check("a report with no summary is rejected", validateReport({ ...goodReport, summary: "" }, stats, DEPARTMENTS).ok, false);
check("garbage is rejected", validateReport("here is your report", stats, DEPARTMENTS).ok, false);
check("a report with no department notes is fine", validateReport({ ...goodReport, departments: [] }, stats, DEPARTMENTS).ok, true);

console.log(failed === 0 ? "\nAll checks passed." : `\n${failed} check(s) FAILED.`);
process.exit(failed === 0 ? 0 : 1);
