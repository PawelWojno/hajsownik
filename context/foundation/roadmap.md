---
project: Hajsownik
version: 1
status: draft
created: 2026-10-07
updated: 2026-10-09
prd_version: 1
main_goal: speed
top_blocker: time
milestone_id: first-usable-budget-tracker
milestone_seq: 1
milestone_status: open
---

# Roadmap: Hajsownik

> Derived from `context/foundation/prd.md` (v1) + auto-researched codebase baseline.
> Edit-in-place; archive when superseded.
> Slices below are listed in dependency order. The "At a glance" table is the index.

## Milestone

**M-1: First usable budget tracker** — Status: open

- **Intent:** Ship the full must-have path of the PRD — household-scoped expense/income tracking with categories, recurring entries, history, and account recovery — as a real, usable tool, not a prototype.
- **Source materials:** `context/foundation/prd.md` (v1)
- **Done when:** every F-NN and S-NN below is `done`.
- **Scope anchors:** US-01; every must-have FR (FR-001–FR-004, FR-006–FR-020 — excluding the nice-to-have FR-005).

## Vision recap

Today, a household budget lives "in someone's head" — there's no reliable, low-friction answer to "how much is actually left this month" until money runs short. Hajsownik's core insight is that most budget apps collapse three distinct numbers (what's left this month, what's set aside toward a goal, and periodic upkeep costs) into one misleading "savings" figure; this product keeps them separate from the start, starting with just the first number ("zostaje") in v1.

## North star

**S-01: User can add their first expense and income entry and see the month screen update with a real "zostaje".** — This is the smallest end-to-end flow that proves the core hypothesis (that logging money in and out in seconds, with "zostaje" shown separately instead of folded into one "savings" number, actually helps someone track a budget) holds up in practice.

> A reader-facing gloss: "north star" here means the smallest end-to-end slice whose successful delivery proves the core product hypothesis — placed as early as its Prerequisites allow, because everything else only matters if this works.

## At a glance

| ID   | Change ID                   | Outcome (user can …)                                              | Prerequisites  | PRD refs                     | Status   |
| ---- | ---------------------------- | ------------------------------------------------------------------- | -------------- | ----------------------------- | -------- |
| F-01 | household-foundation         | (foundation) signup creates a household; RLS scopes all data to it | —              | FR-001, FR-002, Access Control, NFR | done |
| S-01 | first-expense-and-income      | add an expense and an income entry, see "zostaje" update on month screen | F-01           | US-01, FR-004, FR-006, FR-012, FR-013 | done |
| S-02 | category-management           | add/remove/archive/rename/reorder categories                       | S-01           | FR-007, FR-008, FR-009, FR-010, FR-011 | proposed |
| S-03 | password-reset                 | reset their password by email if locked out                        | —              | FR-003                        | ready    |
| S-04 | recurring-expenses              | define/edit/stop a recurring expense over a fixed horizon          | S-01           | FR-014, FR-015                | proposed |
| S-05 | recurring-income                | define/edit/stop a recurring income over a fixed horizon           | S-01           | FR-016, FR-017                | proposed |
| S-06 | expense-history-and-edits       | view history (filter by month/category) and edit/delete any entry  | S-01, S-04, S-05 | FR-018, FR-019, FR-020      | proposed |

## Streams

Navigation aid — groups items that share a Prerequisites chain. Canonical ordering still lives in the dependency graph below; this table is the proposed reading order across parallel tracks.

| Stream | Theme                      | Chain              | Note                                                                                 |
| ------ | --------------------------- | ------------------- | ------------------------------------------------------------------------------------- |
| A      | Core proof                  | `F-01` → `S-01`     | `main_goal: speed` — smallest path that proves the whole hypothesis end-to-end.      |
| B      | Category depth              | `S-02`              | Joins Stream A at `S-01`.                                                             |
| C      | Account recovery            | `S-03`              | Standalone — no dependency on the household/data foundation at all.                  |
| D      | Recurring expenses + history | `S-04` → `S-06`     | Joins Stream A at `S-01`; `S-06` also depends on `S-05` (Stream E).                  |
| E      | Recurring income             | `S-05`              | Joins Stream A at `S-01`; feeds into `S-06` (Stream D).                              |

