-- S-01: categories, expenses, incomes (all household-scoped), default categories, month_summary().
-- Every policy filters by (select public.current_household_id()) - see context/foundation/lessons.md.
-- Writes are insert-only for now: no UPDATE/DELETE policies, so those stay default-deny until S-06.

create table public.categories (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households (id) on delete cascade,
  name text not null check (char_length(name) between 1 and 50),
  sort_order int not null,
  created_at timestamptz not null default now(),
  unique (household_id, name),
  -- Target of the composite foreign key on expenses: Postgres requires a unique constraint on the referenced pair.
  unique (household_id, id)
);

create table public.expenses (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null default public.current_household_id() references public.households (id) on delete cascade,
  category_id uuid not null,
  amount_minor bigint not null check (amount_minor > 0 and amount_minor <= 9999999999),
  spent_on date not null,
  description text check (char_length(description) <= 200),
  created_at timestamptz not null default now(),
  -- Composite FK: the category must belong to the SAME household as the expense. A plain FK on category_id is
  -- checked without RLS, so it would accept another household's category id.
  foreign key (household_id, category_id) references public.categories (household_id, id)
);

create index expenses_household_spent_on_idx on public.expenses (household_id, spent_on);

create table public.incomes (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null default public.current_household_id() references public.households (id) on delete cascade,
  source text not null check (source in ('wynagrodzenie', 'działalność', 'świadczenia', 'wynajem', 'inne')),
  amount_minor bigint not null check (amount_minor > 0 and amount_minor <= 9999999999),
  received_on date not null,
  created_at timestamptz not null default now()
);

create index incomes_household_received_on_idx on public.incomes (household_id, received_on);

alter table public.categories enable row level security;
alter table public.expenses enable row level security;
alter table public.incomes enable row level security;

create policy "categories_select_own" on public.categories
  for select to authenticated
  using (household_id = (select public.current_household_id()));

create policy "expenses_select_own" on public.expenses
  for select to authenticated
  using (household_id = (select public.current_household_id()));

create policy "expenses_insert_own" on public.expenses
  for insert to authenticated
  with check (household_id = (select public.current_household_id()));

create policy "incomes_select_own" on public.incomes
  for select to authenticated
  using (household_id = (select public.current_household_id()));

create policy "incomes_insert_own" on public.incomes
  for insert to authenticated
  with check (household_id = (select public.current_household_id()));

-- Default categories (FR-006). sort_order encodes the default order (FR-011).
create function public.seed_default_categories(p_household_id uuid)
returns void
language sql
security definer
set search_path = ''
as $$
  insert into public.categories (household_id, name, sort_order)
  select p_household_id, t.name, t.ord
  from unnest(array[
    'Jedzenie', 'Dom i rachunki', 'Transport', 'Zdrowie', 'Higiena i uroda', 'Ubrania',
    'Rozrywka', 'Dzieci', 'Edukacja', 'Prezenty', 'Podróże', 'Inne'
  ]) with ordinality as t(name, ord);
$$;

-- Only the trigger and the backfill below call it; users must not reach it through PostgREST RPC.
revoke execute on function public.seed_default_categories(uuid) from public, anon, authenticated;

-- Same body as 20261008200802_trigger_trim_whitespace.sql, plus the seeding call.
create or replace function public.handle_new_user_household()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_name text;
  v_household_id uuid;
begin
  v_name := btrim(coalesce(new.raw_user_meta_data ->> 'household_name', ''), E' \t\n\r');
  if char_length(v_name) < 1 or char_length(v_name) > 100 then
    v_name := 'Mój dom';
  end if;

  insert into public.households (name) values (v_name) returning id into v_household_id;
  insert into public.household_members (user_id, household_id) values (new.id, v_household_id);
  perform public.seed_default_categories(v_household_id);

  return new;
end;
$$;

-- Backfill: households created before this migration (F-01 is already deployed) get the defaults too.
select public.seed_default_categories(h.id)
from public.households h
where not exists (select 1 from public.categories c where c.household_id = h.id);

-- Month totals for the caller's household. SECURITY INVOKER, so RLS on incomes/expenses does the household filtering.
-- "zostaje" = income_total - expense_total (computed by the caller).
create function public.month_summary(p_month date)
returns table (income_total bigint, expense_total bigint)
language sql
stable
security invoker
set search_path = ''
as $$
  select
    coalesce((
      select sum(i.amount_minor) from public.incomes i
      where i.received_on >= date_trunc('month', p_month)::date
        and i.received_on < (date_trunc('month', p_month) + interval '1 month')::date
    ), 0)::bigint,
    coalesce((
      select sum(e.amount_minor) from public.expenses e
      where e.spent_on >= date_trunc('month', p_month)::date
        and e.spent_on < (date_trunc('month', p_month) + interval '1 month')::date
    ), 0)::bigint;
$$;

revoke execute on function public.month_summary(date) from public, anon;
grant execute on function public.month_summary(date) to authenticated;
