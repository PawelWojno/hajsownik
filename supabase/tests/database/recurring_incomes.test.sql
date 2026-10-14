begin;
create extension if not exists pgtap with schema extensions;

select plan(83);

-- Fixture: two real signups (household + 12 default categories each; incomes do not use the categories).
insert into auth.users (id, email, raw_user_meta_data) values
  ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'a@example.com', '{"household_name": "Dom A"}'),
  ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 'b@example.com', '{"household_name": "Dom B"}');

create temp table ids as
  select u.email,
         m.household_id as hid
  from auth.users u
  join public.household_members m on m.user_id = u.id
  where u.id in ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb');
grant select on ids to authenticated;

-- The "clock" is the database's own Warsaw today, so every date below is derived from it. Definitions are told apart
-- by day_of_month: 31 = D1 (12 months), 10 = D2, 15 = D3, 5 = D4 (lapsed).

-- ===== Pure helpers (fixed dates; the functions come from the S-04 migration) =====
select is(public.recurring_slot_date('2028-01-01', 31), '2028-01-31'::date, 'day 31 in January stays 31');
select is(public.recurring_slot_date('2027-02-01', 31), '2027-02-28'::date, 'day 31 in February is clamped to 28');
select is(public.recurring_slot_date('2028-02-01', 31), '2028-02-29'::date, 'day 31 in a leap February is clamped to 29');
select is(public.recurring_slot_date('2028-03-17', 31), '2028-03-31'::date, 'the base day is used again after a short month (no drift)');
select is(public.recurring_slot_date('2027-02-10', 30), '2027-02-28'::date, 'day 30 in February is clamped to 28');
select is(public.recurring_month_diff('2026-10-15', '2027-09-01'), 11, 'month diff counts calendar months');
select is(public.recurring_month_diff('2026-10-01', '2026-08-20'), -2, 'month diff is negative when the target is earlier');

-- ===== As user A =====
set local role authenticated;
set local request.jwt.claims = '{"sub": "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa"}';

-- validation
select throws_ok(
  $$ select public.create_recurring_income('wynagrodzenie', 1000, 10, 0) $$,
  '22023', null, 'a horizon of 0 months is rejected'
);
select throws_ok(
  $$ select public.create_recurring_income('wynagrodzenie', 1000, 10, 25) $$,
  '22023', null, 'a horizon of 25 months is rejected'
);
select throws_ok(
  $$ select public.create_recurring_income('lotto', 1000, 10, 12) $$,
  '23514', null, 'a source outside the predefined list is rejected by the check constraint'
);
select throws_ok(
  $$ select public.create_recurring_income('wynagrodzenie', 0, 10, 12) $$,
  '23514', null, 'a zero amount is rejected by the check constraint'
);

-- create D1: 12 months, day 31
select lives_ok(
  $$ select public.create_recurring_income('wynagrodzenie', 185000, 31, 12) $$,
  'A can create a recurring income'
);
select is(
  (select count(*) from public.incomes i join public.recurring_incomes r on r.id = i.recurring_income_id
   where r.day_of_month = 31),
  12::bigint,
  'create generates exactly p_months entries'
);
select is(
  (select min(i.received_on) from public.incomes i join public.recurring_incomes r on r.id = i.recurring_income_id
   where r.day_of_month = 31),
  public.recurring_slot_date(public.warsaw_today(), 31),
  'the first entry sits in the current Warsaw month on the chosen day'
);
select is(
  (select count(distinct date_trunc('month', i.received_on)) from public.incomes i
   join public.recurring_incomes r on r.id = i.recurring_income_id where r.day_of_month = 31),
  12::bigint,
  'the entries fall in 12 different months'
);
select is(
  (select count(*) from public.incomes i join public.recurring_incomes r on r.id = i.recurring_income_id
   where r.day_of_month = 31 and i.amount_minor = 185000 and i.source = 'wynagrodzenie'),
  12::bigint,
  'every generated entry carries the definition amount and source'
);
select is(
  (select count(*) from public.incomes i join public.recurring_incomes r on r.id = i.recurring_income_id
   where r.day_of_month = 31
     and i.received_on = public.recurring_slot_date(date_trunc('month', i.received_on)::date, 31)),
  12::bigint,
  'every generated entry sits on the clamped chosen day of its own month'
);
select is((select months_left from public.list_recurring_incomes() where day_of_month = 31), 11, 'D1 has 11 months left');
select is((select remind from public.list_recurring_incomes() where day_of_month = 31), false, 'D1 does not remind yet');