## Baseline

What's already in place in the codebase as of `2026-10-07` (verified via direct file reads this session, not inference).

- **Frontend:** present — Astro 7 + React 19 islands + Tailwind 4 + shadcn/ui wired (`astro.config.mjs`, `components.json`). Only auth-flow pages exist today (`src/pages/auth/*`, `src/pages/dashboard.astro`) — zero budgeting-domain UI.
- **Backend / API:** present (pattern only) — Astro API route convention established (`src/pages/api/auth/*.ts`, POST exports). No request validation (zod) yet; no domain endpoints.
- **Data:** absent — no `supabase/migrations/`, only Supabase's built-in `auth.users`. Zero domain tables (household/category/expense/income/recurring).
- **Auth:** present (partial) — Supabase SSR cookie sessions; signup/signin/signout/confirm-email verified working end-to-end in production (`src/lib/supabase.ts`, `src/middleware.ts`). FR-002 is done; FR-001's "creates their household" clause is not implemented (`signup.ts` never writes a household row); FR-003 (password reset) has zero code.
- **Deploy / infra:** present — Cloudflare Workers, GitHub Actions CI auto-deploy on merge to `master`, verified end-to-end (`context/foundation/infrastructure.md`, `context/deployment/deploy-plan.md`).
- **Observability:** partial — Cloudflare's built-in Workers observability on (`wrangler.jsonc`), no app-level structured logging/error tracking beyond `wrangler tail`.

## Foundations

### F-01: Household + RLS data-access foundation

- **Outcome:** (foundation) Signup extends to create a household row linked to the account (completing FR-001; FR-002/login is already satisfied by Baseline). A minimal Postgres schema + Row-Level-Security policy pattern exists so every future domain table is scoped to the caller's household by construction.
- **Change ID:** household-foundation
- **PRD refs:** FR-001, FR-002 (already satisfied by Baseline), `## Access Control`, NFR ("Financial data belonging to one household is never visible to... anyone who is not an account holder of that household")
- **Unlocks:** S-01 directly; transitively every later slice (S-02 through S-06), since all are household-scoped and none can exist safely without this RLS pattern in place first.
- **Prerequisites:** —
- **Parallel with:** S-03 (fully independent of the household/data layer)
- **Blockers:** —
- **Unknowns:** —
- **Risk:** This is the single gating foundation — every downstream domain table inherits whatever isolation pattern is established here. Sequenced first, alone, specifically so household isolation gets scrutiny before the pattern is replicated across tables.
- **Status:** done
- **GitHub:** #1

## Slices

### S-01: First expense + income, real "zostaje" on the month screen

- **Outcome:** User can add an expense and an income entry and see the month screen immediately reflect updated totals and "zostaje" for their household.
- **Change ID:** first-expense-and-income
- **PRD refs:** US-01, FR-004, FR-006, FR-012, FR-013
- **Prerequisites:** F-01
- **Parallel with:** S-03
- **Blockers:** —
- **Unknowns:** — (resolved during `/10x-plan first-expense-and-income`: the user confirmed the 12 default categories — Jedzenie, Dom i rachunki, Transport, Zdrowie, Higiena i uroda, Ubrania, Rozrywka, Dzieci, Edukacja, Prezenty, Podróże, Inne.)
- **Risk:** This is the broadest slice by design — it's the north star bundle (expense + income + month view) the user explicitly chose over the narrower expense-only version, so it carries more surface than its siblings.
- **Status:** done
- **GitHub:** #2

### S-02: Category management

