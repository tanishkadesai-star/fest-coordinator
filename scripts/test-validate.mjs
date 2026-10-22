// Run with: node scripts/test-validate.mjs
// Checks the plain-code rules with good and bad examples. No network, no AI.
import { DEPARTMENTS, validatePlan, validatePlanInput } from "../src/lib/validate.ts";

let failed = 0;
function check(label, actual, expected) {
  const ok = actual === expected;
  if (!ok) failed++;
  console.log(`${ok ? "PASS" : "FAIL"}  ${label}${ok ? "" : `  (got ${actual}, wanted ${expected})`}`);
}

// Builds a plan: every department gets `tasksEach` tasks spread over days 1..days.
function makePlan({ days = 2, tasksEach = 4, mutate } = {}) {
  const plan = {
    departments: DEPARTMENTS.map((name) => ({
      name,
      tasks: Array.from({ length: tasksEach }, (_, i) => ({
        title: `${name} task ${i + 1}`,
        day: (i % days) + 1,
      })),
    })),
  };
  if (mutate) mutate(plan);
  return plan;
}

// Plans
check("good 2-day plan is accepted", validatePlan(makePlan(), 2).ok, true);
check("good 1-day plan is accepted", validatePlan(makePlan({ days: 1 }), 1).ok, true);
check("good 3-day plan is accepted", validatePlan(makePlan({ days: 3 }), 3).ok, true);
check("2 tasks in a department is rejected", validatePlan(makePlan({ mutate: (p) => (p.departments[0].tasks.length = 2) }), 2).ok, false);
check("6 tasks in a department is rejected", validatePlan(makePlan({ tasksEach: 6 }), 2).ok, false);
check("Day 4 on a 2-day fest is rejected", validatePlan(makePlan({ mutate: (p) => (p.departments[1].tasks[0].day = 4) }), 2).ok, false);
check("Day 0 is rejected", validatePlan(makePlan({ mutate: (p) => (p.departments[1].tasks[0].day = 0) }), 2).ok, false);
check("fractional day is rejected", validatePlan(makePlan({ mutate: (p) => (p.departments[1].tasks[0].day = 1.5) }), 2).ok, false);
check("plan for 3 days checked against 2 days is rejected", validatePlan(makePlan({ days: 3 }), 2).ok, false);
check("plan that never uses day 2 is rejected", validatePlan(makePlan({ days: 1 }), 2).ok, false);
check("missing department is rejected", validatePlan(makePlan({ mutate: (p) => p.departments.pop() }), 2).ok, false);
check("unknown department name is rejected", validatePlan(makePlan({ mutate: (p) => (p.departments[0].name = "Catering") }), 2).ok, false);
check("duplicate department is rejected", validatePlan(makePlan({ mutate: (p) => (p.departments[1].name = p.departments[0].name) }), 2).ok, false);
check("empty task title is rejected", validatePlan(makePlan({ mutate: (p) => (p.departments[0].tasks[0].title = "  ") }), 2).ok, false);
check("null is rejected", validatePlan(null, 2).ok, false);
check("garbage is rejected", validatePlan({ hello: "world" }, 2).ok, false);
check("a string is rejected", validatePlan("here is your plan!", 2).ok, false);

// Form
const good = { festType: "Cultural", days: 2, attendance: 800, highlights: "battle of bands and a hackathon" };
check("good form is accepted", validatePlanInput(good), null);
check("empty highlights rejected", validatePlanInput({ ...good, highlights: "" }) === null, false);
check('one-word highlights ("fest") rejected', validatePlanInput({ ...good, highlights: "fest" }) === null, false);
check("0 days rejected", validatePlanInput({ ...good, days: 0 }) === null, false);
check("4 days rejected", validatePlanInput({ ...good, days: 4 }) === null, false);
check("attendance NaN rejected", validatePlanInput({ ...good, attendance: NaN }) === null, false);
check("negative attendance rejected", validatePlanInput({ ...good, attendance: -5 }) === null, false);
check("unknown fest type rejected", validatePlanInput({ ...good, festType: "Wedding" }) === null, false);

console.log(failed === 0 ? "\nAll checks passed." : `\n${failed} check(s) FAILED.`);
process.exit(failed === 0 ? 0 : 1);