-- A past generated row and a future manual row, to prove what stop / amount changes leave alone
select lives_ok(
  $$ insert into public.incomes (source, amount_minor, received_on, recurring_income_id)
     values ('wynagrodzenie', 185000, public.warsaw_today() - 40,
             (select id from public.recurring_incomes where day_of_month = 31)) $$,
  'a generated entry from the past (inserted by hand) is accepted'
);
select lives_ok(
  $$ insert into public.incomes (source, amount_minor, received_on)
     values ('inne', 111, public.warsaw_today() + 60) $$,
  'a manual future entry is accepted'
);

-- update the amount of D1
select lives_ok(
  $$ select public.update_recurring_income_amount((select id from public.recurring_incomes where day_of_month = 31), 190000) $$,
  'A can change the amount of a definition'
);
select is(
  (select amount_minor from public.recurring_incomes where day_of_month = 31),
  190000::bigint,
  'the definition stores the new amount'
);
select is(
  (select count(*) from public.incomes i join public.recurring_incomes r on r.id = i.recurring_income_id
   where r.day_of_month = 31 and i.received_on > public.warsaw_today()),
  (select count(*) from generate_series(0, 11) g
   where public.recurring_slot_date((date_trunc('month', public.warsaw_today())::date + make_interval(months => g))::date, 31)
         > public.warsaw_today()),
  'after the change there is one future entry per remaining slot'
);
select is(
  (select count(*) from public.incomes i join public.recurring_incomes r on r.id = i.recurring_income_id
   where r.day_of_month = 31 and i.received_on > public.warsaw_today() and i.amount_minor = 190000),
  (select count(*) from generate_series(0, 11) g
   where public.recurring_slot_date((date_trunc('month', public.warsaw_today())::date + make_interval(months => g))::date, 31)
         > public.warsaw_today()),
  'every future entry has the new amount'
);
select is(
  (select amount_minor from public.incomes where received_on = public.warsaw_today() - 40),
  185000::bigint,
  'a generated entry dated before today keeps its old amount'
);
select is(
  (select count(*) from public.incomes i join public.recurring_incomes r on r.id = i.recurring_income_id
   where r.day_of_month = 31),
  13::bigint,
  'the number of generated entries is unchanged (12 slots + the entry added by hand)'
);
select is((select count(*) from public.incomes where amount_minor = 111), 1::bigint, 'a manual future entry is untouched by the change');

-- stop D1
select lives_ok(
  $$ select public.stop_recurring_income((select id from public.recurring_incomes where day_of_month = 31)) $$,
  'A can stop a definition'
);
select is(
  (select count(*) from public.incomes i join public.recurring_incomes r on r.id = i.recurring_income_id
   where r.day_of_month = 31 and i.received_on > public.warsaw_today()),
  0::bigint,
  'stop deletes every entry dated after today'
);
select is(
  (select count(*) from public.incomes i join public.recurring_incomes r on r.id = i.recurring_income_id
   where r.day_of_month = 31 and i.received_on <= public.warsaw_today()),
  (1 + case when public.recurring_slot_date(public.warsaw_today(), 31) <= public.warsaw_today() then 1 else 0 end)::bigint,
  'stop leaves the entries dated today or earlier'
);
select is((select count(*) from public.incomes where amount_minor = 111), 1::bigint, 'stop leaves manual entries alone');
select is(
  (select count(*) from public.list_recurring_incomes() where day_of_month = 31),
  0::bigint,
  'a stopped definition leaves the list'
);
select throws_ok(
  $$ select public.stop_recurring_income((select id from public.recurring_incomes where day_of_month = 31)) $$,
  'P0002', null, 'a stopped definition cannot be stopped again'
);
select throws_ok(
  $$ select public.update_recurring_income_amount((select id from public.recurring_incomes where day_of_month = 31), 1) $$,
  'P0002', null, 'a stopped definition cannot change its amount'
);

-- S-06: manual incomes can be edited and deleted too (the manual future entry from above is the target)
with upd as (update public.incomes set amount_minor = 112 where recurring_income_id is null and amount_minor = 111 returning 1)
select is((select count(*) from upd), 1::bigint, 'A can UPDATE a manual income (household UPDATE policy)');
with del as (delete from public.incomes where recurring_income_id is null and amount_minor = 112 returning 1)
select is((select count(*) from del), 1::bigint, 'A can DELETE a manual income (household DELETE policy)');

