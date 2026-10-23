// Run with the app running (npm run dev) and Supabase set up:
//   node scripts/test-lockout.mjs
// Checks that guessing head/organiser codes gets blocked. It pretends to be a made-up visitor
// address (via x-forwarded-for), so it never blocks your real address. Leaves a throwaway fest
// and two rows in login_attempts behind; delete them afterwards.
const BASE = process.argv[2] ?? "http://localhost:3000";
const GUESSER = "198.51.100.77";
const OTHER = "203.0.113.9";

let failed = 0;
function check(label, actual, expected) {
  const ok = JSON.stringify(actual) === JSON.stringify(expected);
  if (!ok) failed++;
  console.log(`${ok ? "PASS" : "FAIL"}  ${label}${ok ? "" : `  (got ${JSON.stringify(actual)}, wanted ${JSON.stringify(expected)})`}`);
}
async function post(path, body, ip) {
  const res = await fetch(BASE + path, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...(ip ? { "x-forwarded-for": ip } : {}) },
    body: JSON.stringify(body),
  });
  return { status: res.status, data: await res.json().catch(() => ({})) };
}

const fest = await post("/api/fest", { name: "LockoutTest" });
if (!fest.data.code) { console.error("Could not create a fest:", fest.data); process.exit(1); }
const code = fest.data.code;
console.log("Test fest:", code);
const real = fest.data.organiserCode;

const wrong = [];
for (let i = 1; i <= 8; i++) wrong.push((await post("/api/login", { accessCode: "ZZZZ" + (10 + i), name: "Guesser" }, GUESSER)).status);
check("8 wrong head/organiser codes are each just 'not found'", wrong, [404, 404, 404, 404, 404, 404, 404, 404]);

const ninth = await post("/api/login", { accessCode: "ZZZZ99", name: "Guesser" }, GUESSER);
check("the 9th attempt is blocked", ninth.status, 429);
check("the message says to wait and for how long", /Too many wrong codes\. Try again in \d+ minutes?\./.test(ninth.data.error), true);

const rightWhileBlocked = await post("/api/login", { accessCode: real, name: "LockoutTest" }, GUESSER);
check("even the RIGHT code is refused while blocked", rightWhileBlocked.status, 429);

check("a different visitor address is not affected", (await post("/api/login", { accessCode: real, name: "LockoutTest" }, OTHER)).status, 200);
check("volunteers joining with the fest code are not affected by the block", (await post("/api/join", { code, name: "Vol", department: "Logistics" }, GUESSER)).status, 200);

// Volunteer join has its own, much looser limit: a few typos are fine.
const typos = [];
for (let i = 0; i < 5; i++) typos.push((await post("/api/join", { code: "ZZZZZ" + i, name: "Vol", department: "Logistics" }, OTHER)).status);
check("a few wrong fest codes (typos) are fine", typos, [404, 404, 404, 404, 404]);

console.log(failed === 0 ? `\nAll checks passed. Delete fest ${code} and the login_attempts rows when done.` : `\n${failed} check(s) FAILED (fest ${code}).`);
process.exit(failed === 0 ? 0 : 1);
