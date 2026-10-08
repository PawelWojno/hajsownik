# Household + RLS Data-Access Foundation Implementation Plan

## Overview

Establishes the first domain data model in Hajsownik: `households` + `household_members` tables with Row-Level Security, a reusable `current_household_id()` Postgres function every future domain table will reuse, and an atomic signup trigger that creates a household (with a user-supplied name) the moment a new account is created. This is roadmap item F-01 — it unlocks S-01 and, transitively, every later slice.

## Current State Analysis

- `supabase/migrations/` does not exist — this is the first migration in the project.
- `src/pages/api/auth/signup.ts` only calls `supabase.auth.signUp({ email, password })` and redirects; there is no household concept anywhere in the codebase.
- `src/components/auth/SignUpForm.tsx` has exactly three fields (email, password, confirmPassword) with client-side `validate()` and native form POST — no household-name field.
- Only the Supabase anon key is configured (`SUPABASE_KEY` in `src/lib/supabase.ts:3`) — no service-role key exists anywhere in the project, which rules out any approach requiring elevated application-level DB privileges.

### Key Discoveries:

- `src/pages/api/auth/signup.ts:4-20` — signup is a single `POST` handler reading `FormData`; the household-name field will be read the same way (`form.get("householdName")`).
- `src/components/auth/SignUpForm.tsx:22-45` — `validate()` is the existing client-side validation pattern to extend, not replace.
- PRD `## Access Control` — a household supports multiple accounts ("a second account... can later join the *same* household"), so the schema must be a join table (`household_members`) from day one, not a 1:1 column on the user.
- PRD `## Non-Functional Requirements` — "financial data belonging to one household is never visible to... anyone who is not an account holder of that household" is the correctness bar RLS must satisfy.

## Desired End State

