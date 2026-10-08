-- btrim() without a character list strips only spaces; strip tabs/newlines too, so a whitespace-only
-- household_name (possible via a direct GoTrue call, bypassing the API's zod .trim()) falls back to the default.
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

  return new;
end;
$$;
