# First expense + income — Plan Brief

> Full plan: `context/changes/first-expense-and-income/plan.md`

## What & Why
Hajsownik can't answer "ile zostaje w tym miesiącu" yet. This slice (north star S-01) lets a user log an expense
(amount -> category -> save) and an income entry from a slide-in panel and see Przychody / Wydatki / Zostaje update instantly.

## Starting Point
F-01 provides households + RLS but no domain tables; `/dashboard` is a placeholder and there is no budgeting UI.

## Desired End State
`/dashboard` is the month screen. Every household has 12 default categories. Saving keeps the panel open (quick entry)
and updates sums without reload; one household never sees another's data.

## Key Decisions Made

| Decision | Choice | Why |
| --- | --- | --- |
| Default categories | 12: Jedzenie, Dom i rachunki, Transport, Zdrowie, Higiena i uroda, Ubrania, Rozrywka, Dzieci, Edukacja, Prezenty, Podróże, Inne | Count matches PRD's 12; names chosen by the user during planning (`opis_aplikacji.txt` lists 13 "np." examples) |
| Entry UI | Slide-in panel on month screen (bottom sheet on phone, right panel on desktop), ~60% height, sums visible | Fastest path; sums visible while entering several items |
| Close behaviour | X, swipe, Esc and backdrop tap always close | User's choice; form resets after save anyway |
| UI language | Everything outside auth is Polish (`lang="pl"`, top bar, landing page, new endpoints' errors); auth flow stays English until a separate change | Consistent app chrome around the new screen without growing S-01 into a translation of 10+ auth files |
| Month screen scope | Current month only, sums + caption, no budget bar | Budget bar is a PRD Non-Goal -> parked |
| "zostaje" computation | SQL function `month_summary` (security invoker), returned by POST endpoints | One tested source of truth; no page reload |
| Money | `amount_minor bigint` (grosze) | No float errors |
| "Today" | `Europe/Warsaw` constant; timezone setting parked post-MVP | Workers run in UTC |
| Category picker | 12-button grid | One-tap selection |
| Isolation | RLS `(select current_household_id())` + composite FK `(household_id, category_id)` | Blocks cross-household category attachment |
| Writes | Insert only; update/delete default-deny | Edit/delete belongs to S-06 |

## Scope
**In:** 3 tables + RLS, default categories (+backfill), `month_summary`, 2 POST endpoints, month screen with panel, Polish UI outside auth, pgTAP, smoke.
**Out:** month navigation, history/edit/delete, category management, recurring, person/subcategory fields, budget bar, translating the auth flow (separate change).

## Architecture / Approach
DB (tables, RLS, function, trigger seeding) -> JSON API (zod, user-session Supabase client, returns fresh summary)
-> React island with shadcn Drawer on a server-rendered `/dashboard`.

## Phases at a Glance

| Phase | What it delivers | Key risk |
| --- | --- | --- |
| 1. Schema, RLS, categories | Migration + pgTAP proof | Cross-household FK leak; revoke EXECUTE on definer helper |
| 2. API | `money`/`dates` helpers, 2 endpoints | Timezone at month boundary |
| 3. Month screen | Panel UI, quick entry, live sums | Mobile keyboard vs 60% panel height |
| 4. Smoke + roadmap | Extended smoke, Parked entries | Getting a category id into the smoke script |

**Prerequisites:** F-01 done (it is). **Estimated effort:** ~4 sessions, one per phase.

## Open Risks & Assumptions
- Panel height with the on-screen keyboard on small phones may need tuning during Phase 3.
- Backdrop-tap closing can discard a typed amount (accepted by the user).
- Hardcoded `Europe/Warsaw` is fine for a single-country app.

## Success Criteria (Summary)
- A new user adds an expense and an income in seconds and sees Zostaje change without reload.
- Another household's data is unreachable (pgTAP).
- `npm run smoke`, lint, `astro check` and build pass.
