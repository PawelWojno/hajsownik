---
project: "Hajsownik"
context_type: greenfield
created: 2026-10-06
updated: 2026-10-06
checkpoint:
  current_phase: 8
  phases_completed: [1, 2, 3, 4, 5, 6, 7]
  gray_areas_resolved:
    - topic: "pain category"
      decision: "friction in workflow + data trapped somewhere + decision paralysis (all three apply)"
    - topic: "differentiating insight"
      decision: "separates 'zostaje' / 'cel' / 'koszt utrzymania' instead of collapsing them into one 'savings' number"
    - topic: "primary persona scope"
      decision: "the user themself and their own household, not a multi-household product from day one"
    - topic: "login mechanism"
      decision: "email + password accounts"
    - topic: "role separation within a household"
      decision: "flat — all accounts in a household are equal, no owner/admin role"
    - topic: "first-flow timeline"
      decision: "SUPERSEDED — originally 3 weeks for the primary flow alone, no scope-down needed; superseded by the Phase 6 scope expansion below, which raised the whole-v1 budget to 5 weeks. The binding value is frontmatter timeline_budget.mvp_weeks (5) plus the Timeline acknowledgment block."
    - topic: "secondary MVP outcome"
      decision: "category management (add/remove/rename/reorder)"
    - topic: "guardrails"
      decision: "expense entry must stay fast (amount→category→save); one household's financial data must never leak to another household's view"
    - topic: "Socratic round outcomes (Phase 4.5)"
      decision: "added FR-003 (password reset by email); carried forward session-persistence as an NFR candidate for Phase 5; demoted future-dated expenses to nice-to-have (FR-005), past-dated stays must-have; added uniqueness rule to category names; added default creation-order rule to category reordering; income source is a predefined list, not free text; month screen must label 'zostaje' as a monthly difference, not savings"
    - topic: "scope expansion during Phase 6 (recurring expenses/income, history screen)"
      decision: "user added recurring expenses/income (auto-generated monthly, editable/stoppable, future-only) and a history screen (filter by month+category), plus generic edit/delete for any saved expense/income entry (FR-014..FR-020). Scope-cost disclosed; user chose to commit to a longer timeline (5 weeks) rather than scope down."
    - topic: "project name"
      decision: "working title 'Budżet Domowy' rejected by user; final name is 'Hajsownik'"
    - topic: "post-acceptance schema-compliance fixes (2026-10-06)"
      decision: "unauthenticated visitor on a gated route is redirected to login (added to Access Control); recurring definitions (FR-014/FR-016) never create entries for past months, only generate forward from creation; deleting/editing one generated entry never stops the recurring definition (FR-019/FR-020 wording); FR-001 requires email verification before password reset (FR-003) is usable; FR-005 and the person-label capability both added explicitly to Non-Goals; Socratic blocks added for FR-003, FR-005, FR-014, FR-016, FR-019, FR-020"
    - topic: "recurring mechanism simplified to a fixed horizon (2026-10-06)"
      decision: "replaced open-ended 'generates forever until stopped' recurrence (FR-014/FR-016) with a user-chosen horizon in months, materialized upfront as real entries at definition time — avoids needing a monthly background job. Editing a recurring amount now explicitly means delete-the-future-entries-and-regenerate-at-the-new-amount (not just delete), since the two are different operations; stopping stays delete-future-entries-only (FR-015/FR-017). Added a reminder when fewer than 2 months remain in the generated horizon, so the user notices before it silently lapses. Raised during tech-stack selection, resolved before stack choice since it changes the implementation shape (no scheduler/cron needed)."
  frs_drafted: 20
  quality_check_status: accepted
product_type: web-app
target_scale:
  users: small
  qps: low
  data_volume: small
timeline_budget:
  mvp_weeks: 5
  hard_deadline: 2026-11-04
  after_hours_only: true
---

## Vision & Problem Statement

