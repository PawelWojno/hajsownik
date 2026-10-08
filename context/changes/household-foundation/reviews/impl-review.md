<!-- IMPL-REVIEW-REPORT -->
# Implementation Review: Household + RLS Data-Access Foundation

- **Plan**: context/changes/household-foundation/plan.md
- **Scope**: Full plan
- **Reviewed phases**: 1, 2, 3
- **Date**: 2026-10-08
- **Verdict**: APPROVED
- **Findings**: 0 critical, 1 warning, 6 observations

## Verdicts

| Dimension | Verdict |
|-----------|---------|
| Plan Adherence | PASS |
| Scope Discipline | PASS |
| Safety & Quality | WARNING |
| Architecture | WARNING |
| Pattern Consistency | WARNING |
| Success Criteria | WARNING |

Notes:
- **Plan Adherence**: every planned item is MATCH. Nothing is MISSING.
- **Scope Discipline**: there are some EXTRA changes, and all of them are within the plan's intent:
  - client-side 100-char check in `SignUpForm.tsx:52-53`
  - `to authenticated` on the policies
  - 2 extra trigger asserts in the pgTAP test
  - the Gate F prerequisite line in `deploy-plan.md`, which implements the plan's Migration Notes
- **Automated checks**, all green:
  - `npm run lint` passes
  - `npx astro check` (0 errors) passes
  - `npm run build` passes
  - `npx supabase test db` (14/14) passes
  - `npx supabase db lint` reports no errors

## Findings

### F1 — Email/password in signup.ts not validated with zod

- **Severity**: ⚠️ WARNING
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Pattern Consistency
- **Location**: src/pages/api/auth/signup.ts:9-10
- **Detail**: CLAUDE.md requires API input to be validated with zod. This change added zod but used it only for `householdName`. `email` and `password` still go through `form.get(...) as string`. The cast hides `null` or `File`, and whatever arrives is passed straight to `supabase.auth.signUp`. GoTrue rejects bad input, so this is not a security hole, but the user gets an unclear error from upstream. `signin.ts:6-7` has the same pattern, but it predates this change and is outside this change's scope. The plan itself limited zod to `householdName`, so this is a plan gap, not implementation drift.
- **Fix**: In signup.ts, replace the single schema with `z.object({ email: z.email(), password: z.string().min(6), householdName: z.string().trim().min(1).max(100) })` plus `safeParse(Object.fromEntries(form))`.
- **Decision**: FIXED — Fix now (single z.object for email/password/householdName in signup.ts; lint + astro check green)

### F2 — RLS policies without the `(select …)` wrapper (the template future tables will copy)

- **Severity**: 💡 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Architecture
- **Location**: supabase/migrations/20261008175223_household_foundation.sql:35,39
- **Detail**: Both policies call `public.current_household_id()` without the `(select …)` wrapper. The plan's "Contract surface" section (plan.md:42-46) calls the wrapper "deliberate, not stylistic". Plan-review F14 was DISMISSED because these tables hold one row per account, so the performance cost here is negligible. It is raised again only because real code now exists. Whoever writes S-01 (`categories`, `expenses`) will most likely copy this file rather than the template in the plan, and a SECURITY DEFINER function cannot be inlined, so it would run once per row on large tables.
- **Fix**: A good fit for `/10x-lesson`: "every RLS policy wraps `current_household_id()` in `(select …)`". Alternatively, add a new migration that recreates both policies with the wrapper.
- **Decision**: FIXED + ACCEPTED-AS-RULE: RLS policies wrap current_household_id() in (select …) — new migration 20261008200303_rls_select_wrapper.sql (applied locally, test db 14/14; pushed to prod 2026-10-08)

### F3 — SECURITY DEFINER functions keep default EXECUTE grants

- **Severity**: 💡 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Safety & Quality
- **Location**: supabase/migrations/20261008175223_household_foundation.sql:19-27,41-61
- **Detail**: The migration has no `revoke`. In the `public` schema, Supabase grants EXECUTE to anon and authenticated by default.
  - `current_household_id()` can be called through `POST /rest/v1/rpc/current_household_id`. It only returns the caller's own household id, or NULL for anon, so nothing leaks, but the Supabase Security Advisor may flag it.
  - `handle_new_user_household()` returns `trigger`, so Postgres will not run it outside a trigger. It is not exploitable.
