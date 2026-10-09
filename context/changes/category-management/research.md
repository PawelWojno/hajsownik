---
date: 2026-10-09T19:03:52+02:00
researcher: Paweł Wojno (with Claude)
git_commit: c4fd08b
branch: master
repository: Hajsownik
topic: "What the codebase already provides for S-02 category-management (FR-007..FR-011), and what must change"
tags: [research, codebase, categories, supabase, rls, s-02]
status: complete
last_updated: 2026-10-09
last_updated_by: Paweł Wojno (with Claude)
---

# Research: Category management (S-02)

**Date**: 2026-10-09T19:03:52+02:00
**Git Commit**: c4fd08b (master, clean tree at start)
**Repository**: Hajsownik

## Research Question

Roadmap S-02 (`context/foundation/roadmap.md:106-117`): the user can add, remove, archive, rename and reorder categories (FR-007..FR-011). What does the codebase already provide, and which existing contracts does S-02 touch?

Scope inspected (read locally, no subagents — one subsystem): `supabase/migrations/20261008233243_first_expense_and_income.sql` in full, `supabase/tests/database/expenses_income.test.sql` (grep only), the `src/` files that touch categories, `src/pages/api/expenses.ts`, `src/lib/http.ts`, `src/middleware.ts`, `src/components/Topbar.astro`, `scripts/smoke.mjs` (grep only), `context/foundation/{prd,roadmap,lessons}.md`, `context/archive/*/plan.md` (grep). Not inspected: `EntrySheet.tsx` internals beyond the `categories` prop, `scripts/smoke.mjs` beyond category-id handling, the S-01 pgTAP file beyond category-related assertions.

## Summary

- **Read-only today.** `categories` has exactly one RLS policy, `categories_select_own` (migration `:46-48`). There is no INSERT/UPDATE/DELETE policy, so every write by an authenticated user is default-denied. S-02 needs new per-operation policies (CLAUDE.md: granular per-operation, per-role).
- **Table shape already covers most of FR-007/010/011.** `categories(id, household_id, name 1..50, sort_order int, created_at)` with `unique (household_id, name)` (`:11`) already enforces FR-007's "unique within household" (case-sensitive; see Open Questions) and `sort_order` already encodes order (`:8`; seed uses `with ordinality`, `:76-79`).
- **FR-009 (archive) has no storage yet.** No `archived` column or equivalent exists on `categories`; a new migration must add it. Nothing in `src/` references archived state.
- **FR-008 (remove only if unused) is partly enforced by the schema.** `expenses` references categories through a composite FK `(household_id, category_id)` with no `on delete` clause (`:26`) → NO ACTION, so deleting a used category fails with FK violation `23503` (the same code the expenses API already maps, `src/pages/api/expenses.ts:11,43`). Whether to rely on that, pre-check, or both is a plan decision. The app must also point the user to archiving when blocked (`prd.md:75`).
- **FR-010 (rename is retroactive) comes free:** expenses store `category_id`, not the name (`:19`), so UPDATE of `name` relabels history with no data migration. Traps: the 1..50 length check and the unique constraint (rename to an existing name → `23505`).
- **Only reader of categories:** `src/pages/dashboard.astro:19` (`select id, name … order sort_order`, no filter). Once archiving exists, this query must exclude archived categories for the entry grid (FR-009), while history (S-06, not built) must still show them marked.
- **No category UI, API route or nav entry.** Existing API routes: `src/pages/api/{expenses,incomes}.ts` and `/api/auth/*`. `Topbar.astro` links only "Miesiąc" and "Wyloguj". `PROTECTED_ROUTES = ["/dashboard"]` (`src/middleware.ts:4`) — a new page (e.g. `/categories`) must be added there.

## Detailed Findings

### Schema and RLS
- Table definition: migration `:5-14`. `categories.household_id` has **no default** (unlike `expenses`/`incomes`, which default to `public.current_household_id()` at `:18,33`). User-session inserts must therefore supply `household_id` or S-02 adds the same default. Inferred from the DDL; not tested.
- Composite unique `(household_id, id)` at `:13` exists solely as the FK target for expenses (comment `:12`).
- Policy pattern: `household_id = (select public.current_household_id())` (`:47,52,55`), mandated by `context/foundation/lessons.md` ("RLS policies wrap current_household_id() in (select …)") — applies to every new policy including `with check`.
- `seed_default_categories` is SECURITY DEFINER with EXECUTE revoked from public/anon/authenticated (`:67-82`); same rule for any new function the user must not call directly (`archive/2026-10-08-first-expense-and-income/plan.md:17`).
- S-01 explicitly deferred writes: header comment "Writes are insert-only for now: no UPDATE/DELETE policies, so those stay default-deny until S-06" (`:3`); S-01 plan lists category add/remove/rename/reorder/archive (S-02) as out of scope (`archive/…/plan.md:44`).