Today the person managing a household budget does not track it regularly — the budget lives "in their head," so there is no reliable answer to "how much is actually left this month" until money runs short. Registering a typical expense in existing tools requires too many steps, the picture of where money goes is scattered across accounts and receipts, and there is no signal that a category or the monthly budget has been exceeded until it's too late to react.

The insight this product acts on: most budget apps collapse three different numbers — what's left this month, what's deliberately set aside toward a goal, and the cost of upkeep (expenses paid less often than monthly) — into one "savings" figure, which hides what actually happened. This product keeps those three numbers separate and distinct from the start.

## User & Persona

**Primary persona:** The owner of a household budget — the person who sets up the household and, at first, is its only account. Their household can be any composition (apartment, house, person living alone, couple, family with children); the product does not assume a shape in advance. They reach for this product twice: in the moment of a purchase (they want to log it in seconds) and when reviewing the month (they want a fast answer to "how does my budget look this month?").

## Success Criteria

### Primary
- A new user can create an account (email + password, which creates their household), log in, add one expense (amount, category, date defaulting to today), and see the month screen immediately reflect it (wydatki up, zostaje down).

### Secondary
- The user can manage categories (add, remove, rename, reorder) so the default list fits their own household instead of staying generic.

### Guardrails
- Expense entry never grows past amount → category → save for the required fields; everything else stays optional.
- One household's financial data is never visible from another household's account or view.

## User Stories

### US-01: User registers an expense and sees the month update

- **Given** a user who has created an account (and household) and is logged in
- **When** they add an expense with an amount and a category (date defaults to today)
- **Then** the month screen immediately shows the updated total expenses and "zostaje" (income minus expenses) for their household

#### Acceptance Criteria
- Saving the expense requires only amount and category; date and description are optional, date defaults to today.
- The month screen reflects the new expense without any action beyond navigating back to it.
- The updated totals are scoped to the whole household, not to the individual account that logged in.

## Functional Requirements

### Authentication & household
- FR-001: User can create an account with email and password, which creates their household; the email address must be confirmed via a verification link before password reset (FR-003) becomes usable on that account. Priority: must-have
  > Socrates: Counter-argument considered: "no password-recovery path in v1 could permanently lock the user out of their own financial data." Resolution: accepted as a real risk — FR-003 (password reset) added to close the gap.
- FR-002: User can log in with their email and password. Priority: must-have
  > Socrates: Counter-argument considered: "requiring login on every use fights the app's own goal of fast, frequent expense entry." Resolution: accepted — session persists until the user explicitly logs out (carried forward as a Non-Functional Requirement).
- FR-003: User can reset their password by email if they forget it. Priority: must-have
  > Socrates: Counter-argument considered: "without email verification, a password-reset link could be sent to — and used from — an address the account owner doesn't actually control." Resolution: accepted — FR-001 now requires the email to be verified before reset is usable.

### Expenses
- FR-004: User can add an expense with a positive amount and a category; date defaults to today but can be set to any past date, and description is optional. Priority: must-have
  > Socrates (amount validation): Counter-argument considered: "no validation on the amount could let bad entries corrupt 'zostaje'." Resolution: amount must be positive — added to the FR wording.
  > Socrates (date scope): Counter-argument considered: "future-dated expenses are a rare case and the complexity of splitting current vs. future-month totals could wait for v2." Resolution: accepted for future dates only — past-date entry (the common "I forgot to log yesterday's expense" case) stays must-have here; future-dated entry is split out as FR-005 below.
- FR-005: User can set an expense's date to a future date; the expense counts toward the "zostaje" of that future month, not the current one. Priority: nice-to-have (deferred past v1 — see Socratic note on FR-004).
  > Socrates: Counter-argument considered: "a nice-to-have priority alone doesn't keep this out of v1 — the PRD schema requires a nice-to-have to also appear in Non-Goals, or a generator could fold it back into scope." Resolution: accepted — added to `## Non-Goals` below.

### Categories
- FR-006: User sees a default set of expense categories immediately after creating their household. Priority: must-have
  > Socrates: Counter-argument considered: "a long default list (12 categories) slows down category choice during fast expense entry." Resolution: kept as written — the full default list stays; the user can trim it via FR-007/FR-008/FR-009/FR-010 if it doesn't fit their household.
