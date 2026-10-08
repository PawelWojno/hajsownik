<!-- PLAN-REVIEW-REPORT -->
# Plan Review: Household + RLS Data-Access Foundation

- **Plan**: context/changes/household-foundation/plan.md
- **Mode**: Deep (third pass; F1–F7 from pass 1, F8–F13 from pass 2, F14–F18 from pass 3)
- **Date**: 2026-10-08
- **Verdict**: SOUND (14 FIXED: F1–F13, F17; 4 DISMISSED on review: F14, F15, F16, F18)
- **Findings**: 0 open

## Verdicts

| Dimension | Verdict |
|-----------|---------|
| End-State Alignment | PASS |
| Lean Execution | PASS |
| Architectural Fitness | PASS |
| Blind Spots | PASS |
| Plan Completeness | PASS |

## Grounding
Third pass, full re-verification (not resuming from report state). Read directly (no subagent needed — scope was small and specific): `SignUpForm.tsx`, `FormField.tsx` (confirms `name={name ?? id}` default — no issue there), `ServerError.tsx`, `signup.ts`, `signin.ts`, `signup.astro`, `scripts/smoke.mjs`, `supabase/config.toml`, `package.json`. All match the plan's current description. `supabase/migrations/`, `supabase/tests/`, `supabase/seed.sql` confirmed absent as expected (Phase 1 creates the seed file; Phase 3 creates the test dir). brief↔plan ✓ (re-synced since pass 2's F10 fix). Progress↔Phase ✓ (all Phase headings have matching Progress subsections; all Success Criteria bullets have matching Progress items). 8/8 paths ✓, symbols ✓.

## Findings

### F1 — FORCE RLS works against the SECURITY DEFINER mechanism

- **Severity**: ❌ CRITICAL
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Architectural Fitness
- **Location**: Critical Implementation Details + Phase 1 Contract (RLS)
- **Detail**: The migration runs as `postgres`, which owns the tables and both SECURITY DEFINER functions. Without FORCE the owner skips RLS, and that is what lets the trigger INSERT with no INSERT policy and lets `current_household_id()` read `household_members` without re-entering its own policy. The app roles (anon/authenticated) are never owners, so FORCE gives them nothing. With FORCE: if `postgres` lacks BYPASSRLS, every signup fails ("Database error saving new user") and the `household_members` policy recurses infinitely; if it has BYPASSRLS, FORCE does nothing. The rationale in the plan is wrong either way.
- **Fix**: Remove FORCE from the Contract and Critical Implementation Details; replace the rationale with "RLS enabled, default-deny writes, SECURITY DEFINER functions owned by postgres skip RLS on purpose".
- **Decision**: FIXED

### F2 — Production already has users, and there is no migration rollout

- **Severity**: ⚠️ WARNING
- **Impact**: 🔎 MEDIUM — real tradeoff; pause to reason through it
- **Dimension**: Blind Spots
- **Location**: Migration Notes ("N/A — no existing data")
- **Detail**: `context/deployment/deploy-plan.md` creates a grader demo account in production (Gate F, via the dashboard) plus a test signup. Those users get no household (the trigger only fires on new inserts), so `current_household_id()` returns NULL for them and S-01+ will break. No step applies the migration to production (`supabase db push` appears nowhere in the repo or CI).
- **Fix**: (1) Idempotent backfill at the end of the migration: one household + membership for every `auth.users` row without a membership. (2) Manual step in Phase 1: `npx supabase link` + `npx supabase db push` to production before the Phase 2 deploy.
  - Strength: Demo account works in S-01 without manual repair; backfill is harmless locally.
  - Tradeoff: A few extra lines of SQL and one manual gate.
  - Confidence: HIGH — deploy-plan.md explicitly creates users outside /auth/signup.
  - Blind spot: Not verified whether production Supabase already exists and how many users it has.
- **Decision**: FIXED (simplified — user confirmed production has 0 users today, so backfill SQL was dropped as unneeded defensive code; kept only the ordering fix: push migration to production before Gate F creates the demo account. Trigger fires on every `auth.users` insert regardless of path, so correct ordering alone is sufficient.)

### F3 — The pgTAP test checks too little, and the hard part is left vague

