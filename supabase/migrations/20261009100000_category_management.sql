-- S-02: category management (add / rename / archive / reorder / delete), household-scoped through RLS.
-- Every policy filters by (select public.current_household_id()) - see context/foundation/lessons.md.
-- Deleting a category that has expenses is stopped by the composite foreign key on expenses (23503), not by a policy.

alter table public.categories add column archived_at timestamptz null;
alter table public.categories alter column household_id set default public.current_household_id();

-- Policies allow writing straight through PostgREST (bypassing zod), so the trim rule lives in the database too.
alter table public.categories add constraint categories_name_trimmed check (name = btrim(name));

-- Names are unique per household regardless of letter case. An archived category keeps its name in the index,
-- so restoring it can never collide with a newer category.
alter table public.categories drop constraint categories_household_id_name_key;
create unique index categories_household_lower_name_idx on public.categories (household_id, lower(name));

create policy "categories_insert_own" on public.categories
  for insert to authenticated
  with check (household_id = (select public.current_household_id()));

create policy "categories_update_own" on public.categories
  for update to authenticated
  using (household_id = (select public.current_household_id()))
  with check (household_id = (select public.current_household_id()));

create policy "categories_delete_own" on public.categories
  for delete to authenticated
  using (household_id = (select public.current_household_id()));

-- Appends a category at the end of the caller's list. SECURITY INVOKER: household_id defaults to the caller's
-- household and RLS (insert policy + select policy for the max) scopes everything else.
create function public.add_category(p_name text)
returns uuid
language sql
security invoker
set search_path = ''
as $$
  insert into public.categories (name, sort_order)
  values (p_name, (select coalesce(max(c.sort_order), 0) + 1 from public.categories c))
  returning id;
$$;

-- Rewrites sort_order by position in p_ids. p_ids must be exactly the set of categories visible to the caller
-- (active and archived), otherwise sort_order would get gaps or duplicates.
create function public.reorder_categories(p_ids uuid[])
returns void
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_total int;
begin
  select count(*) into v_total from public.categories;

  if coalesce(cardinality(p_ids), 0) <> v_total
     or (select count(distinct t.id) from unnest(p_ids) as t(id)) <> v_total
     or exists (
       select 1 from unnest(p_ids) as t(id)
       where not exists (select 1 from public.categories c where c.id = t.id)
     )
  then
    raise exception 'p_ids must list every category exactly once' using errcode = '22023';
  end if;

  update public.categories c
  set sort_order = t.ord
  from unnest(p_ids) with ordinality as t(id, ord)
  where c.id = t.id;
end;
$$;

revoke execute on function public.add_category(text) from public, anon;
grant execute on function public.add_category(text) to authenticated;
revoke execute on function public.reorder_categories(uuid[]) from public, anon;
grant execute on function public.reorder_categories(uuid[]) to authenticated;