A new user who signs up gets a household created atomically with their account, with a name they chose (or the pre-filled default, if they didn't change it). Every future domain table can enforce household isolation by referencing `current_household_id()` in its RLS policy. Cross-household data leakage is verified impossible at the database level, not just the application level.

**Verification**: sign up as two different users locally, confirm (via Supabase Studio) each has their own `households` row with the correct name, and that the Phase 3 pgTAP test asserts neither can see the other's `household_members` row.

## What We're NOT Doing

- **Inviting / joining an existing household.** PRD Non-Goals explicitly defers this ("v1 ships with exactly one account per household"), and PRD Access Control explicitly defers the join mechanism's design to a future planning step. The trigger built here unconditionally creates a new household for every new signup — it does not anticipate the join flow.
- **Editing a household's name after creation.** No FR describes this; the name field is set once, at signup, via the form.
- **Any domain tables** — `categories`, `expenses`, `income`, `recurring_definitions`. Those belong to S-01, S-04, S-05 respectively and will each add their own RLS policy using `current_household_id()`.
- **A `role` column on `household_members`.** PRD Access Control states "there is no owner/admin role, all accounts within a household are equal" — no role concept exists in v1.
- **A service-role key.** The trigger approach (SECURITY DEFINER) avoids needing one; none is introduced.

## Implementation Approach

A SECURITY DEFINER trigger on `auth.users` creates one `households` row (named from `raw_user_meta_data.household_name`, set via `signUp`'s `options.data`) and one `household_members` row per new signup, atomically — no partial-failure window is possible since both inserts happen inside the same trigger invocation as the `auth.users` insert. A shared `current_household_id()` function centralizes "what household does the current request belong to," so every future table's RLS policy is a one-line reference to it rather than a repeated subquery. `household_members.user_id` is the table's `PRIMARY KEY`, encoding the v1 invariant that each account belongs to exactly one household.

**Contract surface for every future table (S-01+).** Any domain table (`categories`, `expenses`, `income`, `recurring_definitions`, …) that needs household isolation adds a `household_id uuid not null references households(id)` column and one RLS policy:

```sql
create policy "household_isolation" on <table_name>
  for select using (household_id = (select public.current_household_id()));
```

The wrapping `(select ...)` around the function call is deliberate, not stylistic — per Supabase's RLS performance guidance, it makes Postgres evaluate `current_household_id()` once per query instead of once per row; writing `household_id = public.current_household_id()` without the `select` works correctly but re-evaluates the function per row and measurably slows down scans on larger tables. `current_household_id()` and the `household_name` metadata key are the two contract surfaces this plan establishes for every later roadmap slice to depend on.

## Critical Implementation Details

- **Pinned, empty search_path on both `SECURITY DEFINER` functions.** Both the trigger function and `current_household_id()` must `security definer` and explicitly `set search_path = ''`, using fully qualified names (`public.households`, `public.household_members`, `auth.uid()`) everywhere inside. An unpinned (or merely `public`) search path on a `SECURITY DEFINER` function is a known Postgres/Supabase privilege-escalation vector (Supabase advisor: `function_search_path_mutable`) — a caller could create objects earlier in the search path to hijack name resolution. This is the one genuinely non-obvious Supabase gotcha in this plan.
- **RLS is enabled, not forced — on purpose.** Use `ALTER TABLE ... ENABLE ROW LEVEL SECURITY` on both tables, with no INSERT/UPDATE/DELETE policies (default-deny). The migration and both `SECURITY DEFINER` functions run as `postgres`, the table owner — **owners bypass RLS by default, but `FORCE ROW LEVEL SECURITY` puts the owner back under the policies** (unless the owner also has the `BYPASSRLS` role attribute). Do not `FORCE`: these functions must keep bypassing RLS — the trigger needs to INSERT with no INSERT policy present, and `current_household_id()` needs to SELECT from `household_members` without recursing into its own SELECT policy. `FORCE`ing the table would subject both functions to those same policies and break every signup. The app roles (`anon`/`authenticated`) are never owners, so they're governed by RLS either way — `FORCE` would add no protection for them, only break the owner's writes.

## Phase 1: Schema, RLS, and signup trigger

### Overview

One migration: `households` + `household_members` tables, `current_household_id()` function, RLS policies on both tables, and the `SECURITY DEFINER` trigger on `auth.users`.

### Changes Required:

#### 1. Seed file (prerequisite, unrelated to this plan's schema)

**File**: `supabase/seed.sql` (new, empty)

**Intent**: `supabase/config.toml` has `[db.seed] enabled = true` with `sql_paths = ["./seed.sql"]`, but that file doesn't exist yet — `npx supabase db reset` (this phase's own success criterion 1.1) fails trying to load it, independent of anything this migration adds. Create an empty file so `db reset` has something to open.

#### 2. New migration

**File**: `supabase/migrations/<YYYYMMDDHHmmss>_household_foundation.sql` (timestamp = creation time, per the convention in `CLAUDE.md`)

**Intent**: Create the household data model, the reusable isolation function, and the atomic creation trigger — the single enabling contract every later domain table depends on.

**Contract**:
- `households(id uuid pk default gen_random_uuid(), name text not null check (char_length(name) between 1 and 100), created_at timestamptz not null default now())` — the `CHECK` is the database-level backstop behind the Phase 2 zod validation; it's what actually prevents an oversized or empty name, since `raw_user_meta_data` (and therefore the trigger's fallback below) never passes through the API's zod schema.
- `household_members(user_id uuid primary key references auth.users(id) on delete cascade, household_id uuid not null references households(id) on delete cascade, created_at timestamptz not null default now())` + `create index on household_members(household_id)`. `user_id` as the primary key (not a separate `unique` constraint) encodes "one account, one household" for v1; `on delete cascade` on both FKs means deleting a user or household (e.g. removing a test/demo account in Studio) cleans up membership rows instead of failing with an FK error.
- `current_household_id() returns uuid` — `security definer stable`, `set search_path = ''`, selects `household_id` from `public.household_members` where `user_id = auth.uid()` (fully qualified names since the search path is empty).
- RLS: `ENABLE ROW LEVEL SECURITY` (not `FORCE` — see Critical Implementation Details) on both tables. `households` SELECT policy: `id = current_household_id()`. `household_members` SELECT policy: `household_id = current_household_id()`. No INSERT/UPDATE/DELETE policies for either table (default-deny; only the trigger, running as `SECURITY DEFINER` owned by `postgres`, writes to them).
- Trigger function `handle_new_user_household()` — `security definer`, `set search_path = ''`, reads `new.raw_user_meta_data->>'household_name'`, trims it, and falls back to `'Mój dom'` if the result is null/blank/over 100 characters (truncating to 100 chars rather than falling back would silently rewrite a legitimately long name — since Phase 2's zod schema already caps input at 100 chars for the normal signup path, this branch should only ever trigger for a non-UI-originated insert, e.g. a Dashboard-created user with no metadata at all). Inserts one `public.households` row, then one `public.household_members` row linking it to `new.id` (fully qualified names since the search path is empty).
- Trigger `on_auth_user_created after insert on auth.users for each row execute function handle_new_user_household()`.

### Success Criteria:

#### Automated Verification:
- Migration applies cleanly: `npx supabase db reset`
- `npx supabase db lint` reports no new warnings

#### Manual Verification:
- Sign up a test user locally (e.g. via `curl` against `/api/auth/signup` or the smoke script's pattern) and confirm in Supabase Studio that exactly one `households` row and one `household_members` row were created, with the name taken from the metadata.
- As a second, different authenticated user, confirm a direct `select * from household_members` (via the anon-key client, RLS-governed) returns zero rows belonging to the first user's household.
- **Push this migration to the production Supabase project** (`npx supabase link` + `npx supabase db push`) before Gate F of `context/deployment/deploy-plan.md` creates the demo/grading account — see Migration Notes for why the ordering matters.

---

## Phase 2: Wire the household name into sign-up

### Overview

Add a required, pre-filled, editable household-name field to the sign-up form and pass it through to `supabase.auth.signUp`.

### Changes Required:

#### 1. Sign-up form

**File**: `src/components/auth/SignUpForm.tsx`

**Intent**: Add a `householdName` field, pre-filled with a static default suggestion, required (non-empty after trim), following the exact `FormField` + `validate()` pattern the other three fields already use.

**Contract**: New `useState("Mój dom")` for `householdName`; new `FormField id="householdName" name="householdName"`; `validate()` gains a check that `householdName.trim()` is non-empty, mirroring the existing `email`/`password` checks at `SignUpForm.tsx:25-29`.

#### 2. Add zod dependency

`npm install zod` — not yet a dependency in this project, but `CLAUDE.md` requires zod for API input validation; this is the first API route to need it.

#### 3. Sign-up API route

**File**: `src/pages/api/auth/signup.ts`

**Intent**: Read the new form field, validate it server-side with zod (client-side validation in Phase 2.1 is bypassable via a direct API call), and pass it to Supabase Auth as user metadata so the Phase 1 trigger can read it.

**Contract**: `const householdNameSchema = z.string().trim().min(1).max(100);` then `const parsed = householdNameSchema.safeParse(form.get("householdName"));` — on failure, `return context.redirect(\`/auth/signup?error=${encodeURIComponent("...")}\`)`, the same error-reporting shape `signup.ts` already uses for a Supabase `signUp` error (`signup.ts:16`) and that `signup.astro`'s `ServerError` already renders. No new error-reporting mechanism (e.g. JSON body) is introduced, since none exists in this codebase today. On success, `supabase.auth.signUp({ email, password, options: { data: { household_name: parsed.data } } })` — the `options.data` key name (`household_name`) must match exactly what the Phase 1 trigger reads from `raw_user_meta_data`. The `100`-character ceiling matches the `households.name` `CHECK` constraint added in Phase 1, so a request that passes this validation can never be rejected by the database.

#### 4. Smoke test

**File**: `scripts/smoke.mjs`

**Intent**: The existing "signup creates account" step posts `{ email, password }` only; once `householdName` is required, that request now fails zod validation and the step goes red (including the CI `smoke` job). The smoke script must send the new field to keep testing the real signup path instead of a request shape that no longer exists.

**Contract**: `smoke.mjs:43`'s form literal gains `householdName: "Mój dom"` alongside `email, password`. No other step changes.

### Success Criteria:

#### Automated Verification:
- `npm run lint` passes
- `npx astro check` passes
- `npm run build` succeeds

#### Manual Verification:
- Visit `/auth/signup`, confirm the household-name field is pre-filled with the default suggestion and is editable.
- Submit with the field cleared — confirm client-side validation blocks submission (matching the existing pattern for empty email/password).
- Sign up with a custom name — confirm (Supabase Studio) the created `households.name` matches what was typed, not the default.
- Send a direct POST to `/api/auth/signup` (e.g. via `curl`) with an empty or 101+ character `householdName`, bypassing the UI entirely — confirm it redirects to `/auth/signup?error=...` by the zod schema, not silently passed through to Supabase, and that no `auth.users` row was created for that request.

---

## Phase 3: RLS isolation test

### Overview

A pgTAP test proving two households' data is mutually invisible — the formal verification of this foundation's entire reason for existing.

### Changes Required:

#### 1. pgTAP test

**File**: `supabase/tests/database/household_isolation.test.sql`

**Intent**: Create two households by inserting two real rows into `auth.users` (not direct `household_members` inserts — those would skip the trigger entirely), then assert, *as each user* (not as `postgres`), that the other household's data is invisible and unwritable.

**Contract**: Uses `supabase test db`'s pgTAP conventions (`plan()`, `results_eq`, `is_empty`, `is`, `throws_ok`).

- Fixture: `insert into auth.users (...)` for two distinct users — this is what exercises the trigger and creates real `households`/`household_members` rows, the same path a real signup takes. **Do not guess the column list.** `auth.users`' exact `NOT NULL` columns depend on the local GoTrue schema version and aren't recorded in this repo; before writing the fixture, run `\d auth.users` against the local Supabase DB (`npx supabase start` first) and include every `NOT NULL` column it reports, not just the ones below. What the trigger itself actually reads/needs: a real `id` (used as the `household_members.user_id` FK target and as `auth.uid()` in `current_household_id()`), `email`, and `raw_user_meta_data` containing `{"household_name": "<value>"}` for user A and a different value (or omitted, to exercise the fallback) for user B.
- Critical, non-obvious step: while the session is still the table owner, read both households' ids into variables. Only then, before each assertion block, `set local role authenticated;` and `set local request.jwt.claims = '{"sub": "<user-id>"}';`. The role switch is what makes RLS apply (the owner bypasses it). The ids have to be captured first, because after the switch a `SELECT` cannot see the other household, so the test would have nothing to aim `UPDATE`/`DELETE` at.
- Assertions, run once per user (A and B):
  - `results_eq` — `select count(*) from households` as that user returns `1` (only their own).
  - `results_eq` — `select count(*) from household_members` as that user returns `1` (only their own membership).
  - `is_empty` — a query for the *other* user's `household_id` returns zero rows.
  - `throws_ok` — `insert into households (...) values (...)` as `authenticated` raises `new row violates row-level security policy`. `INSERT` has no existing row for `USING` to filter, so Postgres checks `WITH CHECK` and raises. This is the only write that throws.
  - `is` on a row count, not `throws_ok`, for `UPDATE` and `DELETE`. With no policy, `USING` matches zero rows and the command succeeds with 0 rows affected. `throws_ok` would fail here because there is no exception to catch. The data-modifying `WITH` has to be the top-level statement: Postgres rejects a `WITH` that contains `UPDATE`/`DELETE` when it is nested inside the argument of `is(...)`. `RETURNING 1` counted as 0 means the other household's name cannot have changed, so a second read of `name` is unnecessary.

```sql
with upd as (
  update households set name = 'hacked'
  where id = other_household_id
  returning 1
)
select is(
  (select count(*) from upd),
  0::bigint,
  'UPDATE on other household matches zero rows under RLS'
);
```

The `DELETE` assertion is the same shape: top-level `with del as (delete from household_members where household_id = other_household_id returning 1)`, then `is((select count(*) from del), 0::bigint, ...)`.

### Success Criteria:

#### Automated Verification:
- `npx supabase test db` passes (new test green)
- `npm run smoke` passes with the Phase 2.8 `householdName` addition (the auth flow itself is untouched; only the signup request body changed)

---

## Testing Strategy

### Unit Tests:
- None beyond the pgTAP test in Phase 3 — there is no application-level unit test framework in this project yet (confirmed: no test runner beyond `scripts/smoke.mjs`).

### Integration Tests:
- `scripts/smoke.mjs`'s existing signup→signin→dashboard→signout flow continues to pass, with its signup step updated (Phase 2.8) to send `householdName` — proves this change didn't break the auth flow it builds on, while still exercising the real (now-required) signup contract.

### Manual Testing Steps:
1. Sign up as a brand-new user through the real UI; confirm a household is created with the chosen name.
2. Sign up as a second user; confirm they get a *separate* household, not the first user's.
3. Attempt (via direct Supabase client calls, not just the UI) to read the first household's data as the second user's session — confirm RLS blocks it.

## Migration Notes

No existing data to backfill — production Supabase currently has zero users, and this is the first migration in the project. The ordering that matters instead: this migration must be pushed to the production Supabase project (`npx supabase link` + `npx supabase db push`) **before** any production user is created — including the Gate F demo/grading account in `context/deployment/deploy-plan.md`. The signup trigger fires on every insert into `auth.users` regardless of how the row is created (API signup, Supabase Dashboard "Add user", Admin API), so once the migration is live, the demo account gets a household automatically (with the fallback default name, since Dashboard-created users won't carry `household_name` metadata) — no manual repair needed, as long as the push happens first.

## References

- `context/foundation/roadmap.md` § F-01 — source roadmap item, Outcome/PRD refs/Risk
- `context/foundation/prd.md` § Access Control, § Non-Functional Requirements — the isolation requirement this plan satisfies
- `CLAUDE.md` — Supabase migration naming convention (`YYYYMMDDHHmmss_short_description.sql`), RLS-per-table convention

## Progress

> Convention: `- [ ]` pending, `- [x]` done. Append ` — <commit sha>` when a step lands.

### Phase 1: Schema, RLS, and signup trigger

#### Automated
- [x] 1.1 Migration applies cleanly: `npx supabase db reset` — 6421b8c
- [x] 1.2 `npx supabase db lint` reports no new warnings — 6421b8c

#### Manual
- [x] 1.3 New signup creates exactly one households + household_members row with correct name — 6421b8c
- [x] 1.4 Second user's RLS-governed query returns zero rows from first user's household — 6421b8c
- [x] 1.5 Migration pushed to production Supabase (`supabase db push`) before Gate F demo account creation — 6421b8c

### Phase 2: Wire the household name into sign-up

#### Automated
- [x] 2.1 `npm run lint` passes — 72cbb81
- [x] 2.2 `npx astro check` passes — 72cbb81
- [x] 2.3 `npm run build` succeeds — 72cbb81

#### Manual
- [x] 2.4 Household-name field pre-filled, editable, visible at /auth/signup — 72cbb81
- [x] 2.5 Empty household-name blocks submission client-side — 72cbb81
- [x] 2.6 Custom household name persists correctly to households.name — 72cbb81
- [x] 2.7 A direct POST to /api/auth/signup with an empty or >100-char householdName (bypassing the UI) redirects to /auth/signup?error=..., not passed through to Supabase — 72cbb81
- [x] 2.8 scripts/smoke.mjs sends householdName and its "signup creates account" step still passes — 72cbb81

### Phase 3: RLS isolation test

#### Automated
- [x] 3.1 `npx supabase test db` passes — 74492bd
- [x] 3.2 `npm run smoke` still passes — 74492bd
- [x] 3.3 Both users' SELECT assertions (households + household_members, own-only) pass as `authenticated`, not `postgres` — 74492bd
- [x] 3.4 `throws_ok` confirms `authenticated` cannot INSERT into `households` — 74492bd
- [x] 3.5 `UPDATE`/`DELETE` against the other household affect 0 rows (`is` on `RETURNING` count, not `throws_ok`) — 74492bd