- **Outcome:** User can add, remove, archive, rename, and reorder categories so the default list fits their own household.
- **Change ID:** category-management
- **PRD refs:** FR-007, FR-008, FR-009, FR-010, FR-011
- **Prerequisites:** S-01
- **Parallel with:** S-04, S-05, S-06
- **Blockers:** —
- **Unknowns:** —
- **Risk:** Rename/archive both have retroactive effects on history (renaming relabels past expenses; archiving must stay visibly marked in history) — low risk, but worth testing against whatever history view S-06 ships.
- **Status:** proposed
- **GitHub:** #4

### S-03: Password reset

- **Outcome:** User can reset their password by email if they forget it, without being permanently locked out of their household's financial data.
- **Change ID:** password-reset
- **PRD refs:** FR-003
- **Prerequisites:** —
- **Parallel with:** F-01, S-01, S-02, S-04, S-05, S-06 (fully independent — account-level only, no household/data dependency)
- **Blockers:** —
- **Unknowns:** —
- **Risk:** Low — Supabase Auth's built-in `resetPasswordForEmail` flow covers this natively; main work is wiring the UI and respecting FR-001's "confirmed email required before reset is usable" gate.
- **Status:** ready
- **GitHub:** #3

### S-04: Recurring expenses

- **Outcome:** User can define a recurring expense (amount, category, monthly frequency, fixed horizon in months) and edit its amount or stop it entirely.
- **Change ID:** recurring-expenses
- **PRD refs:** FR-014, FR-015
- **Prerequisites:** S-01
- **Parallel with:** S-02, S-05
- **Blockers:** —
- **Unknowns:** —
- **Risk:** The fixed-horizon model (materialize N months upfront, no scheduler) was already resolved during tech-stack selection specifically to fit the 5-week timeline — implement exactly that, not an open-ended recurrence.
- **Status:** proposed
- **GitHub:** #5

### S-05: Recurring income

- **Outcome:** User can define a recurring income (amount, monthly frequency, fixed horizon in months) and edit its amount or stop it entirely — the same rule as S-04, applied symmetrically.
- **Change ID:** recurring-income
- **PRD refs:** FR-016, FR-017
- **Prerequisites:** S-01
- **Parallel with:** S-02, S-04
- **Blockers:** —
- **Unknowns:** —
- **Risk:** Shares its mechanism with S-04 by design (PRD states both follow an identical forward-only, fixed-horizon rule) — implement as the same underlying pattern applied to a second entity, not a divergent one-off.
- **Status:** proposed
- **GitHub:** #6

### S-06: Expense/income history, with edit and delete

- **Outcome:** User can view a history screen (filterable by month and category) and edit or delete any previously saved expense or income entry — manual or auto-generated — without that action stopping the recurring definition that generated it.
- **Change ID:** expense-history-and-edits
- **PRD refs:** FR-018, FR-019, FR-020
- **Prerequisites:** S-01, S-04, S-05
- **Parallel with:** S-02
- **Blockers:** —
- **Unknowns:** —
- **Risk:** PRD's own Socratic note on FR-018 ties history and edit/delete together ("a history view with no way to edit or delete... is only half useful"), which is why this slice bundles both rather than shipping a read-only history first. Depends on both recurring slices because its acceptance criteria specifically cover auto-generated entries.
- **Status:** proposed
- **GitHub:** #7

## Backlog Handoff

| Roadmap ID | Change ID                 | Suggested issue title                                  | Ready for `/10x-plan` | Notes                          |
| ---------- | --------------------------- | --------------------------------------------------------- | ------------------------ | ------------------------------- |
| F-01       | household-foundation         | Household creation + RLS data-access foundation           | yes                       | —                                |
| S-01       | first-expense-and-income      | Add first expense + income, see month "zostaje" update   | no                        | Blocked on F-01                  |
| S-02       | category-management           | Category management (add/remove/archive/rename/reorder)   | no                        | Blocked on S-01                  |
| S-03       | password-reset                 | Password reset by email                                    | yes                       | —                                |
| S-04       | recurring-expenses              | Recurring expenses (fixed horizon)                          | no                        | Blocked on S-01                  |
| S-05       | recurring-income                | Recurring income (fixed horizon)                            | no                        | Blocked on S-01                  |
| S-06       | expense-history-and-edits       | Expense/income history with edit & delete                   | no                        | Blocked on S-01, S-04, S-05      |

