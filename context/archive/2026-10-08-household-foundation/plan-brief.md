# Household + RLS Data-Access Foundation — Plan Brief

> Full plan: `context/changes/household-foundation/plan.md`

## What & Why

Hajsownik needs a household data model before any budgeting feature (expenses, income, categories) can exist — every one of those tables must be scoped so one household's financial data is never visible to another. This plan builds that foundation: `households`/`household_members` tables, RLS, a reusable isolation function, and an atomic signup trigger that creates a household (with a name) the moment someone signs up.

## Starting Point

Today, `signup.ts` only creates a Supabase Auth user — no household concept exists anywhere, and `supabase/migrations/` is empty (this is the first migration in the project).

## Desired End State

Signing up creates an account *and* a named household in one atomic step. Every future domain table can enforce "only this household can see this row" with a single-line RLS policy referencing `current_household_id()`.

## Key Decisions Made

| Decision | Choice | Why (1 sentence) |
| --- | --- | --- |
| Household creation mechanism | SECURITY DEFINER trigger on `auth.users` | Atomic — no partial-failure window, and avoids needing a service-role key the project doesn't have. |
| Membership model | Join table (`household_members`, `user_id` as PRIMARY KEY, `ON DELETE CASCADE` on both FKs) | PRD states a second account can join a household later; a join table avoids a breaking migration then. PK (not a separate `unique`) encodes "one account, one household"; cascade avoids FK errors when deleting test/demo users. |
| RLS pattern for future tables | Shared `current_household_id()` function | Every one of the 5 remaining roadmap slices reuses one function instead of repeating a subquery. |
| Household naming | Required field (enforced server-side via zod, not just client-side), pre-filled default, editable | User explicitly asked for a name-at-creation capability (not originally in the PRD) — required avoids blank/ambiguous names; the default removes typing friction; server-side enforcement closes the curl-bypass gap client-only validation would leave. |
| Isolation verification | pgTAP test via `supabase test db` | Tests RLS at the database level — can't be bypassed by an application-code bug, unlike an API-level test. |

## Scope

**In scope:** households/household_members schema, RLS policies, `current_household_id()` function, signup trigger, household-name form field, pgTAP isolation test.

**Out of scope:** joining an existing household, editing a household's name post-creation, any domain tables (categories/expenses/income/recurring), a `role` column on membership.

## Architecture / Approach

Signup → Supabase Auth creates the `auth.users` row → a `SECURITY DEFINER` trigger fires, reading the household name from signup metadata, and inserts `households` + `household_members` rows in the same transaction. All future domain tables reference `current_household_id()` in their own RLS policies — this plan establishes that function but does not create any table that uses it yet.

## Phases at a Glance

| Phase | What it delivers | Key risk |
| --- | --- | --- |
| 1. Schema, RLS, trigger | The data model + isolation mechanism | Both `SECURITY DEFINER` functions need a pinned, empty `search_path`; RLS must stay `ENABLE`-only (never `FORCE`, which would break the owner-run trigger) — covered in Critical Implementation Details |
| 2. Wire sign-up | Household-name field + server-side zod validation + API passthrough | Low — follows existing form pattern, plus one new dependency (`zod`) and a one-field update to `scripts/smoke.mjs` |
| 3. RLS isolation test | Formal proof isolation works | New test type (pgTAP) for this project |

**Prerequisites:** None — this is the first roadmap item, no other work blocks it.
**Estimated effort:** Small — one migration, one form field + one API route change, one test file.

## Open Risks & Assumptions

- Assumes Supabase CLI's `supabase test db` / pgTAP is usable in this project's local dev setup — not previously used here, so Phase 3 is the first time this tooling path gets exercised.
- The static default household-name suggestion ("Mój dom") is not derived from PRD — a deliberate, simple choice rather than a placeholder.

## Success Criteria (Summary)

- A new signup creates exactly one household (with the chosen name) and one membership row, atomically.
- A second household's user can never read the first household's `household_members` row — proven by an automated pgTAP test, not just manual spot-checking.
- The existing auth smoke flow (`npm run smoke`) continues to pass, with its signup step updated to send the now-required `householdName` field.
