<!-- IMPL-REVIEW-REPORT -->
# Implementation Review: Category Management Implementation Plan

- **Plan**: context/changes/category-management/plan.md
- **Scope**: Full plan (code of all 3 phases; steps 1.3 and 3.7 are still open in Progress)
- **Reviewed phases**: 1, 2, 3
- **Date**: 2026-10-09
- **Verdict**: APPROVED
- **Findings**: 0 critical, 2 warnings, 6 observations

## Verdicts

| Dimension | Verdict |
|-----------|---------|
| Plan Adherence | PASS |
| Scope Discipline | PASS |
| Safety & Quality | PASS |
| Architecture | WARNING |
| Pattern Consistency | PASS |
| Success Criteria | WARNING |

## Automated checks re-run during the review

- `npm run lint` — PASS
- `npx astro check` — PASS (0 errors, 0 warnings)
- `npx supabase test db` — PASS (category_management 29/29, expenses_income, household_isolation)
- `npm run build` — PASS
- `npm run smoke` — PASS on the preview server (last full run before the UI-only inline-delete change; not re-run after it)
- Not re-runnable here: 1.3 (job `smoke` in CI with `supabase test db`) and 3.7 (`supabase db push` to production)

## Findings

### F1 — Production migration and CI run are still open before merge

- **Severity**: ⚠️ WARNING
- **Impact**: 🔎 MEDIUM — real tradeoff; pause to reason through it
- **Dimension**: Success Criteria
- **Location**: context/changes/category-management/plan.md:251, 284
- **Detail**: Steps 1.3 (CI green with the new `supabase test db` step) and 3.7 (`npx supabase db push`) are unchecked. The `deploy` job in `.github/workflows/ci.yml` does not apply migrations, and `src/pages/dashboard.astro:19` now filters on `archived_at`. Merging to master before the push breaks `/dashboard` in production. The new CI step was also never run with the `-x ...` flags used in `supabase start`.
- **Fix**: Run `npx supabase db push`, then push the branch, open the PR, wait for the green `smoke` job, and only then merge. Put the `db push` requirement at the top of the PR description.
  - Strength: Follows the order the plan already prescribes (Migration Notes) and closes both open steps.
  - Tradeoff: Manual step outside the agent's reach (production DB).
  - Confidence: HIGH — the plan and the CI file confirm the deploy job has no migration step.
  - Blind spot: Whether `supabase test db` works with the reduced service set in CI is only known after the first CI run.
- **Decision**: FIXED (Fix now) — no code change; open steps 1.3 and 3.7 stay with the user: db push, PR, green CI before merge

### F2 — Service module mixes HTTP concerns into the data layer

- **Severity**: ⚠️ WARNING
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Architecture
- **Location**: src/lib/services/categories.ts:81-110
- **Detail**: The plan puts "logika wywołań Supabase poza trasami" into the service. `categories.ts` also imports `json`, `INVALID_REQUEST` and `SAVE_FAILED` from `@/lib/http` and holds `categoryResponse`, `readJson` and `invalidRequest`. The sibling `src/lib/services/month.ts` has no HTTP imports and returns plain data.
- **Fix**: Move `categoryResponse`, `readJson` and `invalidRequest` to `src/lib/http.ts` (or a small `src/lib/category-http.ts`), keep `CategoryResult` and the DB error codes in the service.
- **Decision**: FIXED — Fix now: categoryResponse moved to src/lib/category-http.ts, readJson/invalidRequest to src/lib/http.ts

### F3 — Unused export `PAGE_TARGET`

- **Severity**: 💡 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Pattern Consistency
- **Location**: src/hooks/useCategoryActions.ts:7
- **Detail**: `PAGE_TARGET` is exported but never used; `ErrorTarget` is just an alias for `string`.
- **Fix**: Delete `PAGE_TARGET` and the `ErrorTarget` alias (use `string`).
- **Decision**: FIXED — Fix now: PAGE_TARGET and ErrorTarget removed

### F4 — Error message stays after "Anuluj" in the delete confirmation

- **Severity**: 💡 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Plan Adherence
- **Location**: src/components/settings/CategoryManager.tsx (DeleteControl) and src/hooks/useCategoryActions.ts:43
- **Detail**: After a failed delete ("Ta kategoria ma wydatki…") and a click on "Anuluj", the error text stays under the row until the next action. Seen in the browser test. The message is still true, so this is cosmetic.
- **Fix**: Expose a `clearError` from `useCategoryActions` and call it on "Anuluj".
- **Decision**: FIXED — Fix now: clearError exposed by the hook and called on "Anuluj"

### F5 — Update-policy WITH CHECK is not independently covered by a test

- **Severity**: 💡 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Success Criteria
- **Location**: supabase/tests/database/category_management.test.sql:77-84
- **Detail**: In the break-check, replacing `categories_update_own ... with check` with `with check (true)` kept the test "A cannot move a category to household B" green. The SELECT policy is also applied to the new row of an UPDATE, so it masks the missing check. The policy is still correct; the test just does not isolate it.
- **Fix**: Leave as is, or add a comment in the test that the select policy also guards this case.
- **Decision**: FIXED — Fix now: explanatory comment added in the pgTAP test

### F6 — Intermittent 500 on body-less non-GET requests over a reused connection (local servers)

- **Severity**: 💡 OBSERVATION
- **Impact**: 🔎 MEDIUM — real tradeoff; pause to reason through it
- **Dimension**: Safety & Quality
- **Location**: local `astro dev` / `astro preview` (workerd); not tied to a line of this change
- **Detail**: Reported earlier as an unexplained 500 on an anonymous PATCH. Reproduced during the review: with Node `fetch` reusing a connection, a second request such as `DELETE` without a body returns an HTML 500, also against the existing `/api/expenses` (a method that route does not export). `curl` with a fresh connection returns the expected 401/404. It is not caused by the category routes, and production behaviour on Cloudflare Workers is unknown.
- **Fix**: No change in this PR. If it shows up in production or in the smoke job, investigate the adapter/workerd request handling separately.
- **Decision**: ACCEPTED — no change in this PR; investigate separately if it appears in production or in CI smoke

### F7 — Extra: inline delete confirmation not in the plan

- **Severity**: 💡 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Scope Discipline
- **Location**: src/components/settings/CategoryManager.tsx (DeleteControl)
- **Detail**: The plan lists "Usuń" but does not describe a confirmation. An inline "Na pewno?" step was added at the user's request after `window.confirm` was rejected (blocked dialogs make the button silently do nothing). Harmless and small.
- **Fix**: Add one line to the Phase 3 contract in the plan as an addendum.
- **Decision**: FIXED — Fix now: addendum added to the Phase 3 contract in plan.md

### F8 — Archived category can still receive an expense from an already open card

- **Severity**: 💡 OBSERVATION
- **Impact**: 🔎 MEDIUM — real tradeoff; pause to reason through it
- **Dimension**: Safety & Quality
- **Location**: src/pages/api/expenses.ts:39
- **Detail**: `POST /api/expenses` does not reject archived categories. This was explicitly accepted in the plan ("What We're NOT Doing"); the data stays consistent. Listed only so S-06 (history) remembers to mark such expenses as belonging to an archived category.
- **Fix**: None now; revisit in S-06.
- **Decision**: ACCEPTED — per plan (What We are NOT Doing); revisit in S-06
