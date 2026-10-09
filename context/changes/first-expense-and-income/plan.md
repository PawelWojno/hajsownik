# First expense + income, month "zostaje" — Implementation Plan

## Overview

A logged-in user adds an expense (amount -> category -> save) or an income entry from a slide-in panel on the month
screen (`/dashboard`) and sees income / expenses / "zostaje" for the current month update without a page reload.
Data is household-scoped via RLS (pattern from F-01). Covers US-01, FR-004, FR-006, FR-012, FR-013.

## Current State Analysis

- DB: only `households`, `household_members`, `current_household_id()`, trigger `handle_new_user_household()`
  (`supabase/migrations/2026100817*..2026100820*`). No domain tables.
- RLS lesson (`context/foundation/lessons.md`): policies use `household_id = (select public.current_household_id())`.
- F-01 revoked EXECUTE (`20261008200524_revoke_function_execute.sql`) on `handle_new_user_household()` from
  public/anon/authenticated (only the trigger calls it), but on `current_household_id()` only from public/anon —
  `authenticated` keeps it because RLS policies call it, and so do the planned `DEFAULT current_household_id()` columns.
  Rule for new functions: ones the user never calls (`seed_default_categories`) lose EXECUTE for all three roles.
- App: auth API routes use form POST + redirect + zod (`src/pages/api/auth/signup.ts`); `src/lib/supabase.ts`
  `createClient(headers, cookies)`; middleware protects `/dashboard` only (`src/middleware.ts`); `/dashboard` is a
  placeholder; `signin.ts` redirects to `/`. No `src/hooks`, no `src/types.ts`, no test runner besides pgTAP
  (`supabase/tests/database/household_isolation.test.sql`) and `scripts/smoke.mjs`.
- Production already has households (F-01 deployed) — they need default categories via backfill.

## Desired End State

New and existing households have 12 default categories. `/dashboard` shows "<Month> <year>" with Przychody,
Wydatki, Zostaje (labelled "różnica tego miesiąca, nie oszczędności"), a primary "Dodaj wydatek" button and a
secondary "Dodaj przychód". Saving an entry keeps the panel open, resets the form and updates the sums from the API
response in under 1 s. Another household's data is unreachable (proved by pgTAP).

### Key Discoveries

- FK `expenses.category_id -> categories.id` is not checked by RLS: a plain FK would let household A attach an
  expense to household B's category. Use composite FK `(household_id, category_id) -> categories(household_id, id)`.
- PostgREST aggregates are off by default on Supabase, so sums are done in a SQL function, not `select sum()`.
- Workers run in UTC, user is in Poland: "today" must be computed in `Europe/Warsaw` (00:30 on 1 Nov Warsaw is still
  31 Oct UTC).

## What We're NOT Doing

- Month navigation / past months (current month only), list of entries, edit/delete (S-06).
- Translating the auth flow (sign-in, sign-up, confirm-email pages, their forms and API error messages) — it stays English
  and goes to a separate change, parked in the roadmap.
- Category add/remove/rename/reorder/archive (S-02); recurring entries (S-04/S-05); password reset (S-03).
- Budget bar / limits (PRD Non-Goal) — parked as post-MVP idea. Timezone setting in settings — parked post-MVP.
- "Osoba" and "Podkategoria" fields (PRD Non-Goals). Future-dated expenses (FR-005). Income description field.
- UPDATE/DELETE policies on new tables (default-deny until S-06). No unit-test framework added.

## Implementation Approach

Bottom-up: database (with its pgTAP proof) -> JSON API -> UI -> smoke. Money is stored as integer minor units
(`amount_minor bigint`, grosze) to avoid float errors. The wire format for `amount` is the raw string the user typed ("12,50"/"12.50"); only the API
converts it to minor units (one conversion, at the trust boundary). The UI merely filters keystrokes and pre-validates
with the same `parseAmountToMinor` helper. Month sums come from
`month_summary(p_month date)` (SECURITY INVOKER, so RLS applies); POST endpoints return the fresh summary.

## Phase 1: Schema, RLS, default categories

### Overview

