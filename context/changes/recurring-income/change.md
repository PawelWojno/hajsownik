---
change_id: recurring-income
title: Recurring income
status: impl_reviewed
created: 2026-10-12
updated: 2026-10-12
archived_at: null
---

## Notes

- **Decision 2026-10-12:** recurring income keeps the predefined `source` (PRD FR-012), not a `category_id`. The user wants their own list of income sources and standardised add-income / add-expense forms, but that is a product change (PRD v2), deferred to post-MVP slice S-07 `income-categories` (`context/foundation/roadmap.md`, GitHub #21). Reason for deferring: the deadline (2026-11-04, fallback 2026-12-06), and the fixed list already satisfies FR-012.
- **How to apply when planning:** copy the S-04 pattern with `source` in place of `category_id`; no composite FK to `categories` and no `ON DELETE CASCADE` for it. Keep `source` in as few places as possible (one column, the `INCOME_SOURCES` constant, one select in the form) so S-07 can swap it for `category_id` cheaply, including in `recurring_incomes`.
- See `research.md` for the S-04 patterns and the open design questions.