## Open Roadmap Questions

No cross-slice open questions at this time — the PRD carried zero open questions into this milestone, and the interview (main_goal/north_star/top_blocker) didn't surface any sequencing-level ambiguity beyond the per-slice Unknown already noted on S-01.

## Parked

- **Bank transaction import / automatic categorization** — Why parked: explicitly a future-extension direction in the source document, not this product's direction for now (PRD Non-Goals).
- **Splitting a single expense/receipt across multiple people** — Why parked: one receipt is always one expense with at most one label (PRD Non-Goals).
- **AI features or financial assistant** — Why parked: explicitly named as a future extension, not part of the MVP (PRD Non-Goals).
- **Second account joining a household** — Why parked: v1 ships with exactly one account per household; multi-account households are a near-future addition, not v1 (PRD Non-Goals).
- **Per-person label on an expense** — Why parked: deferred; no FR in v1 describes or filters by this label (PRD Non-Goals).
- **Future-dated expenses (FR-005)** — Why parked: nice-to-have, not must-have; v1 expense dates are today or in the past only (PRD Non-Goals).
- **Per-category budget limits or usage bars** — Why parked: deferred; v1 shows totals only (PRD Non-Goals).
- **Savings goals, forecasting, period comparisons, budget health score, spend-reduction suggestions, expense priority tagging, subcategories** — Why parked: all explicitly deferred to later in the source document; none are part of this MVP (PRD Non-Goals).
- **Editing a household's name after creation (settings screen)** — Why parked: surfaced during `/10x-plan household-foundation` (F-01) planning, not in the PRD; the name is set once at signup for now — no FR or settings screen exists yet to revisit it.
- **Personal display name for a user account (collected at signup, editable in settings)** — Why parked: surfaced after `/10x-plan household-foundation` (F-01) review, not in the PRD; signup collects only email, password and household name, and v1 has one account per household, so nothing yet needs to tell accounts apart. Becomes relevant with "Second account joining a household" / "Per-person label on an expense".
- **Cleanup of an orphaned household when its last member's account is deleted** — Why parked: surfaced during `/10x-implement household-foundation` phase 2 — deleting a user cascades to `household_members` but leaves the `households` row behind. Rare in v1 (one account per household, deletion is manual in the dashboard); the right rule depends on the future multi-member design.
- **Budget / usage bar on the month screen (e.g. "Budżet 68%")** — Why parked: surfaced during `/10x-plan first-expense-and-income` (S-01) from the user's month-screen sketch; per-category/monthly limits and usage bars are a PRD Non-Goal, so S-01 ships totals only. Revisit post-MVP together with budget limits.
- **Timezone setting in settings** — Why parked: surfaced during `/10x-plan first-expense-and-income` (S-01); v1 hardcodes `Europe/Warsaw` for "today" and month boundaries because Workers run in UTC. A per-household timezone setting is post-MVP.
- **Polish translation of the auth flow (sign-in, sign-up, confirm-email, forms, `/api/auth/*` messages)** — Why parked: surfaced during `/10x-plan-review first-expense-and-income` (S-01 makes everything outside auth Polish and sets `lang="pl"`); translating the auth files is a separate change. Promote to a slice (e.g. `polish-auth-ui`) if it should count toward M-1.

## Milestone History

(empty — this is the first milestone)

## Done

- **F-01: (foundation) Signup extends to create a household row linked to the account (completing FR-001; FR-002/login is already satisfied by Baseline). A minimal Postgres schema + Row-Level-Security policy pattern exists so every future domain table is scoped to the caller's household by construction.** — Archived 2026-10-08 → `context/archive/2026-10-08-household-foundation/`. Lesson: —.
- **S-01: User can add an expense and an income entry and see the month screen immediately reflect updated totals and "zostaje" for their household.** — Archived 2026-10-09 → `context/archive/2026-10-08-first-expense-and-income/`. Lesson: —.