### Existing tests
- `supabase/tests/database/expenses_income.test.sql` asserts 12 default categories in the agreed order per household, cross-household invisibility (lines ~21-47) and composite-FK rejection (~`:80-84`). The S-01 plan also expected "A update/delete matches 0 rows" (`archive/…/plan.md:107`); for `categories` that changes once UPDATE/DELETE policies exist. I did not read the exact assertion (grep only).

### Reads/writes in the app
- `dashboard.astro:19` → `Category {id, name}` (`src/types.ts:4-7`) → `MonthScreen` → `EntrySheet` → `CategoryGrid` (3-column button grid, `CategoryGrid.tsx:13`). Archive filtering belongs in this query (or a view/RPC); `Category` needs an `archived` field only on the management screen.
- API pattern (`src/pages/api/expenses.ts`): `export const prerender = false`, 401 if `!context.locals.user`, `createClient`, `request.json()` in try/catch, zod `safeParse`, first issue message → 400, DB error code → Polish message, otherwise generic `SAVE_FAILED` 500. `json()` in `src/lib/http.ts:3` is typed `SavedEntryResponse | ApiError`, so a category response type must be added to `src/types.ts` and that union.
- `src/lib/validation.ts` has no name field helper; DB check is `char_length(name) between 1 and 50` (`:7`), so zod should trim and use the same bounds.
- Reorder (FR-011): `sort_order int not null`, no uniqueness constraint. A reorder touches many rows; per-row client PATCHes are non-atomic, so a single RPC/upsert is the likely shape (design choice, not a code fact).
- New category order (FR-011: creation order until reordered): `sort_order` has no default, so insert must compute `max(sort_order)+1` per household (race-prone without a lock/RPC; low concurrency in a household, but a conscious choice).

### Constraints from the PRD
- FR-007..FR-011 and their Socratic resolutions: `prd.md:73-81`. FR-009: archived categories "visibly marked as archived wherever they appear in history"; FR-010: retroactivity must be explicit in the UI; FR-008: removal blocked when used, with pointer to archiving.
- Roadmap risk: rename/archive retroactively affect history; test against the S-06 history view (`roadmap.md:115`). S-06 doesn't exist yet, so S-02 can only guarantee the data model keeps archived categories (never hard-delete a used one).

## Code References

- `supabase/migrations/20261008233243_first_expense_and_income.sql:5-14` - categories table
- `…:16-27` - expenses with composite FK (no ON DELETE → NO ACTION)
- `…:46-48` - the only categories policy (SELECT)
- `…:67-82` - seed_default_categories
- `src/pages/dashboard.astro:19` - only reader of categories
- `src/components/month/CategoryGrid.tsx:13` - 3-col grid
- `src/pages/api/expenses.ts:11,29-47` - API route pattern + FK error mapping
- `src/lib/http.ts:3-10` - json() and shared Polish error strings
- `src/middleware.ts:4` - PROTECTED_ROUTES
- `src/components/Topbar.astro` - nav
- `src/types.ts:4-7` - `Category`
- `context/foundation/lessons.md` - RLS `(select …)` rule

## Architecture Insights

- Household scoping is via RLS + `current_household_id()` default/`with check`, not client-supplied ids (`src/pages/api/expenses.ts:36`). Categories break this symmetry (no default); S-02 should choose explicitly.
- Cross-household reference integrity uses composite FKs, not RLS (migration comment `:23-25`).
- Errors: DB code → specific Polish message, everything else → generic 500.
- Migrations are timestamped SQL; pgTAP tests in `supabase/tests/database/`; the smoke test reads category ids from `data-category-ids` on the month page (`scripts/smoke.mjs:82`) — archived/removed categories must not break that contract.

## Historical Context (from prior changes)

- `context/archive/2026-10-08-first-expense-and-income/plan.md:44` - S-02 deferred as out of scope.
- `…/plan.md:17` - functions the user never calls lose EXECUTE for all three roles.
- `…/plan.md:33-34` - composite FK instead of plain FK (RLS isn't applied to FK checks).
- `…/plan.md:107` - S-01 test expectation that UPDATE/DELETE match 0 rows (revisit for categories).
- `context/archive/2026-10-08-household-foundation` - source of `current_household_id()` and the RLS template (not re-read this session).

## Related Research

None for this change.

## Open Questions (for /10x-plan)

1. **Archive representation:** `archived_at timestamptz null` vs `is_archived boolean`.
2. **Remove vs pre-check:** rely on FK `23503` only, or check usage first for a clean message pointing to archiving (FR-008). Can an archived-and-unused category be removed? PRD silent.
3. **Reorder mechanism:** single RPC with ordered id array vs batch of updates; how archived categories sort.
4. **Name uniqueness:** existing constraint is case-sensitive and not trimmed at DB level ("Jedzenie" vs "jedzenie" both allowed). Product decision.
5. **UI location:** new page (`/categories`, add to `PROTECTED_ROUTES`) vs panel on the month screen; Topbar link.
6. **Unarchive:** PRD lists archive but not restore.
7. **Gap:** `EntrySheet.tsx` and the S-01 pgTAP UPDATE/DELETE assertions were not read in full; check before editing.
