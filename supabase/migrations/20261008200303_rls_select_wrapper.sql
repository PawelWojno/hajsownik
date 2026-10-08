-- Wrap current_household_id() in (select ...) so Postgres evaluates it once per query
-- instead of once per row (a SECURITY DEFINER function cannot be inlined).
-- See context/foundation/lessons.md — every household RLS policy follows this shape.

drop policy "households_select_own" on public.households;
create policy "households_select_own" on public.households
  for select to authenticated
  using (id = (select public.current_household_id()));

drop policy "household_members_select_own" on public.household_members;
create policy "household_members_select_own" on public.household_members
  for select to authenticated
  using (household_id = (select public.current_household_id()));
