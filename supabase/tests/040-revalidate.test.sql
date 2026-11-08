begin;
select plan(14);

select has_function('public', 'revalidate_catalog', 'revalidate_catalog() exists');
select is(
  (select count(*) from pg_trigger
    where tgrelid = 'public.products'::regclass and tgname like 'products_revalidate_%'),
  3::bigint, 'three statement-level triggers on products (insert, update, delete)');

-- Bodies of the queued requests (pg_net stores them as bytea).
create temporary view queued as
  select url, headers, convert_from(body, 'utf8')::jsonb as body from net.http_request_queue;

delete from net.http_request_queue;

-- No secrets in the Vault (local stack): nothing is queued.
update public.products set name = name where slug = 'garota-pixel';
select is((select count(*) from queued), 0::bigint, 'no Vault secrets: an UPDATE queues nothing');

select vault.create_secret('http://site.test/', 'site_url');
update public.products set name = name where slug = 'garota-pixel';
select is((select count(*) from queued), 0::bigint, 'only site_url in the Vault: still nothing');

select vault.create_secret('s3cret-s3cret-s3cret-s3cret-s3cret-00', 'revalidate_secret');

update public.products set name = name where slug = 'garota-pixel';
select is((select count(*) from queued), 1::bigint, 'with both secrets: one request per statement');
select is((select url from queued), 'http://site.test/api/revalidate', 'posts to SITE_URL/api/revalidate');
select is((select body from queued), '{"slugs": ["garota-pixel"]}'::jsonb, 'the body carries the slug');
select is(
  (select headers->>'Authorization' from queued),
  'Bearer s3cret-s3cret-s3cret-s3cret-s3cret-00', 'sends the secret as a Bearer token');

delete from net.http_request_queue;
update public.products set stock = stock where slug in ('garota-pixel', 'estrela-inicial');
select is(
  (select array(select jsonb_array_elements_text(body->'slugs') order by 1) from queued),
  array['estrela-inicial', 'garota-pixel'],
  'a multi-row UPDATE sends one request with every slug');

delete from net.http_request_queue;
update public.products set slug = 'garota-pixel-2' where slug = 'garota-pixel';
select is(
  (select array(select jsonb_array_elements_text(body->'slugs') order by 1) from queued),
  array['garota-pixel', 'garota-pixel-2'],
  'a renamed slug revalidates the old and the new page');

delete from net.http_request_queue;
insert into public.products (slug, name, category_label) values ('novo-chaveiro', 'Novo', 'Novo');
delete from public.products where slug = 'novo-chaveiro';
select is(
  (select array_agg(body->'slugs'->>0 order by body->'slugs'->>0) from queued),
  array['novo-chaveiro', 'novo-chaveiro'],
  'INSERT and DELETE each queue a request with the slug');

delete from net.http_request_queue;
insert into public.products (slug, name, category_label)
  select 'lote-' || lpad(g::text, 3, '0'), 'Lote', 'Lote' from generate_series(1, 150) g;
select is(
  (select array_agg(jsonb_array_length(body->'slugs') order by jsonb_array_length(body->'slugs') desc) from queued),
  array[100, 50],
  'over 100 slugs go in chunks of 100 (the route limit)');

-- An admin writes as `authenticated`, which cannot read the Vault: the function is SECURITY DEFINER.
delete from net.http_request_queue;
select tests.create_supabase_user('admin', 'admin@test.dev');
insert into public.admins (user_id) values (tests.get_supabase_uid('admin'));
select tests.authenticate_as('admin');
update public.products set name = name where slug = 'estrela-inicial';
select tests.clear_authentication();
reset role;
select is((select body from queued), '{"slugs": ["estrela-inicial"]}'::jsonb,
  'an admin UPDATE (authenticated role) also queues the request');

delete from net.http_request_queue;
update public.products set name = name where slug = 'nao-existe';
select is((select count(*) from queued), 0::bigint, 'a statement that touches no row queues nothing');

select * from finish();
rollback;