One migration `supabase/migrations/<YYYYMMDDHHmmss>_first_expense_and_income.sql` plus pgTAP tests.

### Changes Required

#### 1. Tables and RLS

**File**: `supabase/migrations/<YYYYMMDDHHmmss>_first_expense_and_income.sql` (use `YYYYMMDDHHmmss`, later than 20261008200802)

**Intent**: Create household-scoped `categories`, `expenses`, `incomes`, all with RLS enabled and granular policies.

**Contract**:
- `categories(id uuid pk, household_id uuid not null -> households on delete cascade, name text 1..50, sort_order int not null, created_at)`;
  `unique (household_id, id)` (FK target), `unique (household_id, name)`.
- `expenses(id, household_id not null default public.current_household_id(), category_id not null, amount_minor bigint check (> 0 and <= 9999999999), spent_on date not null, description text null check (char_length <= 200), created_at)`;
  `foreign key (household_id, category_id) references categories (household_id, id)`; index `(household_id, spent_on)`.
- `incomes(id, household_id default current_household_id(), source text check in ('wynagrodzenie','działalność','świadczenia','wynajem','inne'), amount_minor (same check), received_on date not null, created_at)`; index `(household_id, received_on)`. `text + check` (not enum) so S-xx can alter the list cheaply.
- Policies, one per operation/role, all `to authenticated`, all `(select public.current_household_id())`:
  `categories` select only; `expenses` + `incomes` select and insert (`with check`). No update/delete.

#### 2. Default categories

**Intent**: Every household gets the 12 defaults in order (FR-006, FR-011 default creation order): Jedzenie, Dom i rachunki,
Transport, Zdrowie, Higiena i uroda, Ubrania, Rozrywka, Dzieci, Edukacja, Prezenty, Podróże, Inne.

**Contract**: helper `public.seed_default_categories(p_household_id uuid)` (SECURITY DEFINER, `set search_path = ''`,
EXECUTE revoked from public/anon/authenticated); `create or replace` `handle_new_user_household()` to call it after
inserting the household (keep the `E' \t\n\r'` btrim from migration 4); backfill `select seed_default_categories(id)
from households h where not exists (select 1 from categories c where c.household_id = h.id)`.

#### 3. Month summary

**Contract**: `public.month_summary(p_month date) returns table (income_total bigint, expense_total bigint)`,
`language sql stable security invoker set search_path = ''`; sums rows with date in `[p_month, p_month + interval '1 month')`,
`coalesce(...,0)`; EXECUTE revoked from public/anon, granted to authenticated. "zostaje" = income_total - expense_total,
computed by the caller.

#### 4. pgTAP test

**File**: `supabase/tests/database/expenses_income.test.sql` (pattern from `household_isolation.test.sql`: two users, `set local role authenticated`, jwt claims).

**Intent**: Prove the isolation and the business rule.

**Contract**: new signup has 12 categories in order; A sees only A's rows in all three tables; A cannot insert an expense
with B's `household_id` (42501), with B's `category_id` (23503), or with amount <= 0 (23514); A update/delete matches 0
rows; anon sees nothing; `month_summary` returns correct sums, excludes other months and other households, and returns 0/0 for an empty month.

### Success Criteria

#### Automated Verification:

- Migration applies on a clean DB: `npx supabase db reset`
- pgTAP suites pass: `npx supabase test db`

#### Manual Verification:

- After `db reset` + signup in Studio, the new household has 12 categories in the expected order
- Backfill checked: an existing household created before the migration gets the 12 categories

---

## Phase 2: Money/date helpers and API endpoints

### Overview

Server side: validation, helpers, JSON endpoints returning updated sums.

### Changes Required

#### 1. Helpers and types

**Files**: `src/lib/money.ts`, `src/lib/dates.ts`, `src/types.ts`

**Intent**: One place for "12,50" <-> minor units conversion, formatting PLN (`Intl.NumberFormat('pl-PL')`), and the
Warsaw-based "today"/current-month helpers; shared DTOs.

