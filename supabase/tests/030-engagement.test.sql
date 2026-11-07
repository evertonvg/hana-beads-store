begin;
select plan(31);

select has_table('public', 'favorites', 'favorites exists');
select has_table('public', 'stock_alerts', 'stock_alerts exists');
select has_table('public', 'newsletter_subscriptions', 'newsletter_subscriptions exists');
select has_table('public', 'saved_carts', 'saved_carts exists');
select has_table('public', 'rate_limits', 'rate_limits exists');

create temp table t_product as select id from public.products where published limit 1;
grant select on t_product to anon, authenticated;

select tests.create_supabase_user('fa', 'fa@test.dev');
select tests.create_supabase_user('fb', 'fb@test.dev');

-- Newsletter
select is(public.subscribe_newsletter(' Ana@Teste.dev ', 'v1'), 'ok', 'newsletter: first subscribe ok');
select is(public.subscribe_newsletter('ana@teste.dev', 'v1'), 'already', 'newsletter: repeat is already');
select throws_ok($$select public.subscribe_newsletter('not-an-email', 'v1')$$, '22023', 'invalid_email', 'newsletter: invalid email rejected');
select is((select email from public.newsletter_subscriptions), 'ana@teste.dev', 'newsletter: email normalized');

set local role anon;
select throws_ok($$select * from public.newsletter_subscriptions$$, '42501', null, 'anon cannot read newsletter_subscriptions');
select is(public.subscribe_newsletter('x@y.dev', 'v1'), 'ok', 'anon can subscribe via RPC');

-- Stock alerts as anon
select lives_ok($$select public.request_stock_alert('Zed@Test.dev', (select id from t_product), now())$$, 'anon requests stock alert');
select lives_ok($$select public.request_stock_alert('zed@test.dev', (select id from t_product), now())$$, 'repeat alert is a no-op');
select throws_ok($$select public.request_stock_alert('zed@test.dev', gen_random_uuid(), now())$$, '22023', 'product_not_found', 'unknown product rejected');
reset role;
select is((select count(*) from public.stock_alerts where email = 'zed@test.dev' and user_id is null), 1::bigint, 'anon alert stored once with null user');

-- Stock alert as authenticated
select tests.authenticate_as('fa');
select public.request_stock_alert('fa@test.dev', (select id from t_product), now());
select is((select count(*) from public.stock_alerts), 1::bigint, 'authenticated reads only own alerts');
select is((select user_id from public.stock_alerts), tests.get_supabase_uid('fa'), 'alert stores auth.uid()');

-- Favorites
select is(public.toggle_favorite((select id from t_product)), true, 'toggle on');
select is((select count(*) from public.favorites), 1::bigint, 'favorite visible to owner');
select tests.clear_authentication();
select tests.authenticate_as('fb');
select is((select count(*) from public.favorites), 0::bigint, 'B cannot see A favorites');
select is(public.toggle_favorite((select id from t_product)), true, 'B toggles on independently');
select is(public.toggle_favorite((select id from t_product)), false, 'toggle off');
select tests.clear_authentication();

-- Saved carts
select tests.authenticate_as('fa');
select lives_ok($$insert into public.saved_carts (user_id, data) values (tests.get_supabase_uid('fa'), '{"lines":[]}')$$, 'saved cart accepts empty');
select throws_ok(
  format($f$update public.saved_carts set data = %L$f$,
    jsonb_build_object('lines', (select jsonb_agg(jsonb_build_object('productId', 'p', 'ring', 'r', 'qty', 1)) from generate_series(1, 51)))::text),
  '23514', null, 'saved cart rejects 51 lines');
select throws_ok($$insert into public.saved_carts (user_id, data) values (tests.get_supabase_uid('fa'), '{"junk":1}')$$, '23514', null, 'saved cart without lines key rejected');
select throws_ok(format($f$update public.saved_carts set data = %L$f$, jsonb_build_object('lines', '[]'::jsonb, 'pad', repeat('x', 70000))::text), '23514', null, 'saved cart over 64 KB rejected');
select tests.clear_authentication();

-- Privileges
select table_privs_are('public', 'newsletter_subscriptions', 'anon', array[]::text[], 'newsletter: anon no privileges');
select table_privs_are('public', 'rate_limits', 'authenticated', array[]::text[], 'rate_limits: authenticated no privileges');

-- Rate limits
set local role service_role;
select is(array[public.rate_limit_hit('k', 2, 60), public.rate_limit_hit('k', 2, 60), public.rate_limit_hit('k', 2, 60)],
  array[true, true, false], 'rate limit: true, true, false');
reset role;
set local role anon;
select throws_ok($$select public.rate_limit_hit('k', 2, 60)$$, '42501', null, 'anon cannot run rate_limit_hit');
reset role;
set local role authenticated;
select throws_ok($$select public.rate_limit_hit('k', 2, 60)$$, '42501', null, 'authenticated cannot run rate_limit_hit');
reset role;

select * from finish();
rollback;