- FR-007: User can add a new category with a name unique within their household. Priority: must-have
  > Socrates: Counter-argument considered: "two categories with the same name would split totals and confuse month-to-month comparisons." Resolution: category names must be unique within a household — added to the FR wording.
- FR-008: User can remove a category only if no expense uses it; if expenses use it, the app points the user to archiving (FR-009) as the alternative. Priority: must-have
  > Socrates: Counter-argument considered: "blocking deletion without pointing to the alternative (archiving) leaves the user stuck with no next step." Resolution: the FR now explicitly states the app points to archiving.
- FR-009: User can archive a category that is still used by past expenses, so it no longer appears as a choice for new expenses; archived categories are visibly marked as archived wherever they appear in history. Priority: must-have
  > Socrates: Counter-argument considered: "the user may not visually tell an archived category apart from an active one when looking at history." Resolution: archived categories must be visibly marked as archived.
- FR-010: User can rename a category; renaming is retroactive and relabels all past expenses under that category. Priority: must-have
  > Socrates: Counter-argument considered: "renaming a category retroactively relabels every past expense under it, and the user may not realize that." Resolution: made explicit in the FR wording rather than a hidden side effect.
- FR-011: User can reorder categories; new categories default to appearing in creation order until manually reordered. Priority: must-have
  > Socrates: Counter-argument considered: "without a clear default order, 'reordering' has no obvious starting point." Resolution: default creation order added to the FR wording.

### Income
- FR-012: User can record a one-time income entry with an amount, a date, and a source chosen from a predefined list (wynagrodzenie, działalność, świadczenia, wynajem, inne). Priority: must-have
  > Socrates: Counter-argument considered: "free-text income sources would produce inconsistent names (e.g. 'pensja' vs 'wynagrodzenie') that break later analysis." Resolution: source is chosen from a predefined list instead of free text.

### Month overview
- FR-013: User can view a single month screen showing total income, total expenses, and what's left (zostaje) for their whole household, scoped to that month's dated entries, clearly labeled as this month's difference rather than money already set aside. Priority: must-have
  > Socrates: Counter-argument considered: "'zostaje' could be mistaken for money already saved — the same confusion the source document itself warns against." Resolution: the month screen must label 'zostaje' as a monthly difference, not as savings.

### Recurring expenses & income
- FR-014: User can define a recurring expense with an amount, a category, a monthly frequency, and a horizon in months (how many months ahead to generate, e.g. default 12); the app immediately creates that many expense entries, one per month starting from the month the definition was created, and never creates entries for months before that. Priority: must-have
  > Socrates: Counter-argument considered: "if the user sets a recurring expense's start date in the past, it's unclear whether the app should retroactively create entries for already-passed months." Resolution: it never does — a recurring definition only generates entries from the month it was created onward, added to the FR wording.
  > Socrates (2026-10-06, raised during tech-stack selection): Counter-argument considered: "an open-ended 'generates forever until stopped' recurrence requires either a monthly background job or on-view catch-up logic, which is more implementation surface than a 5-week solo after-hours timeline needs." Resolution: accepted — recurrence now materializes a fixed, user-chosen horizon of real entries upfront at definition time; no scheduler needed. Trade-off accepted: the horizon can lapse silently, mitigated by the reminder in FR-014's companion note below.
  > Socrates (2026-10-06): Counter-argument considered: "a fixed horizon means the recurrence can run out and the user may not notice, understating future expenses without warning." Resolution: accepted — when fewer than 2 months remain in a recurring definition's generated horizon, the app shows a reminder prompting the user to extend it or let it lapse.
