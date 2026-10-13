begin;
create extension if not exists pgtap with schema extensions;

select plan(38);

-- Fixture: two real signups (household + 12 default categories each).
insert into auth.users (id, email, raw_user_meta_data) values
  ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'a@example.com', '{"household_name": "Dom A"}'),
  ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 'b@example.com', '{"household_name": "Dom B"}');

-- cid / cid2: two different categories of the same household (to try a category change).
create temp table ids as
  select u.email,
         m.household_id as hid,
         (select c.id from public.categories c where c.household_id = m.household_id order by c.sort_order limit 1) as cid,
         (select c.id from public.categories c where c.household_id = m.household_id order by c.sort_order offset 1 limit 1) as cid2
  from auth.users u
  join public.household_members m on m.user_id = u.id
  where u.id in ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb');
grant select on ids to authenticated;

-- ===== As user A: set up a manual entry and one recurring definition of each kind =====
set local role authenticated;
set local request.jwt.claims = '{"sub": "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa"}';

insert into public.expenses (id, category_id, amount_minor, spent_on, description)
values ('11111111-1111-1111-1111-111111111111', (select cid from ids where email = 'a@example.com'), 1000, '2026-10-05', 'obiad');
insert into public.incomes (id, source, amount_minor, received_on)
values ('22222222-2222-2222-2222-222222222222', 'wynagrodzenie', 100000, '2026-10-01');

select lives_ok(
  $$ select public.create_recurring_expense((select cid from ids where email = 'a@example.com'), 5000, 31, 3) $$,
  'A can create a recurring expense (fixture)'
);
select lives_ok(
  $$ select public.create_recurring_income('wynagrodzenie', 200000, 31, 3) $$,
  'A can create a recurring income (fixture)'
);

-- ===== (c) Manual entries: every editable field can change =====
with upd as (update public.expenses set amount_minor = 1500, spent_on = '2026-10-06' where id = '11111111-1111-1111-1111-111111111111' returning 1)
select is((select count(*) from upd), 1::bigint, 'A can change amount and date of a manual expense');
with upd as (
  update public.expenses
  set category_id = (select cid2 from ids where email = 'a@example.com'), description = 'kolacja'
  where id = '11111111-1111-1111-1111-111111111111' returning 1
)
select is((select count(*) from upd), 1::bigint, 'A can change category and description of a manual expense');
select is(
  (select (amount_minor, spent_on, description)::text from public.expenses where id = '11111111-1111-1111-1111-111111111111'),
  '(1500,2026-10-06,kolacja)',
  'the manual expense stores the edited values'
);
with upd as (update public.incomes set amount_minor = 150000, received_on = '2026-10-02', source = 'inne' where id = '22222222-2222-2222-2222-222222222222' returning 1)
select is((select count(*) from upd), 1::bigint, 'A can change amount, date and source of a manual income');

-- ===== (b) Generated entries: only the amount =====
select lives_ok(
  $$ update public.expenses set amount_minor = 5500
     where id = (select id from public.expenses where recurring_expense_id is not null order by spent_on limit 1) $$,
  'A can change the amount of a generated expense'
);
select is(
  (select count(*) from public.expenses where recurring_expense_id is not null and amount_minor = 5500),
  1::bigint,
  'only that generated expense got the new amount'
);
select throws_ok(
  $$ update public.expenses set spent_on = spent_on + 1
     where id = (select id from public.expenses where recurring_expense_id is not null order by spent_on limit 1) $$,
  '22023', null, 'A cannot change the date of a generated expense'
);
select throws_ok(
  $$ update public.expenses set category_id = (select cid2 from ids where email = 'a@example.com')
     where id = (select id from public.expenses where recurring_expense_id is not null order by spent_on limit 1) $$,
  '22023', null, 'A cannot change the category of a generated expense'
);
select lives_ok(
  $$ update public.expenses set description = 'x'
     where id = (select id from public.expenses where recurring_expense_id is not null order by spent_on limit 1) $$,
  'A can add a description to a generated expense'
);
select lives_ok(
  $$ update public.incomes set amount_minor = 210000
     where id = (select id from public.incomes where recurring_income_id is not null order by received_on limit 1) $$,
  'A can change the amount of a generated income'
);
select throws_ok(
  $$ update public.incomes set received_on = received_on + 1
     where id = (select id from public.incomes where recurring_income_id is not null order by received_on limit 1) $$,
  '22023', null, 'A cannot change the date of a generated income'
);
select throws_ok(
  $$ update public.incomes set source = 'inne'
     where id = (select id from public.incomes where recurring_income_id is not null order by received_on limit 1) $$,
  '22023', null, 'A cannot change the source of a generated income'
);

