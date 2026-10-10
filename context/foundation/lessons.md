# Lessons Learned

> Append-only register of recurring rules and patterns. Re-read at start by /10x-frame, /10x-research, /10x-plan, /10x-plan-review, /10x-implement, /10x-impl-review.

## RLS policies wrap current_household_id() in (select …)

- **Context**: supabase/migrations/20261008175223_household_foundation.sql:35,39 (policies households_select_own, household_members_select_own)
- **Problem**: Policies call `public.current_household_id()` directly, without `(select …)`. A SECURITY DEFINER function can't be inlined, so Postgres runs it once per row instead of once per query. On tables with one row per account it costs nothing, but the next tables (expenses, categories) will probably be copied from this migration and not from the template in plan.md.
- **Rule**: Every RLS policy that filters by household uses `household_id = (select public.current_household_id())`, never a bare function call, including on small tables, because migrations get copied.
- **Applies to**: supabase/migrations/** — every new or changed RLS policy that uses current_household_id() (or any other auth.uid()-based function)

## Wire up emailRedirectTo and a callback route for every Supabase Auth email

- **Context**: Any flow that triggers a Supabase Auth email (signUp confirmation, resetPasswordForEmail, magic link, email change) — `src/pages/api/auth/*` plus the dashboard URL Configuration.
- **Problem**: Without `emailRedirectTo`, Supabase falls back to the dashboard Site URL (default `localhost:3000`), and with PKCE the app needs a route that exchanges `?code` for a session. Signup confirmation links led nowhere even though the flow was marked "verified in production".
- **Rule**: Every call that sends an Auth email must pass `emailRedirectTo` built from the request origin, pointing at an existing route that calls `exchangeCodeForSession`, and that origin must be in the dashboard Redirect URLs allowlist. Verify by clicking the real email link, not by checking the API response.
- **Applies to**: plan, implement, impl-review