**Contract**: `parseAmountToMinor(input: string): number | null` (accepts `,` or `.`, max 2 decimals, > 0);
`formatMinor(n: number): string`; `todayInWarsaw(): string` (`YYYY-MM-DD`, via `Intl` with `timeZone: 'Europe/Warsaw'`);
`currentMonthStart(): string`. Types: `Category`, `MonthSummary { incomeTotal; expenseTotal; left }`, `SavedEntryResponse`.

#### 2. Expense endpoint

**File**: `src/pages/api/expenses.ts` (`export const prerender = false`, `POST`)

**Intent**: Validate with zod (`amount` as a raw string, converted by `parseAmountToMinor`; `categoryId` uuid, optional `date` <= `todayInWarsaw()` default today, optional
`description` trim <= 200), insert via the user-session Supabase client, return JSON `{ summary, inCurrentMonth }`.

**Contract**: 401 if no `context.locals.user`; 400 with first zod message on invalid input; 500-safe message on DB error;
200 `{ summary: MonthSummary (current month), inCurrentMonth: boolean }`, where `inCurrentMonth` is true iff the entry's date
falls in `[currentMonthStart(), start of next month)` computed in Europe/Warsaw; the client formats the month name for the
"Zapisano w <miesiąc>" message from the date it sent. JSON body (not form) — cross-site posts
need a CORS preflight, so no extra CSRF token is required.

#### 3. Income endpoint

**File**: `src/pages/api/incomes.ts`

**Intent**: Same shape as the expense endpoint: amount, `source` (zod enum of the 5 FR-012 values, spelled with Polish characters exactly as in the CHECK), optional date (same rules).

#### 4. Sign-in landing

**File**: `src/pages/api/auth/signin.ts`

**Intent**: Redirect to `/dashboard` instead of `/` so a returning user lands on the month screen.
Added during implementation (user request): `src/middleware.ts` also redirects a signed-in user who opens `/`, `/auth/signin`
or `/auth/signup` (exact paths) to `/dashboard`, so the month screen is the home of a signed-in user.

### Success Criteria

#### Automated Verification:

- Lint passes: `npm run lint`
- Type check passes: `npx astro check`
- Build passes: `npm run build`

#### Manual Verification:

- With a session cookie, `curl -X POST /api/expenses` with valid JSON returns 200 and updated sums; future date, amount 0, foreign `categoryId` and no cookie return 400/400/400-or-500-safe/401
- An entry dated 00:30 Warsaw on the 1st lands in the new month (check with a date near a month boundary)

---

## Phase 3: Month screen with slide-in panel

### Overview

`/dashboard` becomes the month screen; React island with the entry panel.

### Changes Required

#### 1. Month screen (server-rendered)

**File**: `src/pages/dashboard.astro`

**Intent**: Load categories and `month_summary(currentMonthStart())` with the user-session client; render title
"<Miesiąc> <rok>", Przychody / Wydatki / Zostaje (with the "różnica tego miesiąca, nie oszczędności" caption), and mount the island with initial data.

**Contract**: remove the placeholder content; keep sign-out; no budget bar.
The placeholder's `Welcome, <email>` text disappears, so the production sign-in check in `context/deployment/deploy-plan.md`
(Gate D, "`/dashboard` shows `Welcome, <email>`") is obsolete after this change: a signed-in user now sees Przychody, Wydatki
and Zostaje. `deploy-plan.md` is an approved audit trail and is intentionally left untouched.

#### 2. Panel island

**Files**: `src/components/month/MonthScreen.tsx` (summary + buttons), `src/components/month/EntrySheet.tsx`,
`src/components/month/CategoryGrid.tsx`; shadcn `drawer` via `npx shadcn@latest add drawer` (adds `vaul`);
hook `src/hooks/useEntrySubmit.ts` if the submit logic needs extracting.

**Intent**: Primary "Dodaj wydatek" (large) and secondary "Dodaj przychód" open one panel in two modes. Panel: bottom sheet
on phones, right-side panel from `md` up, ~60% height so the sums stay visible and dimmed; amount field first (numeric
keyboard, `inputMode="decimal"`, autofocus; plain text input whose `onChange` keeps only digits and one separator
(`,` or `.`) with at most 2 decimals — keystrokes and pastes outside that are ignored; not `type="number"`; the server
still validates), 12-button category grid (required, one tap; each button carries `data-category-id` for the smoke test), "Więcej opcji" (date, description).
Income mode: amount + source select + optional date. Closes with X, swipe down, Esc, or tap on the backdrop (always — agreed).