-- an identical active definition from the same month is a double submit; a stopped one no longer blocks
select lives_ok(
  $$ select public.create_recurring_income('wynagrodzenie', 190000, 31, 3) $$,
  'an identical definition is allowed once the earlier one is stopped'
);
select throws_ok(
  $$ select public.create_recurring_income('wynagrodzenie', 190000, 31, 3) $$,
  '23505', null, 'a second identical active definition is rejected (double submit)'
);

-- D2: two months -> reminder due; dismiss; extend
select lives_ok(
  $$ select public.create_recurring_income('wynagrodzenie', 5000, 10, 2) $$,
  'A can create a 2-month definition'
);
select is((select months_left from public.list_recurring_incomes() where day_of_month = 10), 1, 'D2 has 1 month left');
select is((select remind from public.list_recurring_incomes() where day_of_month = 10), true, 'D2 reminds');
select lives_ok(
  $$ select public.dismiss_recurring_income_reminder((select id from public.recurring_incomes where day_of_month = 10)) $$,
  'A can dismiss the reminder'
);
select is((select remind from public.list_recurring_incomes() where day_of_month = 10), false, 'a dismissed reminder is not shown');
select isnt(
  (select reminder_dismissed_at from public.recurring_incomes where day_of_month = 10),
  null,
  'the dismissal is stored on the definition'
);
select lives_ok(
  $$ select public.extend_recurring_income((select id from public.recurring_incomes where day_of_month = 10), 12) $$,
  'A can extend a definition by 12 months'
);
select is(
  (select end_month from public.recurring_incomes where day_of_month = 10),
  (date_trunc('month', public.warsaw_today())::date + make_interval(months => 13))::date,
  'extend moves end_month 12 months further'
);
select is(
  (select count(*) from public.incomes i join public.recurring_incomes r on r.id = i.recurring_income_id
   where r.day_of_month = 10),
  14::bigint,
  'extend appends exactly p_months entries after the horizon'
);
select is(
  (select reminder_dismissed_at from public.recurring_incomes where day_of_month = 10),
  null,
  'extend clears the dismissal'
);
select is((select months_left from public.list_recurring_incomes() where day_of_month = 10), 13, 'D2 has 13 months left after extending');

-- D3: the horizon may cover exactly 24 months counting the current one, not 25
select lives_ok(
  $$ select public.create_recurring_income('wynagrodzenie', 6000, 15, 1) $$,
  'A can create a 1-month definition'
);
select is((select months_left from public.list_recurring_incomes() where day_of_month = 15), 0, 'a definition ending this month has 0 months left');
select is((select remind from public.list_recurring_incomes() where day_of_month = 15), true, 'a definition ending this month reminds');
select lives_ok(
  $$ select public.extend_recurring_income((select id from public.recurring_incomes where day_of_month = 15), 23) $$,
  'extending to the limit (24 months counting the current one) is allowed'
);
select is((select months_left from public.list_recurring_incomes() where day_of_month = 15), 23, 'D3 has 23 months left (24 counting the current one)');
select throws_ok(
  $$ select public.extend_recurring_income((select id from public.recurring_incomes where day_of_month = 15), 1) $$,
  '22023', null, 'extending past 24 months counting the current one is rejected'
);
select throws_ok(
  $$ select public.extend_recurring_income((select id from public.recurring_incomes where day_of_month = 15), 0) $$,
  '22023', null, 'extending by 0 months is rejected'
);
select throws_ok(
  $$ select public.extend_recurring_income((select id from public.recurring_incomes where day_of_month = 15), 25) $$,
  '22023', null, 'extending by 25 months is rejected'
);
select is(
  (select count(*) from public.incomes i join public.recurring_incomes r on r.id = i.recurring_income_id
   where r.day_of_month = 15),
  24::bigint,
  'D3 has 1 + 23 entries and the rejected extensions added none'
);
with del as (
  delete from public.incomes
  where recurring_income_id = (select id from public.recurring_incomes where day_of_month = 15)
    and received_on = (select max(x.received_on) from public.incomes x
                       where x.recurring_income_id = (select id from public.recurring_incomes where day_of_month = 15))
  returning 1
)
select is((select count(*) from del), 1::bigint, 'A can delete a generated entry directly (household DELETE policy)');