- **Severity**: ⚠️ WARNING
- **Impact**: 🔎 MEDIUM — real tradeoff; pause to reason through it
- **Dimension**: Plan Completeness
- **Location**: Phase 3 Contract
- **Detail**: Only SELECT on `household_members` is asserted; no check of `households` isolation, of write-denial for `authenticated`, or of the trigger creating exactly one household (that is manual-only, step 1.3). "Fixture setup is an implementation detail" hides the non-obvious part: `set local role authenticated` + `request.jwt.claims`. Without that the test runs as postgres and passes trivially. Direct inserts into `household_members` also skip the trigger.
- **Fix**: Fixture = 2× `insert into auth.users` (exercises the trigger); per user: set role authenticated + jwt claims; assert 1 row in `households`, 1 in `household_members`, 0 rows of the other household, insert into `households` → `throws_ok`. Add Progress entries 3.3, 3.4.
  - Strength: The test actually proves the stated end state ("verified impossible at the database level").
  - Tradeoff: Longer test file (~40 lines).
  - Confidence: HIGH — standard Supabase RLS testing pattern.
  - Blind spot: Whether `supabase test db` enables pgtap automatically (usually needs `create extension if not exists pgtap`).
- **Decision**: FIXED

### F4 — current_household_id() is SECURITY DEFINER without a pinned search_path

- **Severity**: ⚠️ WARNING
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Architectural Fitness
- **Location**: Phase 1 Contract — current_household_id()
- **Detail**: Only the trigger pins search_path. The second SECURITY DEFINER function runs with owner privileges; an unpinned search_path is a known privilege-escalation vector (Supabase advisor: `function_search_path_mutable`).
- **Fix**: Both functions: `set search_path = ''` and fully qualified names (`public.household_members`, `auth.uid()`).
- **Decision**: FIXED

### F5 — household_members: no PK, no ON DELETE CASCADE

- **Severity**: ⚠️ WARNING
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Blind Spots
- **Location**: Phase 1 Contract — household_members
- **Detail**: The FK to `auth.users(id)` has no ON DELETE behavior, so deleting a user (demo or test accounts) in Studio or the Dashboard fails with an FK error. The table has no primary key, only `unique(user_id)`.
- **Fix**: `user_id uuid primary key references auth.users(id) on delete cascade`, `household_id uuid not null references households(id) on delete cascade` + index on `household_id`.
- **Decision**: FIXED

### F6 — No server-side validation of householdName

- **Severity**: ⚠️ WARNING
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Blind Spots
- **Location**: Phase 2 — signup.ts, Phase 1 — households.name
- **Detail**: Validation is client-side only (bypassable with curl). CLAUDE.md requires zod for API input. No length limit, so an arbitrarily large name lands in `raw_user_meta_data` and `households.name`.
- **Fix**: signup.ts: zod `z.string().trim().min(1).max(100)`; migration: `check (char_length(name) between 1 and 100)`; the trigger trims and truncates or falls back to the default.
- **Decision**: FIXED (trigger falls back to default rather than truncating, to avoid silently rewriting a legitimately long name on the rare non-UI-originated insert path — zod already caps the normal signup path at 100 chars)

### F7 — Write down the "how future tables use current_household_id()" pattern

- **Severity**: 💡 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Architectural Fitness
- **Location**: Implementation Approach
- **Detail**: The plan promises a "one-line policy" for every future table but never writes down its form. Supabase recommends `using (household_id = (select public.current_household_id()))`; the wrapping SELECT makes it evaluate once per query instead of once per row. `current_household_id()` and the `household_name` metadata key are contract surfaces S-01+ will depend on.
- **Fix**: Add the policy template to the plan (or to `docs/reference/contract-surfaces.md`).
- **Decision**: FIXED

### F8 — Required householdName makes the unmodified smoke test fail

- **Severity**: ❌ CRITICAL
- **Impact**: 🔎 MEDIUM — real tradeoff; pause to reason through it
- **Dimension**: Plan Completeness
- **Location**: Phase 2 Contract (signup.ts) vs Phase 3 / Testing Strategy (`npm run smoke` unmodified)
- **Detail**: `scripts/smoke.mjs:43` posts `{ email, password }` and expects `302` to `/auth/confirm-email`. Phase 2 makes `householdName` required (`z.string().trim().min(1).max(100)`), so that request fails zod and the smoke step goes red — including the CI `smoke` job, which runs this script after `supabase start`. The same contract also says "return 400" or "JSON if there is no error-shape convention". The convention exists: `signup.ts:11-19` and `signin.ts` redirect to `?error=`, and `signup.astro:5` is the only thing that feeds `ServerError`. A 400 JSON body never renders that page. Progress 2.7 requires 400; Progress 3.2 requires the unmodified smoke script to pass. Both cannot be true.
- **Fix A ⭐ Recommended**: On zod failure, redirect to `/auth/signup?error=...` (same shape as every other auth error). Update `scripts/smoke.mjs` to send `householdName` (e.g. `"Mój dom"`) and replace the plan's "smoke passes unmodified" lines with that one-field change. Change step 2.7 to assert the redirect and that no `auth.users` row was created. Add a client-side `trim().length <= 100` check so a 101-character name does not leave the form.
  - Strength: The field stays required, CI stays green, and the signup page can still show the error.
  - Tradeoff: The plan must touch `scripts/smoke.mjs`, which it currently promises not to.
  - Confidence: HIGH — smoke body and the redirect convention are both in the repo.
  - Blind spot: None significant.
