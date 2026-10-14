// Smoke test: proves the built app, the Cloudflare adapter, the Supabase auth flow and the expense/income API still
// work together. Zero dependencies on purpose. Run against a live server:
// BASE_URL=http://localhost:4321 node scripts/smoke.mjs

const BASE_URL = process.env.BASE_URL ?? "http://localhost:4321";
const email = `smoke-${Date.now()}@example.com`;
const password = "Smoke-Test-Passw0rd!";
const newPassword = "Smoke-New-Passw0rd!";
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
    cacheControl: response.headers.get("cache-control") ?? "",
    body: await response.text(),
  };
}

// Set by the dashboard step, used by the API steps.
let categoryId = "";
// Set by the category steps.
let newCategoryId = "";
// Set by the recurring-expense steps.
let recurringId = "";
// Set by the recurring-income steps.
let recurringIncomeId = "";
// The income banner is found by its aria-label: its buttons read the same as the expense banner's.
const INCOME_BANNER = "Cykliczne przychody: koniec horyzontu";

function recurringItems(actual) {
  try {
    return JSON.parse(actual.body).items;
  } catch {
    return undefined;
  }
}

function leftFrom(actual) {
  try {
    return JSON.parse(actual.body).summary.left;
  } catch {
    return undefined;
  }
}

// Set by the history steps.
let otherCategoryId = "";
let historyEntryId = "";
let historyLabel = "";
let cycleId = "";
let cycleEntryId = "";

function historyEntries(actual) {
  try {
    return JSON.parse(actual.body).entries;
  } catch {
    return undefined;
  }
}

// Current and next month as YYYY-MM, in Warsaw like the server ("today" there is not UTC today).
const warsawNow = Object.fromEntries(
  new Intl.DateTimeFormat("en-US", { timeZone: "Europe/Warsaw", year: "numeric", month: "2-digit" })
    .formatToParts(new Date())
    .map((part) => [part.type, part.value]),
);
const currentMonth = `${warsawNow.year}-${warsawNow.month}`;
const nextMonth = new Date(Date.UTC(Number(warsawNow.year), Number(warsawNow.month), 1)).toISOString().slice(0, 7);
const currentMonthLabel = (() => {
  const label = new Intl.DateTimeFormat("pl-PL", { month: "long", year: "numeric", timeZone: "UTC" }).format(
    new Date(`${currentMonth}-01T00:00:00Z`),
  );
  return label.charAt(0).toUpperCase() + label.slice(1);
})();