**Contract**: submit -> `fetch('/api/expenses'|'/api/incomes')`; on success update displayed sums from `summary`, show
"Zapisano 25,00 zł · Jedzenie", reset amount/category/"Więcej opcji", keep panel open and re-focus amount (quick-entry);
if `inCurrentMonth` is false show "Zapisano w <miesiąc> — nie wpływa na ten miesiąc"; disable Save while pending
(no double submit); on failure keep entered values and show the error (reuse the style of `ServerError`). Use `cn()`
for classes; no Next.js directives; minimum touch target 44px; no horizontal scroll at 360px width.

Adaptations made during implementation (all minor): (1) on a phone the panel covers the "Zostaje" row, so the panel
header repeats "Zostaje w tym miesiącu: <kwota>" and updates after each save; (2) the past-month message reads "Zapisano
(wrzesień 2026) — nie wpływa na ten miesiąc" because the plan's "Zapisano w <miesiąc>" would need Polish declension;
(3) category buttons are rendered only while the panel is open, so the page root also carries `data-category-ids`
(comma-separated ids) for the smoke test.

#### 3. Polish UI outside the auth flow

**Files**: `src/layouts/Layout.astro`, `src/components/Topbar.astro`, `src/components/Welcome.astro`

**Intent**: Everything a user sees outside the auth flow is Polish, so the new month screen is not surrounded by English chrome.
`Layout.astro` declares `<html lang="pl">`; the top bar (e.g. "Wyloguj", "Zaloguj", "Zarejestruj") and the landing page text
are translated. The new endpoints return Polish error messages (zod messages included). Auth pages, forms and
`/api/auth/*` messages are NOT touched here.

**Contract**: Pure text changes; no new i18n library (single-language app, plain Polish strings in place). Link targets stay as they are.

### Success Criteria

#### Automated Verification:

- Lint passes: `npm run lint`
- Type check passes: `npx astro check`
- Build passes: `npm run build`

#### Manual Verification:

- Expense amount -> category -> Save works at 360px width without zoom or horizontal scroll; sums update without reload within 1 s
- Panel stays open after save, amount field empty and focused; second expense accumulates correctly
- Income "wynagrodzenie" raises Przychody and Zostaje; expense lowers Zostaje
- Entry with a past-month date shows the "nie wpływa na ten miesiąc" message and leaves the sums unchanged
- Backdrop tap, X, Esc and swipe-down all close the panel; sums remain visible above the open panel
- A second account (different household) sees none of the first account's data
- Month screen, top bar and landing page are Polish; the page declares `lang="pl"`; auth pages are intentionally still English

---

## Phase 4: Smoke test, roadmap, housekeeping

### Changes Required

#### 1. Smoke

**File**: `scripts/smoke.mjs`

**Intent**: Make the smoke script able to check the new contract, staying dependency-free and needing only `BASE_URL`.
Extend `request()` to send an optional JSON body and to return the response body text; after sign-in fetch `/dashboard`,
read one category id from the `data-category-ids` attribute on the month screen root (Phase 3; the per-button `data-category-id` exists only while the panel is open), POST an expense
and an income as JSON with the cookie jar, and assert 200 and the returned `left` (income minus expense). Tighten the
sign-in step to expect the exact redirect `/dashboard` (the current `startsWith` matcher would still accept `/`), and
assert that the dashboard body does not contain `[object Object]`.

#### 2. Roadmap

**File**: `context/foundation/roadmap.md`

**Intent**: Verify, without adding duplicates, that `## Parked` already contains the two entries added when this plan was
saved — (a) budget/usage bar on the month screen (PRD Non-Goal, post-MVP), (b) timezone setting in settings (S-01 hardcodes
`Europe/Warsaw`, post-MVP) — and that S-01 shows status `planning`. Close the S-01 Unknown about the default category list
(confirmed by the user during planning: the 12 names from Phase 1). Later status changes belong to
`/10x-implement` and `/10x-archive`.

