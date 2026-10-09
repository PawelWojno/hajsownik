// Smoke test: proves the built app, the Cloudflare adapter, the Supabase auth flow and the expense/income API still
// work together. Zero dependencies on purpose. Run against a live server:
// BASE_URL=http://localhost:4321 node scripts/smoke.mjs

const BASE_URL = process.env.BASE_URL ?? "http://localhost:4321";
const email = `smoke-${Date.now()}@example.com`;
const password = "Smoke-Test-Passw0rd!";
const jar = new Map();

function cookieHeader() {
  return [...jar.entries()].map(([k, v]) => `${k}=${v}`).join("; ");
}

function storeCookies(response) {
  for (const raw of response.headers.getSetCookie()) {
    const [pair, ...attrs] = raw.split(";");
    const [name, ...rest] = pair.split("=");
    const expired = attrs.some((a) => /max-age=0/i.test(a.trim()));
    if (expired) jar.delete(name.trim());
    else jar.set(name.trim(), rest.join("="));
  }
}

// `form` sends an urlencoded body (auth routes), `json` sends a JSON body (expense/income API).
async function request(path, { method = "GET", form, json } = {}) {
  const contentType = json ? "application/json" : form ? "application/x-www-form-urlencoded" : undefined;
  const response = await fetch(BASE_URL + path, {
    method,
    redirect: "manual",
    headers: {
      Cookie: cookieHeader(),
      Origin: BASE_URL,
      ...(contentType ? { "Content-Type": contentType } : {}),
    },
    body: json ? JSON.stringify(json) : form ? new URLSearchParams(form).toString() : undefined,
  });
  storeCookies(response);
  return {
    status: response.status,
    location: response.headers.get("location") ?? "",
    body: await response.text(),
  };
}

// Set by the dashboard step, used by the API steps.
let categoryId = "";

function leftFrom(actual) {
  try {
    return JSON.parse(actual.body).summary.left;
  } catch {
    return undefined;
  }
}

// Each step: [name, run, expected]. `location` must match exactly, `locationPrefix` only by prefix, and `check`
// returns a failure message (or null) for anything the status and redirect cannot express.
const steps = [
  ["home renders", () => request("/"), { status: 200 }],
  ["dashboard redirects anonymous user", () => request("/dashboard"), { status: 302, location: "/auth/signin" }],
  [
    "signup creates account",
    () => request("/api/auth/signup", { method: "POST", form: { email, password, householdName: "Mój dom" } }),
    { status: 302, location: "/auth/confirm-email" },
  ],
  [
    "signin rejects wrong password",
    () => request("/api/auth/signin", { method: "POST", form: { email, password: "wrong" } }),
    { status: 302, locationPrefix: "/auth/signin?error=" },
  ],
  [
    "signin accepts correct password",
    () => request("/api/auth/signin", { method: "POST", form: { email, password } }),
    { status: 302, location: "/dashboard" },
  ],
  ["home redirects signed-in user to the month screen", () => request("/"), { status: 302, location: "/dashboard" }],
  [
    "dashboard renders the month screen for signed-in user",
    async () => {
      const actual = await request("/dashboard");
      // The category buttons exist only while the panel is open; the page root lists the ids for this test.
      categoryId = /data-category-ids="([^",]+)/.exec(actual.body)?.[1] ?? "";
      return actual;
    },
    {
      status: 200,
      check: (actual) => {
        if (actual.body.includes("[object Object]")) return "body contains [object Object]";
        if (!actual.body.includes("Zostaje")) return 'body has no "Zostaje"';
        return categoryId ? null : "no category id found in data-category-ids";
      },
    },
  ],
  [
    "expense endpoint saves an expense and returns fresh sums",
    () => request("/api/expenses", { method: "POST", json: { amount: "12,50", categoryId } }),
    {
      status: 200,
      check: (actual) => (leftFrom(actual) === -1250 ? null : `left is ${leftFrom(actual)}, expected -1250`),
    },
  ],
  [
    "income endpoint saves an income and returns fresh sums",
    () => request("/api/incomes", { method: "POST", json: { amount: "1000", source: "wynagrodzenie" } }),
    {
      status: 200,
      check: (actual) => (leftFrom(actual) === 98750 ? null : `left is ${leftFrom(actual)}, expected 98750`),
    },
  ],
  [
    "expense endpoint rejects a zero amount",
    () => request("/api/expenses", { method: "POST", json: { amount: "0", categoryId } }),
    { status: 400 },
  ],
  ["signout clears session", () => request("/api/auth/signout", { method: "POST" }), { status: 302, location: "/" }],
  ["dashboard redirects after signout", () => request("/dashboard"), { status: 302, location: "/auth/signin" }],
  [
    "expense endpoint rejects an anonymous request",
    () => request("/api/expenses", { method: "POST", json: { amount: "1", categoryId } }),
    { status: 401 },
  ],
];

let failed = 0;
for (const [name, run, expected] of steps) {
  const actual = await run();
  const locationOk =
    (expected.location === undefined || actual.location === expected.location) &&
    (expected.locationPrefix === undefined || actual.location.startsWith(expected.locationPrefix));
  const problem = expected.check?.(actual) ?? null;
  const ok = actual.status === expected.status && locationOk && problem === null;
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}  -> ${actual.status} ${actual.location}`);
  if (!ok) {
    failed++;
    const wanted = expected.location ?? expected.locationPrefix ?? "";
    console.log(`      expected ${expected.status} ${wanted}${problem ? ` (${problem})` : ""}`);
  }
}

console.log(failed ? `\n${failed} step(s) failed` : "\nAll smoke steps passed");
process.exit(failed ? 1 : 0);
