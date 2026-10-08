begin;
create extension if not exists pgtap with schema extensions;

select plan(29);

-- Fixture: two real signups (exercises on_auth_user_created -> households + default categories).
insert into auth.users (id, email, raw_user_meta_data) values
  ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'a@example.com', '{"household_name": "Dom A"}'),
  ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 'b@example.com', '{"household_name": "Dom B"}');

-- Captured as the table owner: household id and the first category id of each household.
create temp table ids as
  select u.email,
         m.household_id as hid,
         (select c.id from public.categories c where c.household_id = m.household_id order by c.sort_order limit 1) as cid
  from auth.users u
  join public.household_members m on m.user_id = u.id
  where u.id in ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb');
grant select on ids to authenticated;

-- ===== Default categories (as owner) =====
select is(
  (select count(*) from public.categories where household_id = (select hid from ids where email = 'a@example.com')),
  12::bigint,
  'new household gets 12 default categories'
);
select is(
  (select array_agg(name order by sort_order) from public.categories
   where household_id = (select hid from ids where email = 'a@example.com')),
  array['Jedzenie', 'Dom i rachunki', 'Transport', 'Zdrowie', 'Higiena i uroda', 'Ubrania',
        'Rozrywka', 'Dzieci', 'Edukacja', 'Prezenty', 'Podróże', 'Inne'],
  'default categories come in the agreed order'
);
select is(
  (select count(*) from public.categories where household_id = (select hid from ids where email = 'b@example.com')),
  12::bigint,
  'each household gets its own set of 12 categories'
);

-- ===== As user A =====
set local role authenticated;
set local request.jwt.claims = '{"sub": "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa"}';

select is((select count(*) from public.categories), 12::bigint, 'A sees only their own 12 categories');
select is_empty(
  $$ select 1 from public.categories where household_id = (select hid from ids where email = 'b@example.com') $$,
  'A cannot see categories of B'
);

-- household_id is omitted on purpose: it defaults to the caller's household.
select lives_ok(
  $$ insert into public.expenses (category_id, amount_minor, spent_on)
     values ((select cid from ids where email = 'a@example.com'), 1000, '2026-10-05') $$,
  'A can insert an expense (household_id defaults)'
);
select lives_ok(
  $$ insert into public.expenses (category_id, amount_minor, spent_on, description)
     values ((select cid from ids where email = 'a@example.com'), 2500, '2026-10-20', 'obiad') $$,
  'A can insert a second expense in the same month'
);
select lives_ok(
  $$ insert into public.expenses (category_id, amount_minor, spent_on)
     values ((select cid from ids where email = 'a@example.com'), 700, '2026-09-30') $$,
  'A can insert an expense in the previous month'
);
select lives_ok(
  $$ insert into public.incomes (source, amount_minor, received_on) values ('wynagrodzenie', 100000, '2026-10-01') $$,
  'A can insert an income'
);

select throws_ok(
  $$ insert into public.expenses (household_id, category_id, amount_minor, spent_on)
     values ((select hid from ids where email = 'b@example.com'),
             (select cid from ids where email = 'b@example.com'), 100, '2026-10-05') $$,
  '42501',
  null,
  'A cannot insert an expense into household B (RLS with check)'
);
select throws_ok(
  $$ insert into public.expenses (category_id, amount_minor, spent_on)
     values ((select cid from ids where email = 'b@example.com'), 100, '2026-10-05') $$,
  '23503',
  null,
  'A cannot attach an expense to a category of household B (composite foreign key)'
);
select throws_ok(
  $$ insert into public.expenses (category_id, amount_minor, spent_on)
     values ((select cid from ids where email = 'a@example.com'), 0, '2026-10-05') $$,
  '23514',
  null,
  'amount must be positive'
);
select throws_ok(
  $$ insert into public.incomes (source, amount_minor, received_on) values ('lotto', 100, '2026-10-05') $$,
  '23514',
  null,
  'income source must come from the predefined list'
);

-- A's own rows exist, so 0 affected rows proves default-deny (no UPDATE/DELETE policy), not invisibility.
with upd as (update public.expenses set amount_minor = 1 returning 1)
select is((select count(*) from upd), 0::bigint, 'A UPDATE on own expenses matches zero rows (default-deny)');
with del as (delete from public.expenses returning 1)
select is((select count(*) from del), 0::bigint, 'A DELETE on own expenses matches zero rows (default-deny)');

select is((select count(*) from public.expenses), 3::bigint, 'A sees exactly their 3 expenses');

select is(
  (select (income_total, expense_total)::text from public.month_summary('2026-10-15')),
  '(100000,3500)',
  'month_summary sums income and expenses of the month'
);
select is(
  (select (income_total, expense_total)::text from public.month_summary('2026-09-01')),
  '(0,700)',
  'month_summary excludes entries from other months'
);
select is(
  (select (income_total, expense_total)::text from public.month_summary('2026-08-01')),
  '(0,0)',
  'month_summary returns 0/0 for an empty month'
);

select throws_ok(
  $$ select public.seed_default_categories((select hid from ids where email = 'a@example.com')) $$,
  '42501',
  null,
  'authenticated cannot call seed_default_categories'
);

reset role;

-- ===== As user B =====
set local role authenticated;
set local request.jwt.claims = '{"sub": "bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb"}';

select is((select count(*) from public.categories), 12::bigint, 'B sees only their own 12 categories');
select lives_ok(
  $$ insert into public.expenses (category_id, amount_minor, spent_on)
     values ((select cid from ids where email = 'b@example.com'), 99999, '2026-10-07') $$,
  'B can insert an expense'
);
select is((select count(*) from public.expenses), 1::bigint, 'B sees only their own expense');
select is_empty($$ select 1 from public.incomes $$, 'B cannot see the income of A');
select is(
  (select (income_total, expense_total)::text from public.month_summary('2026-10-15')),
  '(0,99999)',
  'month_summary of B does not include the entries of A'
);

reset role;

-- ===== As anon (no session) =====
set local role anon;

select is((select count(*) from public.categories), 0::bigint, 'anon sees no categories');
select is((select count(*) from public.expenses), 0::bigint, 'anon sees no expenses');
select is((select count(*) from public.incomes), 0::bigint, 'anon sees no incomes');
select throws_ok(
  $$ select * from public.month_summary('2026-10-15') $$,
  '42501',
  null,
  'anon cannot call month_summary'
);

reset role;

select * from finish();
rollback;