- **Fix**: In a new migration: `revoke execute on function public.handle_new_user_household() from public, anon, authenticated;` and `revoke execute on function public.current_household_id() from public, anon;`. Do NOT revoke from `authenticated`, because the policies need it.
- **Decision**: FIXED — Fix now via new migration 20261008200524_revoke_function_execute.sql (verified locally: test db 14/14, GoTrue signup still creates household, anon RPC → 42501; pushed to prod 2026-10-08). Follow-up: Security Advisor still flags `current_household_id()` as executable by `authenticated` — ACCEPTED as a conscious risk (returns only the caller's own id; `authenticated` must keep EXECUTE for RLS). Rationale and revisit triggers in `../change.md` § Notes.

### F4 — `btrim` strips only spaces; zod `.trim()` strips all whitespace

- **Severity**: 💡 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Safety & Quality
- **Location**: supabase/migrations/20261008175223_household_foundation.sql:51-54
- **Detail**: Outside the UI, for example with a direct call to GoTrue using the anon key, `household_name: "\t"` passes the trigger and the `char_length between 1 and 100` CHECK. The result is a household whose name is a tab. The UI path is protected by zod.
- **Fix**: In the trigger, use `btrim(..., E' \t\r\n')`, or add `check (btrim(name, E' \t\r\n') <> '')` to `households.name`.
- **Decision**: FIXED — Fix now via new migration 20261008200802_trigger_trim_whitespace.sql (verified: GoTrue signup with a whitespace-only name (tab/newline/space) → "Mój dom"; F3 revokes preserved; pushed to prod 2026-10-08)

### F5 — Deleting the last member leaves an orphaned household

- **Severity**: 💡 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Safety & Quality
- **Location**: supabase/migrations/20261008175223_household_foundation.sql:5-15
- **Detail**: Deleting a user from `auth.users` cascades to `household_members`, but the `households` row stays. In v1 (one user per household) these rows are harmless leftovers. This matters once the invite/join flow exists.
- **Fix**: Accept as a v1 risk and revisit with the invite/join slice.
- **Decision**: ACCEPTED — harmless in v1 (one account per household); revisit with the invite/join slice

### F6 — pgTAP: brittle `throws_ok` messages and no `anon` test

- **Severity**: 💡 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Safety & Quality
- **Location**: supabase/tests/database/household_isolation.test.sql:43-48,74-79
- **Detail**: `throws_ok` hard-codes the full Postgres error text along with SQLSTATE 42501, so the test may break after a Postgres version bump even though behaviour is unchanged. There is also no assertion that the `anon` role sees 0 rows. The policies are `to authenticated`, so anon is denied, but no test pins that down.
- **Fix**: Pass only SQLSTATE `'42501'` to `throws_ok` (no message), and add a `set local role anon` block with `is(count(*), 0)` on both tables.
- **Decision**: FIXED — Fix now (throws_ok checks SQLSTATE only via NULL errmsg; added 2 anon asserts; plan 16, test db 16/16)

### F7 — Some criteria not verifiable in this review

- **Severity**: 💡 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Success Criteria
- **Location**: plan.md § Progress (1.1, 1.5, 3.2)
- **Detail**: Three criteria are marked done but were not confirmed in this review:
  - **1.1** (`db reset`) was not re-run because it wipes local data. `supabase test db` and `db lint` passing on the current local schema is indirect evidence that the migration applies.
  - **1.5** (push to production before Gate F) cannot be seen in the diff. The only trace is the note in `deploy-plan.md`.
  - **3.2** (`npm run smoke`) needs a running server and was not re-run.
- **Fix**: Run `npx supabase migration list --linked` and confirm `20261008175223` appears in the Remote column. Optionally run `npm run preview` and then `npm run smoke`.
- **Decision**: FIXED — 1.5 confirmed: `migration list --linked` shows 20261008175223 on remote; 3.2 confirmed: fresh build + preview + `npm run smoke` 8/8 PASS (also F1 error redirects checked). 1.1 not re-run (destructive); covered indirectly by `migration up` + test db 16/16. NOTE: 20261008200303, 20261008200524, 20261008200802 were pushed to prod on 2026-10-08 (confirmed via `migration list --linked`).