### Success Criteria

#### Automated Verification:

- Smoke passes against a running preview with local Supabase: `npm run smoke`
- CI-equivalent: `npm run lint && npx astro check && npm run build`

#### Manual Verification:

- Roadmap Parked section contains both new entries exactly once, and the S-01 Unknown about the category list is closed

---

## Testing Strategy

### Unit Tests

- No JS test runner exists; business rule and isolation are covered by pgTAP (Phase 1). Edge cases: empty month 0/0,
  other month excluded, other household excluded, cross-household category FK, amount <= 0.

### Integration Tests

- `scripts/smoke.mjs` extended (sign-in -> expense -> income -> sums).

### Manual Testing Steps

1. Sign up two users with different households; add data as each; confirm isolation.
2. Phone-width viewport: enter 5 expenses in a row via quick-entry.
3. Add an entry dated in a previous month; add one at the month boundary.

## Performance Considerations

Small data volume; `month_summary` hits `(household_id, date)` indexes. Save confirmation target < 1 s (NFR).

## Migration Notes

Backfill of default categories for existing households is part of the migration; the helper is idempotent per household
(`where not exists`). Rollback: drop the three tables, the two functions, restore the previous trigger body.

## References

- PRD: `context/foundation/prd.md` (US-01, FR-004/006/012/013, NFR, Non-Goals); roadmap S-01
- Lessons: `context/foundation/lessons.md` (RLS `(select …)` wrapper)
- Pattern: `supabase/tests/database/household_isolation.test.sql`, `src/pages/api/auth/signup.ts`, `src/components/auth/*`

## Progress

> Convention: `- [ ]` pending, `- [x]` done. Append ` — <commit sha>` when a step lands. Do not rename step titles. See `references/progress-format.md`.

### Phase 1: Schema, RLS, default categories

#### Automated

- [x] 1.1 Migration applies on a clean DB: `npx supabase db reset` — ea8ac6f
- [x] 1.2 pgTAP suites pass: `npx supabase test db` — ea8ac6f

#### Manual

- [x] 1.3 New household has 12 categories in the expected order — ea8ac6f
- [x] 1.4 Backfill gives an existing household the 12 categories — ea8ac6f

### Phase 2: Money/date helpers and API endpoints

#### Automated

- [x] 2.1 Lint passes: `npm run lint` — edd80cf
- [x] 2.2 Type check passes: `npx astro check` — edd80cf
- [x] 2.3 Build passes: `npm run build` — edd80cf

#### Manual

- [x] 2.4 Valid POST returns 200 with updated sums; invalid inputs and no session are rejected — edd80cf
- [x] 2.5 Entry around the Warsaw month boundary lands in the correct month — edd80cf

### Phase 3: Month screen with slide-in panel

#### Automated

- [x] 3.1 Lint passes: `npm run lint` — 8359b7a
- [x] 3.2 Type check passes: `npx astro check` — 8359b7a
- [x] 3.3 Build passes: `npm run build` — 8359b7a

#### Manual

- [ ] 3.4 Amount -> category -> Save works at 360px width; sums update without reload within 1 s
- [ ] 3.5 Panel stays open after save with empty, focused amount field; entries accumulate
- [ ] 3.6 Income raises Przychody and Zostaje; expense lowers Zostaje
- [ ] 3.7 Past-month entry shows the "nie wpływa na ten miesiąc" message
- [ ] 3.8 Backdrop tap, X, Esc and swipe-down close the panel; sums stay visible above it
- [ ] 3.9 A second household sees none of the first one's data
- [ ] 3.10 Month screen, top bar and landing page are Polish with `lang="pl"`; auth pages intentionally still English

### Phase 4: Smoke test, roadmap, housekeeping

#### Automated

- [ ] 4.1 Smoke passes: `npm run smoke`
- [ ] 4.2 CI-equivalent passes: `npm run lint && npx astro check && npm run build`

#### Manual

- [ ] 4.3 Roadmap Parked section contains both new entries exactly once, and the S-01 Unknown about the category list is closed