function escapeHtml(text) {
  return text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

// Each step: [name, run, expected]. `location` must match exactly, `locationPrefix` only by prefix, and `check`
// returns a failure message (or null) for anything the status and redirect cannot express.
const steps = [
  ["home renders", () => request("/"), { status: 200 }],
  ["dashboard redirects anonymous user", () => request("/dashboard"), { status: 302, location: "/auth/signin" }],
  ["forgot-password page renders", () => request("/auth/forgot-password"), { status: 200 }],
  [
    "forgot-password rejects a malformed email",
    () => request("/api/auth/forgot-password", { method: "POST", form: { email: "not-an-email" } }),
    { status: 302, locationPrefix: "/auth/forgot-password?error=" },
  ],
  [
    "forgot-password answers the same for an unknown email",
    () => request("/api/auth/forgot-password", { method: "POST", form: { email: `nobody-${Date.now()}@example.com` } }),
    { status: 302, location: "/auth/forgot-password?sent=1" },
  ],
  // The auth endpoints act on POST only; a GET (e.g. "Request desktop site" re-requesting the page after a form
  // redirect) only redirects. See src/lib/auth-get.ts.
  [
    "auth endpoint GET redirects an anonymous user to sign-in",
    () => request("/api/auth/signin"),
    {
      status: 302,
      location: "/auth/signin",
      check: (actual) => (actual.cacheControl.includes("no-store") ? null : "GET redirect is not marked no-store"),
    },
  ],
  [
    "update-password page redirects anonymous user",
    () => request("/auth/update-password"),
    { status: 302, location: "/auth/signin" },
  ],
  [
    "update-password endpoint rejects an anonymous request",
    () =>
      request("/api/auth/update-password", {
        method: "POST",
        form: { password: newPassword, confirmPassword: newPassword },
      }),
    { status: 302, location: "/auth/signin" },
  ],
  [
    "reset-callback without a code sends the user back to forgot-password",
    () => request("/auth/reset-callback"),
    { status: 302, locationPrefix: "/auth/forgot-password?error=" },
  ],
  [
    "reset-callback with an invalid code sends the user back to forgot-password",
    () => request("/auth/reset-callback?code=invalid"),
    { status: 302, locationPrefix: "/auth/forgot-password?error=" },
  ],
  [
    "callback without a code sends the user back to sign-in",
    () => request("/auth/callback"),
    { status: 302, locationPrefix: "/auth/signin?error=" },
  ],
  [
    // The anonymous request has no PKCE verifier cookie, like a confirmation link opened in another browser.
    "callback with a code but no PKCE verifier sends the user to the sign-in prompt",
    () => request("/auth/callback?code=invalid"),
    { status: 302, location: "/auth/confirmed" },
  ],
  ["confirmed page renders", () => request("/auth/confirmed"), { status: 200 }],
  [
    "signup creates account",
    () => request("/api/auth/signup", { method: "POST", form: { email, password, householdName: "Mój dom" } }),
    // The local Supabase used by CI has email confirmations off, so signUp returns a session right away.
    { status: 302, location: "/dashboard" },
  ],
  [
    "forgot-password redirects signed-in user to the month screen",
    () => request("/auth/forgot-password"),
    { status: 302, location: "/dashboard" },
  ],
  [
    "confirmed page redirects signed-in user to the month screen",
    () => request("/auth/confirmed"),
    { status: 302, location: "/dashboard" },
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
  [
    "update-password rejects mismatched passwords",
    () =>
      request("/api/auth/update-password", {
        method: "POST",
        form: { password: newPassword, confirmPassword: "something-else" },
      }),
    { status: 302, locationPrefix: "/auth/update-password?error=" },
  ],
  [
    "update-password changes the password of the signed-in user",
    () =>
      request("/api/auth/update-password", {
        method: "POST",
        form: { password: newPassword, confirmPassword: newPassword },
      }),
    { status: 302, location: "/dashboard" },
  ],
  ["home redirects signed-in user to the month screen", () => request("/"), { status: 302, location: "/dashboard" }],
  [
    "auth endpoint GET redirects a signed-in user to the month screen",
    () => request("/api/auth/signup"),
    { status: 302, location: "/dashboard" },
  ],
  // A GET must never act: a GET on signout only redirects and the session stays signed in.
  ["signout GET only redirects", () => request("/api/auth/signout"), { status: 302, location: "/dashboard" }],
  ["session survives a GET on signout", () => request("/dashboard"), { status: 200 }],
  [
    "dashboard renders the month screen for signed-in user",
    async () => {
      const actual = await request("/dashboard");
      // The category buttons exist only while the panel is open; the page root lists the ids for this test.
      categoryId = /data-category-ids="([^",]+)/.exec(actual.body)?.[1] ?? "";
      // A second category, to try moving a cycle entry between categories.
      otherCategoryId = /data-category-ids="[^",]+,([^",]+)/.exec(actual.body)?.[1] ?? "";
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
    "recurring endpoint creates a two-month definition",
    async () => {
      const actual = await request("/api/recurring-expenses", {
        method: "POST",
        json: { categoryId, amount: "10", dayOfMonth: 1, months: 2 },
      });
      recurringId = recurringItems(actual)?.find((item) => item.amountMinor === 1000)?.id ?? "";
      return actual;
    },
    { status: 200, check: () => (recurringId ? null : "new definition not in the returned list") },
  ],
  [
    "dashboard shows the reminder for a definition that ends next month",
    () => request("/dashboard"),
    {
      status: 200,
      check: (actual) => {
        if (actual.body.includes("[object Object]")) return "body contains [object Object]";
        return actual.body.includes("Nie przypominaj") ? null : "reminder banner is missing";
      },
    },
  ],
  [
    "recurring endpoint dismisses the reminder",
    () => request(`/api/recurring-expenses/${recurringId}`, { method: "PATCH", json: { dismissReminder: true } }),
    {
      status: 200,
      check: (actual) =>
        recurringItems(actual)?.find((item) => item.id === recurringId)?.remind === false
          ? null
          : "reminder is still on",
    },
  ],
  [
    "dashboard hides the dismissed reminder",
    () => request("/dashboard"),
    {
      status: 200,
      check: (actual) => {
        // "Zostaje" proves the month screen rendered; without it the absence of the banner proves nothing.
        if (!actual.body.includes("Zostaje")) return 'body has no "Zostaje"';
        return actual.body.includes("Nie przypominaj") ? "reminder banner is still shown" : null;
      },
    },
  ],
  [
    "recurring endpoint changes the amount",
    () => request(`/api/recurring-expenses/${recurringId}`, { method: "PATCH", json: { amount: "20" } }),
    {
      status: 200,
      check: (actual) =>
        recurringItems(actual)?.find((item) => item.id === recurringId)?.amountMinor === 2000
          ? null
          : "amount was not updated",
    },
  ],
  [
    "recurring settings page renders for a signed-in user",
    () => request("/settings/recurring"),
    {
      status: 200,
      check: (actual) => {
        if (actual.body.includes("[object Object]")) return "body contains [object Object]";
        // "Cykliczne wydatki" is also the Topbar link text, so check a heading only the manager renders.
        return actual.body.includes("Twoje cykliczne wydatki") ? null : 'body has no "Twoje cykliczne wydatki"';
      },
    },
  ],
  [
    "recurring endpoint rejects a day outside 1-31",
    () =>
      request("/api/recurring-expenses", {
        method: "POST",
        json: { categoryId, amount: "10", dayOfMonth: 32, months: 2 },
      }),
    { status: 400 },
  ],
  [
    "recurring endpoint stops the definition",
    () => request(`/api/recurring-expenses/${recurringId}`, { method: "DELETE" }),
    { status: 200, check: (actual) => (recurringItems(actual)?.length === 0 ? null : "definition is still listed") },
  ],
  // The income steps come after the expense definition is stopped: both banners contain "Nie przypominaj", so an active
  // income banner would break the expense step above. The income banner is told apart by its aria-label instead.
  [
    "recurring income endpoint creates a two-month definition",
    async () => {
      const actual = await request("/api/recurring-incomes", {
        method: "POST",
        json: { source: "wynagrodzenie", amount: "700", dayOfMonth: 1, months: 2 },
      });
      recurringIncomeId = recurringItems(actual)?.find((item) => item.amountMinor === 70000)?.id ?? "";
      return actual;
    },
    { status: 200, check: () => (recurringIncomeId ? null : "new definition not in the returned list") },
  ],
  [
    "dashboard shows the reminder for an income that ends next month",
    () => request("/dashboard"),
    {
      status: 200,
      check: (actual) => {
        if (actual.body.includes("[object Object]")) return "body contains [object Object]";
        // "Zostaje" proves the month screen rendered; the aria-label is what only the income banner has.
        if (!actual.body.includes("Zostaje")) return 'body has no "Zostaje"';
        return actual.body.includes(INCOME_BANNER) ? null : "income reminder banner is missing";
      },
    },
  ],
  [
    "recurring income endpoint dismisses the reminder",
    () => request(`/api/recurring-incomes/${recurringIncomeId}`, { method: "PATCH", json: { dismissReminder: true } }),
    {
      status: 200,
      check: (actual) =>
        recurringItems(actual)?.find((item) => item.id === recurringIncomeId)?.remind === false
          ? null
          : "reminder is still on",
    },
  ],
  [
    "dashboard hides the dismissed income reminder",
    () => request("/dashboard"),
    {
      status: 200,
      check: (actual) => {
        // "Zostaje" proves the month screen rendered; without it the absence of the banner proves nothing.
        if (!actual.body.includes("Zostaje")) return 'body has no "Zostaje"';
        return actual.body.includes(INCOME_BANNER) ? "income reminder banner is still shown" : null;
      },
    },
  ],
  [
    "recurring income endpoint changes the amount",
    () => request(`/api/recurring-incomes/${recurringIncomeId}`, { method: "PATCH", json: { amount: "800" } }),
    {
      status: 200,
      check: (actual) =>
        recurringItems(actual)?.find((item) => item.id === recurringIncomeId)?.amountMinor === 80000
          ? null
          : "amount was not updated",
    },
  ],
  [
    "recurring income settings page renders for a signed-in user",
    () => request("/settings/recurring?typ=przychody"),
    {
      status: 200,
      check: (actual) => {
        if (actual.body.includes("[object Object]")) return "body contains [object Object]";
        // "Cykliczne" alone is also in the Topbar, so check a heading only the income manager renders.
        return actual.body.includes("Twoje cykliczne przychody") ? null : 'body has no "Twoje cykliczne przychody"';
      },
    },
  ],
  [
    "recurring income endpoint rejects an unknown source",
    () =>
      request("/api/recurring-incomes", {
        method: "POST",
        json: { source: "loteria", amount: "10", dayOfMonth: 1, months: 2 },
      }),
    { status: 400 },
  ],
  [
    "recurring income endpoint rejects a day outside 1-31",
    () =>
      request("/api/recurring-incomes", {
        method: "POST",
        json: { source: "wynagrodzenie", amount: "10", dayOfMonth: 32, months: 2 },
      }),
    { status: 400 },
  ],
  [
    "recurring income endpoint stops the definition",
    () => request(`/api/recurring-incomes/${recurringIncomeId}`, { method: "DELETE" }),
    { status: 200, check: (actual) => (recurringItems(actual)?.length === 0 ? null : "definition is still listed") },
  ],
  [
    "expense endpoint rejects a zero amount",
    () => request("/api/expenses", { method: "POST", json: { amount: "0", categoryId } }),
    { status: 400 },
  ],
  [
    "category endpoint adds a category",
    async () => {
      const actual = await request("/api/categories", { method: "POST", json: { name: "Smoke Zwierzęta" } });
      try {
        newCategoryId = JSON.parse(actual.body).categories.find((c) => c.name === "Smoke Zwierzęta").id;
      } catch {
        newCategoryId = "";
      }
      return actual;
    },
    { status: 200, check: () => (newCategoryId ? null : "new category not in the returned list") },
  ],
  [
    "category endpoint rejects a duplicate differing only in letter case",
    () => request("/api/categories", { method: "POST", json: { name: "smoke zwierzęta" } }),
    { status: 400 },
  ],
  [
    "category endpoint rejects a rename and archive in one request",
    () => request(`/api/categories/${newCategoryId}`, { method: "PATCH", json: { name: "X", archived: true } }),
    { status: 400 },
  ],
  [
    "category endpoint archives a category",
    () => request(`/api/categories/${newCategoryId}`, { method: "PATCH", json: { archived: true } }),
    { status: 200 },
  ],
  [
    "archived category disappears from the month screen",
    () => request("/dashboard"),
    {
      status: 200,
      check: (actual) => {
        const ids = /data-category-ids="([^"]*)"/.exec(actual.body)?.[1] ?? "";
        if (!ids) return "no data-category-ids found";
        return ids.includes(newCategoryId) ? "archived category is still in data-category-ids" : null;
      },
    },
  ],
  [
    "category endpoint deletes an unused category",
    () => request(`/api/categories/${newCategoryId}`, { method: "DELETE" }),
    { status: 200 },
  ],
  [
    "category endpoint answers 404 for an unknown id",
    () => request("/api/categories/00000000-0000-4000-8000-000000000000", { method: "DELETE" }),
    { status: 404 },
  ],
  // History steps. They come after the leftFrom assertions above, which assume an empty current month.
  [
    "expense endpoint saves an expense for the history steps",
    () => request("/api/expenses", { method: "POST", json: { amount: "7,77", categoryId } }),
    { status: 200 },
  ],
  [
    "history endpoint lists the new expense",
    async () => {
      const actual = await request(`/api/history?month=${currentMonth}`);
      const entry = historyEntries(actual)?.find((e) => e.kind === "expense" && e.amountMinor === 777);
      historyEntryId = entry?.id ?? "";
      historyLabel = entry?.label ?? "";
      return actual;
    },
    { status: 200, check: () => (historyEntryId ? null : "new expense not in the history list") },
  ],
  [
    "history endpoint changes the amount of an expense",
    () => request(`/api/expenses/${historyEntryId}`, { method: "PATCH", json: { amount: "8,88" } }),
    { status: 200 },
  ],
  [
    "history endpoint shows the changed amount",
    () => request(`/api/history?month=${currentMonth}`),
    {
      status: 200,
      check: (actual) =>
        historyEntries(actual)?.find((e) => e.id === historyEntryId)?.amountMinor === 888
          ? null
          : "amount was not updated",
    },
  ],
  [
    "history page renders the month label, a category and an amount",
    () => request(`/history?month=${currentMonth}`),
    {
      status: 200,
      check: (actual) => {
        if (actual.body.includes("[object Object]")) return "body contains [object Object]";
        // The Topbar also says "Historia" and "Miesiąc", so check the month label that only the page title renders.
        if (!actual.body.includes(currentMonthLabel)) return `body has no "${currentMonthLabel}"`;
        if (!historyLabel || !actual.body.includes(escapeHtml(historyLabel))) return "body has no category name";
        // formatMinor may separate the currency with a non-breaking space, so compare with plain spaces.
        return actual.body.replace(/[\u00a0\u202f]/g, " ").includes("8,88") ? null : 'body has no "8,88"';
      },
    },
  ],
  [
    "history endpoint deletes an expense",
    () => request(`/api/expenses/${historyEntryId}`, { method: "DELETE" }),
    { status: 200 },
  ],
  [
    "history endpoint no longer lists the deleted expense",
    () => request(`/api/history?month=${currentMonth}`),
    {
      status: 200,
      check: (actual) => {
        const entries = historyEntries(actual);
        if (!entries) return "no entries in the response";
        return entries.some((e) => e.id === historyEntryId) ? "deleted expense is still listed" : null;
      },
    },
  ],
  [
    "recurring endpoint creates a definition for the history steps",
    async () => {
      const actual = await request("/api/recurring-expenses", {
        method: "POST",
        json: { categoryId, amount: "33,33", dayOfMonth: 1, months: 2 },
      });
      cycleId = recurringItems(actual)?.find((item) => item.amountMinor === 3333)?.id ?? "";
      return actual;
    },
    { status: 200, check: () => (cycleId ? null : "new definition not in the returned list") },
  ],
  [
    "history endpoint lists the cycle entry of next month",
    async () => {
      const actual = await request(`/api/history?month=${nextMonth}`);
      cycleEntryId = historyEntries(actual)?.find((e) => e.amountMinor === 3333 && e.recurring)?.id ?? "";
      return actual;
    },
    { status: 200, check: () => (cycleEntryId ? null : "cycle entry not in next month's history") },
  ],
  [
    "history endpoint rejects a category change of a cycle entry",
    () =>
      request(`/api/expenses/${cycleEntryId}`, {
        method: "PATCH",
        json: { amount: "33,33", categoryId: otherCategoryId },
      }),
    {
      status: 400,
      check: () => (otherCategoryId ? null : "no second category id found in data-category-ids"),
    },
  ],
  [
    "history endpoint changes the amount of a cycle entry",
    () => request(`/api/expenses/${cycleEntryId}`, { method: "PATCH", json: { amount: "44,44" } }),
    { status: 200 },
  ],
  [
    "recurring endpoint stops the definition of the history steps",
    () => request(`/api/recurring-expenses/${cycleId}`, { method: "DELETE" }),
    { status: 200, check: (actual) => (recurringItems(actual)?.length === 0 ? null : "definition is still listed") },
  ],
  [
    "dashboard links to the history of the current month",
    () => request("/dashboard"),
    {
      status: 200,
      check: (actual) =>
        actual.body.includes(`/history?month=${currentMonth}`) ? null : "no link to the current month's history",
    },
  ],
  ["signout clears session", () => request("/api/auth/signout", { method: "POST" }), { status: 302, location: "/" }],
  ["history page redirects after signout", () => request("/history"), { status: 302, location: "/auth/signin" }],
  ["history endpoint rejects an anonymous request", () => request("/api/history"), { status: 401 }],
  ["dashboard redirects after signout", () => request("/dashboard"), { status: 302, location: "/auth/signin" }],
  [
    "category settings page redirects after signout",
    () => request("/settings/categories"),
    { status: 302, location: "/auth/signin" },
  ],
  [
    "recurring settings page redirects after signout",
    () => request("/settings/recurring"),
    { status: 302, location: "/auth/signin" },
  ],
  [
    "recurring income settings page redirects after signout",
    () => request("/settings/recurring?typ=przychody"),
    { status: 302, location: "/auth/signin" },
  ],
  [
    "signin rejects the old password after the change",
    () => request("/api/auth/signin", { method: "POST", form: { email, password } }),
    { status: 302, locationPrefix: "/auth/signin?error=" },
  ],
  [
    "signin accepts the new password",
    () => request("/api/auth/signin", { method: "POST", form: { email, password: newPassword } }),
    { status: 302, location: "/dashboard" },
  ],
  [
    "signout after the new-password signin",
    () => request("/api/auth/signout", { method: "POST" }),
    { status: 302, location: "/" },
  ],
  [
    "recurring endpoint rejects an anonymous request",
    () => request("/api/recurring-expenses/00000000-0000-4000-8000-000000000000", { method: "DELETE" }),
    { status: 401 },
  ],
  [
    "recurring income endpoint rejects an anonymous request",
    () => request("/api/recurring-incomes/00000000-0000-4000-8000-000000000000", { method: "DELETE" }),
    { status: 401 },
  ],
  // Kept before the anonymous expense request: that 401 leaves its JSON body unread, and the dev/preview server then
  // fails the next request on the same connection ("fetch failed"), so it has to stay the last step.
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
