---
change_id: household-foundation
title: Household foundation
status: archived
created: 2026-10-08
updated: 2026-10-08
archived_at: 2026-10-08T19:13:38Z
---

## Notes

<!-- Free-form notes for this change: links, ad-hoc context, decisions that don't belong in research/frame/plan. -->

### Accepted risk: Security Advisor warning on `public.current_household_id()` (2026-10-08)

Supabase Security Advisor reports **"Signed-In Users Can Execute SECURITY DEFINER Function"** for `public.current_household_id()` — any signed-in user can call it via `POST /rest/v1/rpc/current_household_id`. Left in place deliberately.

- **Why it's safe**: the function only returns the *caller's own* household id (`where user_id = auth.uid()`), which the caller can already read from `households`. No other household's data is reachable through it. `anon` and `PUBLIC` have no EXECUTE (migration `20261008200524`).
- **Why the advisor's fixes were not applied**:
  - *Revoke EXECUTE from `authenticated`* — the RLS policies on `households` / `household_members` call this function as the querying role (`authenticated`); revoking breaks every read.
  - *Switch to SECURITY INVOKER* — the function reads `household_members`, whose RLS policy calls the function again → infinite recursion.
  - *Move to a non-exposed `private` schema* — viable and Supabase's recommended fix, but renames the contract surface (`public.` → `private.current_household_id()`) for no current security gain. Deferred.
- **Revisit when**: the function starts returning anything beyond the caller's own id, a second SECURITY DEFINER helper is added to `public`, or before S-01 adds the first domain table (cheapest moment to rename — only two policies reference it today, and they follow a schema move automatically because policies bind by function OID).
