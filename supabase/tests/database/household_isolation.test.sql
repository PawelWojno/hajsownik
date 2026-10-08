begin;
create extension if not exists pgtap with schema extensions;

select plan(14);

-- Fixture: two real signups (exercises the on_auth_user_created trigger).
-- User A supplies a household name; user B supplies none, so the trigger falls back to 'Mój dom'.
insert into auth.users (id, email, raw_user_meta_data) values
  ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'a@example.com', '{"household_name": "Dom A"}'),
  ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 'b@example.com', '{}');

-- Capture both household ids while still the table owner: after switching to `authenticated`
-- a SELECT can no longer see the other household, so UPDATE/DELETE would have nothing to aim at.
create temp table ids as
  select u.email, m.household_id as hid
  from auth.users u
  join public.household_members m on m.user_id = u.id
  where u.id in ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb');
grant select on ids to authenticated;

-- Trigger behavior (as owner)
select is(
  (select h.name from public.households h where h.id = (select hid from ids where email = 'a@example.com')),
  'Dom A',
  'trigger uses household_name from signup metadata'
);
select is(
  (select h.name from public.households h where h.id = (select hid from ids where email = 'b@example.com')),
  'Mój dom',
  'trigger falls back to the default name when metadata has none'
);

-- ===== As user A =====
set local role authenticated;
set local request.jwt.claims = '{"sub": "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa"}';

select is((select count(*) from public.households), 1::bigint, 'A sees only their own household');
select is((select count(*) from public.household_members), 1::bigint, 'A sees only their own membership');
select is_empty(
  $$ select 1 from public.households where id = (select hid from ids where email = 'b@example.com') $$,
  'A cannot see household B'
);
select throws_ok(
  $$ insert into public.households (name) values ('hacked') $$,
  '42501',
  'new row violates row-level security policy for table "households"',
  'A cannot INSERT into households'
);
with upd as (
  update public.households set name = 'hacked'
  where id = (select hid from ids where email = 'b@example.com')
  returning 1
)
select is((select count(*) from upd), 0::bigint, 'A UPDATE on household B matches zero rows');
with del as (
  delete from public.household_members
  where household_id = (select hid from ids where email = 'b@example.com')
  returning 1
)
select is((select count(*) from del), 0::bigint, 'A DELETE on membership of B matches zero rows');

reset role;

-- ===== As user B =====
set local role authenticated;
set local request.jwt.claims = '{"sub": "bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb"}';

select is((select count(*) from public.households), 1::bigint, 'B sees only their own household');
select is((select count(*) from public.household_members), 1::bigint, 'B sees only their own membership');
select is_empty(
  $$ select 1 from public.households where id = (select hid from ids where email = 'a@example.com') $$,
  'B cannot see household A'
);
select throws_ok(
  $$ insert into public.households (name) values ('hacked') $$,
  '42501',
  'new row violates row-level security policy for table "households"',
  'B cannot INSERT into households'
);
with upd as (
  update public.households set name = 'hacked'
  where id = (select hid from ids where email = 'a@example.com')
  returning 1
)
select is((select count(*) from upd), 0::bigint, 'B UPDATE on household A matches zero rows');
with del as (
  delete from public.household_members
  where household_id = (select hid from ids where email = 'a@example.com')
  returning 1
)
select is((select count(*) from del), 0::bigint, 'B DELETE on membership of A matches zero rows');

reset role;

select * from finish();
rollback;