- FR-015: User can edit the amount of a recurring expense or stop it entirely. Stopping deletes all not-yet-passed (future) auto-generated entries for that definition, leaving past entries untouched. Editing the amount deletes those same future entries and regenerates them at the new amount for the remaining horizon. Priority: must-have
  > Socrates: Counter-argument considered: "an automatically generated entry with no confirmation step could silently drift from reality (e.g. the actual bill changed) and corrupt 'zostaje' without warning." Resolution: accepted — FR-019 (edit/delete any saved expense entry) lets the user correct a wrong auto-generated entry the same way they'd correct a manual one.
  > Socrates (2026-10-06, raised during tech-stack selection): Counter-argument considered: "under the fixed-horizon model (see FR-014), 'a change only affects future months' is ambiguous — does editing the amount delete future entries, regenerate them, or both?" Resolution: accepted — made explicit that editing is delete-and-regenerate (two operations), while stopping is delete-only; this distinction was missing from the original wording.
- FR-016: User can define a recurring income with an amount, a monthly frequency, and a horizon in months; the app immediately creates that many income entries, one per month starting from the month the definition was created, and never creates entries for months before that — the same rule as FR-014, applied symmetrically to income. Priority: must-have
  > Socrates: Counter-argument considered: "two parallel recurrence mechanisms (expense and income) with no shared rule could drift apart in behavior." Resolution: accepted — both follow the identical forward-only, fixed-horizon rule from FR-014, stated explicitly here rather than left implicit.
- FR-017: User can edit the amount of a recurring income or stop it entirely. Stopping deletes all not-yet-passed (future) auto-generated entries for that definition, leaving past entries untouched. Editing the amount deletes those same future entries and regenerates them at the new amount for the remaining horizon — the same rule as FR-015, applied symmetrically to income. Priority: must-have
  > Socrates: Counter-argument considered: "an auto-generated income entry for money that never actually arrived (e.g. lost contract) would overstate 'zostaje' with no signal to the user." Resolution: accepted — FR-020 (edit/delete any saved income entry) lets the user remove or correct an entry that didn't materialize.

### History
- FR-018: User can view a history screen listing past expenses, filterable by month and by category. Priority: must-have
  > Socrates: Counter-argument considered: "a history view with no way to edit or delete an entry from it is only half useful — the user sees a mistake but can't act on it from there." Resolution: accepted — FR-019 covers editing/deleting an expense entry; the history screen is where the user reaches it.

### Expense & income maintenance
- FR-019: User can edit or delete a previously saved expense entry, whether manually added or auto-generated by a recurring definition; deleting or editing one generated entry never stops the recurring definition itself — the next month's entry is still generated unless the user explicitly stops the definition via FR-015. Priority: must-have
  > Socrates: Counter-argument considered: "a user who deletes one auto-generated entry may believe that's enough, not realizing the recurring definition is a separate mechanism that will generate the same entry again next month." Resolution: made explicit in the FR wording — stopping requires FR-015, not just deleting an instance.
- FR-020: User can edit or delete a previously saved income entry, whether manually added or auto-generated by a recurring definition; deleting or editing one generated entry never stops the recurring definition itself — the next month's entry is still generated unless the user explicitly stops the definition via FR-017. Priority: must-have
  > Socrates: Counter-argument considered: "the same trap as FR-019, for income — deleting one generated entry doesn't stop next month's from reappearing." Resolution: made explicit in the FR wording — stopping requires FR-017, not just deleting an instance.

## Non-Functional Requirements

- A saved expense is confirmed to the user within 1 second of tapping save.
- Financial data belonging to one household is never visible to, or shared with, anyone who is not an account holder of that household.
- The amount → category → save path can be completed start to finish on a small (phone-sized) touchscreen without zooming or horizontal scrolling.
- A logged-in session persists until the user explicitly logs out — the app never forces a re-login between individual expense entries.

## Business Logic

