-- Household foundation: households + household_members, current_household_id(), signup trigger.
-- RLS is ENABLEd but deliberately not FORCEd: the SECURITY DEFINER functions below run as the table
-- owner and must keep bypassing RLS (see context/changes/household-foundation/plan.md).

create table public.households (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(name) between 1 and 100),
  created_at timestamptz not null default now()
);

create table public.household_members (
  user_id uuid primary key references auth.users (id) on delete cascade,
  household_id uuid not null references public.households (id) on delete cascade,
  created_at timestamptz not null default now()
);

create index household_members_household_id_idx on public.household_members (household_id);

create function public.current_household_id()
returns uuid
language sql
stable
security definer
set search_path = ''
as $$
  select household_id from public.household_members where user_id = auth.uid();
$$;

alter table public.households enable row level security;
alter table public.household_members enable row level security;

-- No INSERT/UPDATE/DELETE policies: writes are default-deny; only the trigger below writes.
create policy "households_select_own" on public.households
  for select to authenticated
  using (id = public.current_household_id());

create policy "household_members_select_own" on public.household_members
  for select to authenticated
  using (household_id = public.current_household_id());

create function public.handle_new_user_household()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_name text;
  v_household_id uuid;
begin
  v_name := btrim(coalesce(new.raw_user_meta_data ->> 'household_name', ''));
  if char_length(v_name) < 1 or char_length(v_name) > 100 then
    v_name := 'Mój dom';
  end if;

  insert into public.households (name) values (v_name) returning id into v_household_id;
  insert into public.household_members (user_id, household_id) values (new.id, v_household_id);

  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user_household();
