begin;
select plan(20);

select has_table('public', 'products', 'products table exists');

-- Fixtures: 9 seeded products; make one unpublished (as superuser, before switching role).
update public.products set published = false where slug = 'estrela-inicial';

select tests.clear_authentication();
select is((select count(*) from public.products), 8::bigint, 'anon sees only published products');

select throws_ok(
  $$insert into public.products (slug, name, category_label) values ('x', 'X', 'X')$$,
  '42501', null, 'anon cannot insert');
select is_empty(
  $$with u as (update public.products set name = 'hack' returning 1) select * from u$$,
  'anon update touches no rows');
select is_empty(
  $$with d as (delete from public.products returning 1) select * from d$$,
  'anon delete touches no rows');

select tests.create_supabase_user('plain', 'plain@test.dev');
select tests.authenticate_as('plain');
select throws_ok(
  $$insert into public.products (slug, name, category_label) values ('y', 'Y', 'Y')$$,
  '42501', null, 'regular user cannot insert');
select is_empty(
  $$with u as (update public.products set name = 'hack' returning 1) select * from u$$,
  'regular user update touches no rows');
select is_empty(
  $$with d as (delete from public.products returning 1) select * from d$$,
  'regular user delete touches no rows');
select tests.clear_authentication();

-- Check constraints (superuser bypasses RLS, not checks).
reset role;
select throws_ok(
  $$insert into public.products (slug, name, category_label, categories) values ('c1', 'C', 'C', '{xyz}')$$,
  '23514', null, 'check rejects unknown category');
select throws_ok(
  $$insert into public.products (slug, name, category_label, colors) values ('c2', 'C', 'C', '{azul}')$$,
  '23514', null, 'check rejects unknown color');
select throws_ok(
  $$insert into public.products (slug, name, category_label, stock) values ('c3', 'C', 'C', -1)$$,
  '23514', null, 'check rejects negative stock');

-- Search RPC.
select is(
  (select count(*) from public.search_products(null, 'coracao', null, false, 'destaque', 1, 12)
    where item->>'name' ilike '%CORAÇÃO%'),
  2::bigint, 'accent-insensitive search finds both CORAÇÃO products');
select is(
  (select count(*) from public.search_products(null, '100%', null, false, 'destaque', 1, 12)),
  0::bigint, 'percent is escaped, no rows');
select is(
  (select count(*) from public.search_products(null, 'a_b', null, false, 'destaque', 1, 12)),
  0::bigint, 'underscore is escaped, no rows');
select is(
  (select count(*) from public.search_products(null, '\o', null, false, 'destaque', 1, 12)),
  0::bigint, 'backslash is escaped, no rows');
-- Ordering: priced products first (ascending), null prices last.
reset role;
update public.products set price_cents = 5000 where slug = 'garota-pixel';
update public.products set price_cents = 2500 where slug = 'estrela-numero';
select is(
  (select (item->>'priceCents')::int from public.search_products(null, null, null, false, 'menor', 1, 12) with ordinality as t(item, total, ord) order by ord limit 1),
  2500, 'menor: cheapest priced product first');
select is(
  (select item->>'priceCents' from public.search_products(null, null, null, false, 'menor', 1, 12) with ordinality as t(item, total, ord) order by ord desc limit 1),
  null::text, 'menor: null prices last');
select is(
  (select (item->>'priceCents')::int from public.search_products(null, null, null, false, 'maior', 1, 12) with ordinality as t(item, total, ord) order by ord limit 1),
  5000, 'maior: most expensive first');
select is(
  (select item->>'name' from public.search_products(null, null, null, false, 'destaque', 1, 12) with ordinality as t(item, total, ord) order by ord limit 1),
  'GAROTA PIXEL', 'destaque: featured_rank 1 first');
select is(
  (select count(*) from public.search_products(null, null, null, false, 'destaque', 99, 5)),
  4::bigint, 'page is clamped to the last page (9 rows as superuser, size 5: page 2 has 4)');

select * from finish();
rollback;