**For a given month, "zostaje" (what's left) is the sum of that month's registered income minus the sum of that month's registered expenses, computed separately per household.**

The rule consumes two user-facing inputs: the amount and date of every registered expense, and the amount and date of every registered income entry. Its output is a single number per month, per household — "zostaje" — shown on the month screen (FR-013). The user encounters it passively every time they open the month screen, and it updates the moment they save a new expense or income entry; they never compute it themselves. This is the v1 slice of the larger three-number model from the source document (zostaje / na cel / koszt utrzymania) — only "zostaje" is in scope for v1, the other two numbers are deferred.

## Access Control

A household is the unit of data ownership, not an account. At first launch, creating an account creates one household; expenses and income belong to the household, and the month screen shows the whole household's totals, never a private per-account slice.

Accounts use email + password, with the email verified before password reset becomes usable (see FR-001). A household starts with one account; a second account (e.g. a partner) can later join the *same* household and gets the same shared view — there is no owner/admin role, all accounts within a household are equal and can do the same things. That second account, and labeling individual household members (e.g. a child) on an expense, are both explicitly out of v1 scope — see `## Non-Goals`.

An unauthenticated visitor who hits any route that requires an account (e.g. the month screen) is redirected to the login screen; no household data is ever rendered before authentication succeeds.

The exact shape of inviting a second account into a household is an implementation detail for the stack-selection/implementation-planning step, not this PRD.

## Non-Goals

- No bank transaction import, no automatic categorization rules — explicitly a future-extension direction in the source document, not this product's direction for now.
- No splitting a single expense/receipt across multiple people, no separate shared-vs-personal budget accounting ("who owes whom") — one receipt is always one expense with at most one label.
- No AI features or financial assistant — explicitly named in the source document as a future extension, not part of the MVP.
- No second account joining a household yet — v1 ships with exactly one account per household; multi-account households are a near-future addition, not v1.
- No per-person label on an expense (e.g. tagging a purchase "wspólne" or with a child's name) — deferred; no FR in v1 describes or filters by this label.
- No future-dated expenses (FR-005 stays nice-to-have, not must-have) — v1 expense dates are today or in the past only; a future-dated expense is deferred past v1.
- No per-category budget limits or usage bars — deferred; v1 shows totals only, not limits or overage warnings.
- No savings goals, end-of-month forecasting, period-over-period comparisons, a budget health score, spend-reduction suggestions, expense priority tagging (konieczne/opcjonalne), or subcategories — all explicitly deferred to later in the source document; none are part of this MVP.

## Open Questions

No open product-level questions remain at this time — the items previously open (project name, unauthenticated-visitor behavior on gated routes, the person-label/FR mismatch, and FR-005's missing Non-Goals entry) were resolved during the quality cross-check revision on 2026-10-06 and are reflected directly in `## Access Control`, `## Non-Goals`, and the Functional Requirements above.

## Timeline acknowledgment

Acknowledged on 2026-10-06: 5-week MVP (after expanding scope to include recurring expenses/income and a history screen) requires sustained after-hours dedication; user accepted, keeping 2026-11-04 as the target deadline with 2026-12-06 as an explicitly pre-approved fallback.

## Quality cross-check

First run (2026-10-06) passed all five applicable checks, but a follow-up review against the schema found gaps the first pass missed: a missing `## Open Questions` section (10th greenfield section), three Socratic-round gaps (FR-003, FR-005, FR-014, FR-016, FR-019, FR-020 lacked their own challenge), a contradictory gray-area entry on timeline (3 weeks vs. the later 5-week acknowledgment), an Access Control section forward-referencing a person-label FR that didn't exist, and FR-005's nice-to-have priority not mirrored in Non-Goals. All were fixed in place on 2026-10-06: Open Questions section added; all 20 FRs now carry a Socratic block; the stale 3-week gray-area entry is marked superseded; Access Control now states the unauthenticated-redirect behavior and correctly defers the person-label capability to Non-Goals instead of a nonexistent FR; Non-Goals gained explicit entries for the person-label deferral and for FR-005. Re-verified present: Access Control, Business Logic, project artifacts, timeline-cost acknowledgment, Non-Goals (8 entries). Preserved behavior check not applicable (greenfield).

## Forward: tech-stack

(none volunteered yet — captured here if the user raises stack preferences before `/10x-prd` runs)

## Forward: technical-roadmap

(none volunteered yet)