- **Fix B**: If `householdName` is absent, default it to `"Mój dom"` on the server and only reject an empty string or a value over 100 characters.
  - Strength: `scripts/smoke.mjs` really can stay unmodified.
  - Tradeoff: A direct POST without the field still creates an account, so "required" is only true in the browser.
  - Confidence: HIGH — the trigger already falls back to that default.
  - Blind spot: None significant.
- **Decision**: FIXED via Fix A (redirect on zod failure using the existing `?error=` convention; `smoke.mjs` updated to send `householdName`; Progress 2.7/2.8 and Phase 3's "smoke unaffected" wording updated accordingly)

### F9 — "Owners always bypass RLS regardless of FORCE" is false

- **Severity**: ⚠️ WARNING
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Architectural Fitness
- **Location**: Critical Implementation Details, second bullet
- **Detail**: The bullet says owners always bypass RLS regardless of `FORCE`, then says `FORCE` would break every signup if `postgres` lacks `BYPASSRLS`. Those two claims cannot both be true. The contract action is right (ENABLE, do not FORCE). The first sentence is the one that is wrong: `FORCE ROW LEVEL SECURITY` is exactly the switch that puts the owner back under the policies. An implementer who trusts the first sentence can add `FORCE` later "because it does nothing" and every signup starts failing.
- **Fix**: Replace the first sentence with: owners bypass RLS unless the table is `FORCE`d; do not `FORCE`, because these functions must keep bypassing RLS to insert and to read `household_members`.
- **Decision**: FIXED

### F10 — plan-brief.md still describes the pre-fix plan

- **Severity**: ⚠️ WARNING
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Plan Completeness
- **Location**: plan-brief.md Key Decisions, Phases at a Glance
- **Detail**: The brief still says membership is `UNIQUE(user_id)` (the plan's primary key replaced that) and still lists "RLS FORCE" as the Phase 1 risk (the plan now forbids FORCE). Someone implementing from the brief alone would reintroduce both F1 and F5.
- **Fix**: Update the brief rows to primary key + `on delete cascade`, `search_path = ''` on both functions, and the zod check on `householdName`.
- **Decision**: FIXED (also synced the stale "smoke passes unmodified" line per F8)

### F11 — db reset depends on a seed file that is not in the repo

- **Severity**: ⚠️ WARNING
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Blind Spots
- **Location**: Phase 1 success criterion 1.1
- **Detail**: `supabase/config.toml` has `[db.seed] enabled = true` and `sql_paths = ["./seed.sql"]`. `supabase/seed.sql` does not exist. Step 1.1 is `npx supabase db reset`, which loads that seed list after migrations. Not executed here (Docker is off).
- **Fix**: Add an empty `supabase/seed.sql` in Phase 1 (or point `sql_paths` at a file the phase creates) so reset has something to open.
- **Decision**: FIXED

### F12 — deploy-plan.md can still create the demo user before the migration

- **Severity**: ⚠️ WARNING
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Blind Spots
- **Location**: Migration Notes / Progress 1.5
- **Detail**: The ordering "db push before Gate F" lives only in this plan. `context/deployment/deploy-plan.md` Gate F still says to add the grader user from the dashboard and never mentions a migration. After this change is archived, that checklist is the document someone will follow, and a dashboard user created before the trigger exists gets no household.
- **Fix**: Add one line to Gate F: the household migration must already be on the project (`npx supabase db push`) before any production user is created.
- **Decision**: FIXED

### F13 — pgTAP fixture still says `insert into auth.users (...)`

- **Severity**: ⚠️ WARNING
- **Impact**: 🔎 MEDIUM — real tradeoff; pause to reason through it
- **Dimension**: Plan Completeness
- **Location**: Phase 3 Contract, fixture bullet
- **Detail**: The ellipsis hides the only part of this insert that usually fails. `auth.users` has many NOT NULL columns (`instance_id`, `aud`, `role`, token columns, `raw_app_meta_data`, `raw_user_meta_data`, …). The exact set is whatever the local GoTrue schema ships, and it is not in this repo. A wrong guess fails `supabase test db` for a reason that looks like a trigger bug.
- **Fix**: In the Phase 3 contract, require the implementer to take the NOT NULL columns from `\d auth.users` on the local database and list them in the test. State the values the trigger actually needs: a real `id`, `raw_user_meta_data` containing `household_name`, and `email`. Do not leave `(...)`.
  - Strength: The fixture matches the database that will run the test, instead of a column list copied from memory.
  - Tradeoff: The plan cannot spell the columns until Docker is up; the first implementation step is to read them.
  - Confidence: MEDIUM — the failure mode is standard; this repo's exact column set was not inspected.
  - Blind spot: Docker is off, so `\d auth.users` was not run.
- **Decision**: FIXED

### F14 — Phase 1's own RLS policies skip the `(select ...)` wrap the plan itself mandates

- **Severity**: ⚠️ WARNING
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Architectural Fitness
- **Location**: Phase 1 Contract — RLS policies, vs. Implementation Approach's "Contract surface" section
- **Detail**: The Implementation Approach section (lines 39–46) tells every *future* table to write `using (household_id = (select public.current_household_id()))`, explaining that the wrapping `select` makes Postgres evaluate the function once per query instead of once per row. Phase 1's own two policies (line 77) don't follow that pattern: `id = current_household_id()` and `household_id = current_household_id()`, with no wrapping `select`. The plan documents a performance rule and then violates it in the one place a future implementer is most likely to copy from.
- **Fix**: Change both Phase 1 policies to `id = (select public.current_household_id())` and `household_id = (select public.current_household_id())`, matching the template already written for future tables.
- **Decision**: DISMISSED (user: `households`/`household_members` have exactly one row per account in v1 — no measurable per-row-vs-per-query difference exists to wrap for. The correct template already lives above in "Implementation Approach" for whoever writes a future table against real row counts.)

### F15 — Implicit default-deny vs. CLAUDE.md's "granular per-operation, per-role policies" rule

- **Severity**: ⚠️ WARNING
- **Impact**: 🔎 MEDIUM — real tradeoff; pause to reason through it
- **Dimension**: Architectural Fitness
- **Location**: Phase 1 Contract — RLS section; `CLAUDE.md` § Key conventions
- **Detail**: `CLAUDE.md` states the project convention as "Always enable RLS on new tables with granular per-operation, per-role policies." The plan enables RLS but defines only two SELECT policies total — INSERT/UPDATE/DELETE are denied purely by the *absence* of any policy, not by explicit per-operation, per-role statements. Functionally equivalent to default-deny, but it's a literal deviation from the stated convention, and in Supabase Studio's policy list this table will show "2 policies" with no visual indication that writes are deliberately, not accidentally, unprotected.
- **Fix A ⭐ Recommended**: Add one sentence to Critical Implementation Details stating the convention is satisfied by construction — zero policies for INSERT/UPDATE/DELETE denies those operations for every role uniformly, which *is* the granular (per-operation, per-role) outcome, just expressed by omission rather than by enumerated policy rows.
  - Strength: Zero new SQL; documents intent so a future reader doesn't mistake the absence for an oversight.
  - Tradeoff: Relies on a comment being read; Supabase Studio's UI still won't visually distinguish "deliberately none" from "forgot to add any."
  - Confidence: HIGH — this is a reasonable reading of "granular," and matches how the rest of the plan already reasons about RLS.
  - Blind spot: None significant.
- **Fix B**: Add explicit `using (false)` policies for INSERT/UPDATE/DELETE, for both `anon` and `authenticated`, on both tables.
  - Strength: Literal, visible compliance with the written convention — Supabase Studio shows real policy rows.
  - Tradeoff: 8 boilerplate policies that change no behavior versus Fix A — the kind of abstraction-for-its-own-sake this review's own Lean Execution checklist flags elsewhere in this plan.
  - Confidence: MEDIUM — unclear whether `CLAUDE.md`'s author meant "write a policy whenever behavior differs by role" or literally "one row per operation per role, always."
  - Blind spot: Whether this project's Supabase advisor/lint treats explicit-`false` policies as noise worth its own warning.
- **Decision**: DISMISSED (user caught a real flaw in Fix B: `PERMISSIVE` policies for the same command OR together, so a `using (false)` policy is not a lasting guard — once any future permissive INSERT/UPDATE/DELETE policy is added for a role, it ORs right past the `false` one and the "guard" silently does nothing. The plan's actual mechanism — zero write policies, i.e. true default-deny — already achieves "granular per-operation, per-role" by covering every operation and every role uniformly. No change needed.)

### F16 — Phase 2's Automated Verification doesn't cover its own Progress 2.8 smoke check

- **Severity**: ⚠️ WARNING
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Plan Completeness
- **Location**: Phase 2 Success Criteria (Automated Verification) vs. Progress 2.8
- **Detail**: Progress has `2.8 scripts/smoke.mjs sends householdName and its "signup creates account" step still passes`, but Phase 2's own `#### Automated Verification:` list only has lint/`astro check`/build — `npm run smoke` is never listed there as something to run for Phase 2. The only places `npm run smoke` is mentioned are Phase 3's Automated Verification and the Testing Strategy section, both one phase removed from where the smoke.mjs edit actually happens.
- **Fix**: Add `npm run smoke passes (confirms the Phase 2.8 householdName addition didn't break the signup step)` to Phase 2's Automated Verification list.
- **Decision**: DISMISSED (user: 2.8 is correctly placed under `#### Manual`, and Phase 3's 3.2 is the same smoke re-run already counted as the automated check. The proposed fix would have added a third, redundant mention rather than fixing a real gap — reviewer error, not a plan defect.)

### F17 — No UPDATE/DELETE-deny assertions, despite "verified impossible at the database level"

- **Severity**: ⚠️ WARNING
- **Impact**: 🔎 MEDIUM — real tradeoff; pause to reason through it
- **Dimension**: Blind Spots
- **Location**: Desired End State ("Cross-household data leakage is verified impossible at the database level") vs. Phase 3 Contract assertions
- **Detail**: Phase 3's assertions (from the F3/F13 fixes) cover SELECT isolation for both tables and one `throws_ok` for INSERT on `households`. Nothing in the fixture or assertions exercises UPDATE or DELETE as `authenticated` on either table. The claim in Desired End State is unqualified ("verified impossible"), which a reader would reasonably take to mean all write paths, not just INSERT.
- **Fix A ⭐ Recommended**: Assert `UPDATE`/`DELETE` against the other household affect 0 rows, via `is(count(*) of RETURNING, 0)`. Do not use `throws_ok`: with no policy, `USING` filters every existing row out and the command succeeds. `throws_ok` stays correct for `INSERT` only (`WITH CHECK` raises). The data-modifying `WITH` must be the top-level statement, and the other household's id must be captured before `set local role`.
  - Strength: A broken write policy makes the count 1 and the assertion fails. `INSERT` keeps the exception assertion that matches how Postgres actually treats a new row.
  - Tradeoff: The id has to be saved before the role switch, and the `WITH` cannot sit inside `is(...)`.
  - Confidence: HIGH — this is the documented `UPDATE`/`DELETE` vs `INSERT` split under RLS.
  - Blind spot: None significant.
- **Fix B**: Leave the test as-is, but narrow the Desired End State wording to "read isolation, and write-denial demonstrated via INSERT" — since Postgres RLS default-deny is one uniform mechanism per table (absence of a policy for a command denies that command for every role equally), proving it once arguably proves the mechanism, and re-testing per command type tests Postgres's engine rather than this plan's own logic.
  - Strength: No new test code; keeps the test file focused on what's actually specific to this schema.
  - Tradeoff: A later reader could still reasonably ask why UPDATE/DELETE weren't checked; the documentation has to carry that reasoning clearly, and it's easy to lose track of "this was a deliberate scope choice" over time.
  - Confidence: MEDIUM — technically sound, but weakens the plan's own strongest claim ("verified... at the database level") right where a reviewer would look for proof.
  - Blind spot: Assumes nobody adds a permissive UPDATE/DELETE policy later without re-reading this reasoning.
- **Decision**: FIXED (rewritten Fix A: `is` on `RETURNING` count for `UPDATE`/`DELETE`, `throws_ok` kept for `INSERT` only; `WITH` is top-level; other household id captured before `set local role`)

### F18 — Validation-order in signup.ts isn't specified

- **Severity**: 💡 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Plan Completeness
- **Location**: Phase 2 Contract, item 3 (Sign-up API route)
- **Detail**: The contract says to validate `householdName` with zod and, on success, call `supabase.auth.signUp(...)`, but doesn't say whether the zod check should run before or after the existing `createClient` null-check (`signup.ts:9-12`). The obvious choice (validate input before touching Supabase at all) isn't stated, leaving it to the implementer to infer.
- **Fix**: Add one clause: "the zod check runs first, before `createClient` — fail fast on bad input without needing Supabase configured at all."
- **Decision**: DISMISSED (user: both orderings satisfy every stated success criterion — the only scenario where order would matter, Supabase misconfigured *and* an invalid name in the same request, isn't exercised by any test in the plan. Not a real ambiguity for the implementer.)
