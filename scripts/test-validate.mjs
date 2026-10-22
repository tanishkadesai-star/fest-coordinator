// Run with: node scripts/test-validate.mjs
// Checks the plain-code rules with good and bad examples. No network, no AI.
import { DEPARTMENTS, MAX_TASKS, MIN_TASKS, validatePlan, validatePlanInput } from "../src/lib/validate.ts";

let failed = 0;
function check(label, actual, expected) {
  const ok = actual === expected;
  if (!ok) failed++;
  console.log(`${ok ? "PASS" : "FAIL"}  ${label}${ok ? "" : `  (got ${actual}, wanted ${expected})`}`);
}

// Builds a plan: each department gets `tasksEach` tasks, two in Preparation (day 0), the rest
// spread over the event days 1..days, and the last one in Wrap-up (day days + 1).
function makePlan({ days = 2, tasksEach = 8, mutate } = {}) {
  const plan = {
    departments: DEPARTMENTS.map((name) => ({
      name,
      tasks: Array.from({ length: tasksEach }, (_, i) => ({
        title: `${name} task ${i + 1}`,
        day: i < 2 ? 0 : i === tasksEach - 1 ? days + 1 : ((i - 2) % days) + 1,
      })),
    })),
  };
  if (mutate) mutate(plan);
  return plan;
}
const ok = (plan, days) => validatePlan(plan, days).ok;

// Plans
check("good 2-day plan is accepted", ok(makePlan(), 2), true);
check("good 1-day plan is accepted", ok(makePlan({ days: 1 }), 1), true);
check("good 3-day plan is accepted", ok(makePlan({ days: 3 }), 3), true);
check(`minimum of ${MIN_TASKS} tasks is accepted`, ok(makePlan({ tasksEach: MIN_TASKS }), 2), true);
check(`maximum of ${MAX_TASKS} tasks is accepted`, ok(makePlan({ tasksEach: MAX_TASKS }), 2), true);
check(`${MIN_TASKS - 1} tasks in a department is rejected`, ok(makePlan({ tasksEach: MIN_TASKS - 1 }), 2), false);
check(`${MAX_TASKS + 1} tasks in a department is rejected`, ok(makePlan({ tasksEach: MAX_TASKS + 1 }), 2), false);
check("a day past Wrap-up is rejected", ok(makePlan({ mutate: (p) => (p.departments[1].tasks[3].day = 4) }), 2), false);
check("a negative day is rejected", ok(makePlan({ mutate: (p) => (p.departments[1].tasks[3].day = -1) }), 2), false);
check("a fractional day is rejected", ok(makePlan({ mutate: (p) => (p.departments[1].tasks[3].day = 1.5) }), 2), false);
check("a plan for 3 days checked against 2 days is rejected", ok(makePlan({ days: 3 }), 2), false);
check("a department with no Preparation task is rejected", ok(makePlan({ mutate: (p) => p.departments[2].tasks.forEach((t) => t.day === 0 && (t.day = 1)) }), 2), false);
check("a department with no event-day task is rejected", ok(makePlan({ mutate: (p) => p.departments[2].tasks.forEach((t) => t.day >= 1 && t.day <= 2 && (t.day = 3)) }), 2), false);
check(
  "an event day nobody plans for is rejected",
  ok(makePlan({ mutate: (p) => p.departments.forEach((d) => d.tasks.forEach((t) => t.day === 2 && (t.day = 1))) }), 2),
  false
);
check("missing department is rejected", ok(makePlan({ mutate: (p) => p.departments.pop() }), 2), false);
check("unknown department name is rejected", ok(makePlan({ mutate: (p) => (p.departments[0].name = "Catering") }), 2), false);
check("duplicate department is rejected", ok(makePlan({ mutate: (p) => (p.departments[1].name = p.departments[0].name) }), 2), false);
check("empty task title is rejected", ok(makePlan({ mutate: (p) => (p.departments[0].tasks[0].title = "  ") }), 2), false);
check("null is rejected", ok(null, 2), false);
check("garbage is rejected", ok({ hello: "world" }, 2), false);
check("a string is rejected", ok("here is your plan!", 2), false);
const sorted = validatePlan(makePlan({ mutate: (p) => p.departments[0].tasks.reverse() }), 2);
check("tasks come back in day order", sorted.ok && sorted.plan.departments[0].tasks.every((t, i, a) => i === 0 || a[i - 1].day <= t.day), true);

// Form
const good = { festType: "Cultural", days: 2, attendance: 800, highlights: "battle of bands and a hackathon" };
check("good form is accepted", validatePlanInput(good), null);
check("good form with extra details is accepted", validatePlanInput({ ...good, details: "Chief guest arrives on day 1." }), null);
check("empty highlights rejected", validatePlanInput({ ...good, highlights: "" }) === null, false);
check('one-word highlights ("fest") rejected', validatePlanInput({ ...good, highlights: "fest" }) === null, false);
check("0 days rejected", validatePlanInput({ ...good, days: 0 }) === null, false);
check("4 days rejected", validatePlanInput({ ...good, days: 4 }) === null, false);
check("attendance NaN rejected", validatePlanInput({ ...good, attendance: NaN }) === null, false);
check("negative attendance rejected", validatePlanInput({ ...good, attendance: -5 }) === null, false);
check("unknown fest type rejected", validatePlanInput({ ...good, festType: "Wedding" }) === null, false);
check("over-long extra details rejected", validatePlanInput({ ...good, details: "x".repeat(1501) }) === null, false);

console.log(failed === 0 ? "\nAll checks passed." : `\n${failed} check(s) FAILED.`);
process.exit(failed === 0 ? 0 : 1);