-- ===== (d) Identity columns are locked for every entry =====
select throws_ok(
  $$ update public.expenses set recurring_expense_id = (select id from public.recurring_expenses limit 1)
     where id = '11111111-1111-1111-1111-111111111111' $$,
  '22023', null, 'a manual expense cannot be turned into a generated one'
);
select throws_ok(
  $$ update public.expenses set recurring_expense_id = null
     where id = (select id from public.expenses where recurring_expense_id is not null order by spent_on limit 1) $$,
  '22023', null, 'a generated expense cannot be detached from its definition'
);
select throws_ok(
  $$ update public.incomes set recurring_income_id = (select id from public.recurring_incomes limit 1)
     where id = '22222222-2222-2222-2222-222222222222' $$,
  '22023', null, 'a manual income cannot be turned into a generated one'
);
select throws_ok(
  $$ update public.incomes set recurring_income_id = null
     where id = (select id from public.incomes where recurring_income_id is not null order by received_on limit 1) $$,
  '22023', null, 'a generated income cannot be detached from its definition'
);
select throws_ok(
  $$ update public.expenses set household_id = (select hid from ids where email = 'b@example.com')
     where id = '11111111-1111-1111-1111-111111111111' $$,
  '22023', null, 'A cannot move an expense to household B'
);
select throws_ok(
  $$ update public.incomes set household_id = (select hid from ids where email = 'b@example.com')
     where id = '22222222-2222-2222-2222-222222222222' $$,
  '22023', null, 'A cannot move an income to household B'
);
select throws_ok(
  $$ update public.expenses set created_at = created_at - interval '1 day'
     where id = '11111111-1111-1111-1111-111111111111' $$,
  '22023', null, 'created_at of an expense cannot be changed'
);
select throws_ok(
  $$ update public.incomes set created_at = created_at - interval '1 day'
     where id = '22222222-2222-2222-2222-222222222222' $$,
  '22023', null, 'created_at of an income cannot be changed'
);

-- ===== (e) Deleting one generated entry leaves the definition and the other entries alone =====
with del as (
  delete from public.expenses
  where id = (select id from public.expenses where recurring_expense_id is not null order by spent_on limit 1)
  returning 1
)
select is((select count(*) from del), 1::bigint, 'A can delete a generated expense');
select is(
  (select count(*) from public.expenses where recurring_expense_id is not null),
  2::bigint,
  'the other generated expenses are still there'
);
select is(
  (select count(*) from public.recurring_expenses where stopped_at is null),
  1::bigint,
  'deleting a generated expense does not stop its definition'
);
with del as (
  delete from public.incomes
  where id = (select id from public.incomes where recurring_income_id is not null order by received_on limit 1)
  returning 1
)
select is((select count(*) from del), 1::bigint, 'A can delete a generated income');
select is(
  (select count(*) from public.incomes where recurring_income_id is not null),
  2::bigint,
  'the other generated incomes are still there'
);
select is(
  (select count(*) from public.recurring_incomes where stopped_at is null),
  1::bigint,
  'deleting a generated income does not stop its definition'
);

reset role;

-- ===== (a) User B: A's entries are invisible, so B changes nothing =====
set local role authenticated;
set local request.jwt.claims = '{"sub": "bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb"}';

with upd as (update public.expenses set amount_minor = 1 where id = '11111111-1111-1111-1111-111111111111' returning 1)
select is((select count(*) from upd), 0::bigint, 'B cannot UPDATE an expense of A (0 rows)');
with del as (delete from public.expenses where id = '11111111-1111-1111-1111-111111111111' returning 1)
select is((select count(*) from del), 0::bigint, 'B cannot DELETE an expense of A (0 rows)');
with upd as (update public.incomes set amount_minor = 1 where id = '22222222-2222-2222-2222-222222222222' returning 1)
select is((select count(*) from upd), 0::bigint, 'B cannot UPDATE an income of A (0 rows)');
with del as (delete from public.incomes where id = '22222222-2222-2222-2222-222222222222' returning 1)
select is((select count(*) from del), 0::bigint, 'B cannot DELETE an income of A (0 rows)');
with del as (delete from public.expenses where recurring_expense_id is not null returning 1)
select is((select count(*) from del), 0::bigint, 'B cannot DELETE generated expenses of A (0 rows)');

reset role;

-- ===== (a) User A: own manual entries can be deleted =====
set local role authenticated;
set local request.jwt.claims = '{"sub": "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa"}';

with del as (delete from public.expenses where id = '11111111-1111-1111-1111-111111111111' returning 1)
select is((select count(*) from del), 1::bigint, 'A can delete their manual expense');
with del as (delete from public.incomes where id = '22222222-2222-2222-2222-222222222222' returning 1)
select is((select count(*) from del), 1::bigint, 'A can delete their manual income');
select is((select count(*) from public.expenses where id = '11111111-1111-1111-1111-111111111111'), 0::bigint, 'the deleted expense is gone');

reset role;

-- ===== anon =====
set local role anon;

with upd as (update public.expenses set amount_minor = 1 returning 1)
select is((select count(*) from upd), 0::bigint, 'anon UPDATE on expenses matches zero rows');
with del as (delete from public.incomes returning 1)
select is((select count(*) from del), 0::bigint, 'anon DELETE on incomes matches zero rows');

reset role;

select * from finish();
rollback;
