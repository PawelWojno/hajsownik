begin;
create extension if not exists pgtap with schema extensions;

select plan(29);

-- Fixture: two real signups (household + 12 default categories each).
insert into auth.users (id, email, raw_user_meta_data) values
  ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'a@example.com', '{"household_name": "Dom A"}'),
  ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 'b@example.com', '{"household_name": "Dom B"}');

create temp table ids as
  select u.email,
         m.household_id as hid,
         (select c.id from public.categories c where c.household_id = m.household_id order by c.sort_order limit 1) as cid
  from auth.users u
  join public.household_members m on m.user_id = u.id
  where u.id in ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb');
grant select on ids to authenticated;

-- ===== As user A =====
set local role authenticated;
set local request.jwt.claims = '{"sub": "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa"}';

-- add
select lives_ok($$ select public.add_category('Zwierzęta') $$, 'A can add a category');
select is(
  (select sort_order from public.categories where name = 'Zwierzęta'),
  13,
  'add_category appends at the end of the list'
);
select throws_ok(
  $$ select public.add_category('zwierzęta') $$,
  '23505',
  null,
  'category names are unique regardless of letter case'
);
select throws_ok(
  $$ insert into public.categories (name, sort_order) values (' Pies', 99) $$,
  '23514',
  null,
  'a name with a surrounding space is rejected by the database'
);

-- rename
select lives_ok($$ update public.categories set name = 'Pupil' where name = 'Zwierzęta' $$, 'A can rename a category');
select is((select count(*) from public.categories where name = 'Pupil'), 1::bigint, 'the new name is stored');

-- archive / restore: the saved sort_order survives
select lives_ok($$ update public.categories set archived_at = now() where name = 'Pupil' $$, 'A can archive a category');
select isnt((select archived_at from public.categories where name = 'Pupil'), null, 'archived_at is set');
select lives_ok($$ update public.categories set archived_at = null where name = 'Pupil' $$, 'A can restore a category');
select is(
  (select sort_order from public.categories where name = 'Pupil' and archived_at is null),
  13,
  'a restored category returns to its saved sort_order'
);

-- isolation: B's rows are invisible, so every write against them matches nothing or violates the check
with upd as (update public.categories set name = 'Zhakowana'
             where household_id = (select hid from ids where email = 'b@example.com') returning 1)
select is((select count(*) from upd), 0::bigint, 'A cannot rename categories of B (0 rows)');
with del as (delete from public.categories
             where household_id = (select hid from ids where email = 'b@example.com') returning 1)
select is((select count(*) from del), 0::bigint, 'A cannot delete categories of B (0 rows)');
select throws_ok(
  $$ insert into public.categories (household_id, name, sort_order)
     values ((select hid from ids where email = 'b@example.com'), 'Obca', 99) $$,
  '42501',
  null,
  'A cannot insert a category into household B (RLS with check)'
);
-- Guarded twice: the WITH CHECK of the update policy and the SELECT policy, which Postgres also applies to the new
-- row of an UPDATE. Weakening only one of them leaves this test green.
select throws_ok(
  $$ update public.categories set household_id = (select hid from ids where email = 'b@example.com')
     where name = 'Pupil' $$,
  '42501',
  null,
  'A cannot move a category to household B (RLS with check)'
);

-- delete: a category with expenses is protected by the composite foreign key
select lives_ok(
  $$ insert into public.expenses (category_id, amount_minor, spent_on)
     values ((select cid from ids where email = 'a@example.com'), 1000, '2026-10-05') $$,
  'A can insert an expense into the first category'
);
select throws_ok(
  $$ delete from public.categories where id = (select cid from ids where email = 'a@example.com') $$,
  '23503',
  null,
  'a category with expenses cannot be deleted'
);
select lives_ok($$ update public.categories set archived_at = now() where name = 'Pupil' $$, 'A archives an unused category');
with del as (delete from public.categories where name = 'Pupil' returning 1)
select is((select count(*) from del), 1::bigint, 'an unused archived category can be deleted');

-- reorder: now exactly 12 categories again
select lives_ok(
  $$ select public.reorder_categories((select array_agg(id order by sort_order desc) from public.categories)) $$,
  'A can reorder all categories'
);
select is(
  (select sort_order from public.categories where name = 'Inne'),
  1,
  'the last category became the first after reversing'
);

-- archived categories are numbered after the active ones; restoring after a reorder lands at the end
update public.categories set archived_at = now() where name = 'Transport';
select public.reorder_categories((
  select array_agg(id order by (name = 'Transport'), sort_order) from public.categories
));
select is(
  (select sort_order from public.categories where name = 'Transport'),
  12,
  'an archived category is numbered after the active ones'
);
update public.categories set archived_at = null where name = 'Transport';
select is(
  (select sort_order from public.categories where name = 'Transport'),
  (select max(sort_order) from public.categories),
  'restored after a reorder, the category sits at the end of the list'
);

select throws_ok(
  $$ select public.reorder_categories((select array_agg(id) from (select id from public.categories limit 5) s)) $$,
  '22023',
  null,
  'reorder rejects a partial list'
);
select throws_ok(
  $$ select public.reorder_categories(
       (select array_agg(id) from (select id from public.categories limit 11) s) ||
       (select id from public.categories limit 1)
     ) $$,
  '22023',
  null,
  'reorder rejects a list with a duplicate'
);
select throws_ok(
  $$ select public.reorder_categories(
       (select array_agg(id) from (select id from public.categories limit 11) s) ||
       (select cid from ids where email = 'b@example.com')
     ) $$,
  '22023',
  null,
  'reorder rejects a category of another household'
);

reset role;

-- ===== As user B: untouched by A =====
set local role authenticated;
set local request.jwt.claims = '{"sub": "bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb"}';

select is(
  (select array_agg(name order by sort_order) from public.categories),
  array['Jedzenie', 'Dom i rachunki', 'Transport', 'Zdrowie', 'Higiena i uroda', 'Ubrania',
        'Rozrywka', 'Dzieci', 'Edukacja', 'Prezenty', 'Podróże', 'Inne'],
  'B still has the 12 default categories in the default order'
);
select is(
  (select count(*) from public.categories where archived_at is not null),
  0::bigint,
  'B has no archived categories'
);

reset role;

-- ===== As anon =====
set local role anon;

select throws_ok($$ select public.add_category('X') $$, '42501', null, 'anon cannot call add_category');
select throws_ok(
  $$ select public.reorder_categories(array[]::uuid[]) $$,
  '42501',
  null,
  'anon cannot call reorder_categories'
);

reset role;

select * from finish();
rollback;
