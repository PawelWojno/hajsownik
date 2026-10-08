# Lessons Learned

> Append-only register of recurring rules and patterns. Re-read at start by /10x-frame, /10x-research, /10x-plan, /10x-plan-review, /10x-implement, /10x-impl-review.

## RLS policies wrap current_household_id() in (select …)

- **Context**: supabase/migrations/20261008175223_household_foundation.sql:35,39 (policies households_select_own, household_members_select_own)
- **Problem**: Policies call `public.current_household_id()` directly, without `(select …)`. A SECURITY DEFINER function can't be inlined, so Postgres runs it once per row instead of once per query. On tables with one row per account it costs nothing, but the next tables (expenses, categories) will probably be copied from this migration and not from the template in plan.md.
- **Rule**: Every RLS policy that filters by household uses `household_id = (select public.current_household_id())`, never a bare function call, including on small tables, because migrations get copied.
- **Applies to**: supabase/migrations/** — every new or changed RLS policy that uses current_household_id() (or any other auth.uid()-based function)