-- D4: a lapsed definition restarts at the current month
select lives_ok(
  $$ insert into public.recurring_incomes (source, amount_minor, day_of_month, start_month, end_month)
     values ('wynagrodzenie', 7000, 5,
             (date_trunc('month', public.warsaw_today())::date - make_interval(months => 3))::date,
             (date_trunc('month', public.warsaw_today())::date - make_interval(months => 1))::date) $$,
  'a lapsed definition can exist (inserted by hand)'
);
select is((select months_left from public.list_recurring_incomes() where day_of_month = 5), -1, 'a lapsed definition has -1 months left');
select is((select remind from public.list_recurring_incomes() where day_of_month = 5), false, 'a lapsed definition does not remind');
select lives_ok(
  $$ select public.extend_recurring_income((select id from public.recurring_incomes where day_of_month = 5), 3) $$,
  'a lapsed definition can be extended'
);
select is(
  (select count(*) from public.incomes i join public.recurring_incomes r on r.id = i.recurring_income_id
   where r.day_of_month = 5),
  3::bigint,
  'extending a lapsed definition creates exactly p_months entries'
);
select is(
  (select min(i.received_on) from public.incomes i join public.recurring_incomes r on r.id = i.recurring_income_id
   where r.day_of_month = 5),
  public.recurring_slot_date(public.warsaw_today(), 5),
  'the first new entry is in the current month, nothing is created for past months'
);
select is((select months_left from public.list_recurring_incomes() where day_of_month = 5), 2, 'the extended lapsed definition has 2 months left');
select is((select remind from public.list_recurring_incomes() where day_of_month = 5), false, 'a definition ending in 2 months does not remind');

reset role;

create temp table a_def as
  select id from public.recurring_incomes
  where day_of_month = 10 and household_id = (select hid from ids where email = 'a@example.com');
grant select on a_def to authenticated;

-- ===== As user B: A's data is invisible, every operation on it fails =====
set local role authenticated;
set local request.jwt.claims = '{"sub": "bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb"}';

select is((select count(*) from public.recurring_incomes), 0::bigint, 'B sees no definitions of A');
select is_empty($$ select * from public.list_recurring_incomes() $$, 'B gets an empty list');
select throws_ok(
  $$ select public.update_recurring_income_amount((select id from a_def), 1) $$,
  'P0002', null, 'B cannot change the amount of a definition of A'
);
select throws_ok($$ select public.extend_recurring_income((select id from a_def), 1) $$, 'P0002', null, 'B cannot extend a definition of A');
select throws_ok($$ select public.stop_recurring_income((select id from a_def)) $$, 'P0002', null, 'B cannot stop a definition of A');
select throws_ok($$ select public.dismiss_recurring_income_reminder((select id from a_def)) $$, 'P0002', null, 'B cannot dismiss a reminder of A');
with del as (delete from public.incomes where recurring_income_id = (select id from a_def) returning 1)
select is((select count(*) from del), 0::bigint, 'B cannot delete generated entries of A (0 rows)');
select throws_ok(
  $$ insert into public.incomes (source, amount_minor, received_on, recurring_income_id)
     values ('wynagrodzenie', 1000, public.warsaw_today(), (select id from a_def)) $$,
  '23503', null, 'B cannot tag an entry with a definition of household A (composite FK)'
);
select throws_ok(
  $$ insert into public.recurring_incomes (household_id, source, amount_minor, day_of_month, start_month, end_month)
     values ((select hid from ids where email = 'a@example.com'), 'wynagrodzenie',
             1000, 10, '2026-10-01', '2026-10-01') $$,
  '42501', null, 'B cannot insert a definition into household A (RLS with check)'
);

reset role;

-- ===== Household deletion: the new foreign keys do not block the cascade =====
select lives_ok(
  $$ delete from public.households where id = (select hid from ids where email = 'a@example.com') $$,
  'deleting a household that has definitions and generated entries works'
);
select is(
  (select count(*) from public.recurring_incomes where household_id = (select hid from ids where email = 'a@example.com')),
  0::bigint,
  'the cascade removed the definitions'
);
select is(
  (select count(*) from public.incomes where household_id = (select hid from ids where email = 'a@example.com')),
  0::bigint,
  'the cascade removed the entries'
);

-- ===== As anon =====
set local role anon;

select throws_ok(
  $$ select public.create_recurring_income('wynagrodzenie', 1000, 10, 12) $$,
  '42501', null, 'anon cannot call create_recurring_income'
);
select throws_ok($$ select * from public.list_recurring_incomes() $$, '42501', null, 'anon cannot call list_recurring_incomes');
select throws_ok(
  $$ select public.stop_recurring_income('00000000-0000-0000-0000-000000000000') $$,
  '42501', null, 'anon cannot call stop_recurring_income'
);

reset role;

select * from finish();
rollback;
