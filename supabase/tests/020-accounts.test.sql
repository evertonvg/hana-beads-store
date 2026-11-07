begin;
select plan(33);

select has_table('public', 'profiles', 'profiles exists');
select has_table('public', 'addresses', 'addresses exists');
select has_table('public', 'consents', 'consents exists');
select has_trigger('auth', 'users', 'on_auth_user_created', 'signup trigger exists');

-- Signup with full metadata.
insert into auth.users (id, instance_id, aud, role, email, raw_user_meta_data)
values (
  '00000000-0000-0000-0000-0000000000a1', '00000000-0000-0000-0000-000000000000',
  'authenticated', 'authenticated', 'a@test.dev',
  '{"name":"Ana Souza","phone":"11999990000","cpf":"123.456.789-09","terms_version":"2026-01","marketing_email":true,"marketing_version":"m1",
    "address":{"cep":"01310-100","street":"Av. Paulista","number":"1000","complement":"ap 1","district":"Bela Vista","city":"São Paulo","state":"SP"}}'
);
select is((select name || '|' || phone || '|' || cpf from public.profiles where id = '00000000-0000-0000-0000-0000000000a1'),
  'Ana Souza|11999990000|12345678909', 'profile created from metadata');
select is((select count(*) from public.consents where user_id = '00000000-0000-0000-0000-0000000000a1' and type in ('terms', 'privacy') and version = '2026-01' and granted),
  2::bigint, 'terms and privacy consents recorded');
select is((select version from public.consents where user_id = '00000000-0000-0000-0000-0000000000a1' and type = 'email_marketing'),
  'm1', 'marketing consent recorded with its version');
select is((select count(*) from public.addresses where user_id = '00000000-0000-0000-0000-0000000000a1' and is_default and cep = '01310100' and state = 'SP'),
  1::bigint, 'default address created');

-- Signup without marketing or address.
insert into auth.users (id, instance_id, aud, role, email, raw_user_meta_data)
values ('00000000-0000-0000-0000-0000000000b1', '00000000-0000-0000-0000-000000000000',
  'authenticated', 'authenticated', 'b@test.dev', '{"name":"Bia","terms_version":"2026-01","marketing_email":false}');
select is((select count(*) from public.consents where user_id = '00000000-0000-0000-0000-0000000000b1'),
  2::bigint, 'no marketing consent when not opted in');
select is((select count(*) from public.addresses where user_id = '00000000-0000-0000-0000-0000000000b1'),
  0::bigint, 'no address when absent');

-- Invalid metadata never aborts signup.
select lives_ok($$insert into auth.users (id, instance_id, aud, role, email, raw_user_meta_data)
  values ('00000000-0000-0000-0000-0000000000c1', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'c@test.dev',
  '{"name":"","phone":"123456789012345678901234","cpf":"123","terms_version":"2026-01",
    "address":{"cep":"01310100","street":"Rua","number":"1","district":"D","city":"C","state":"SPA"}}')$$,
  'invalid name/phone/cpf/address do not break signup');
select is((select name from public.profiles where id = '00000000-0000-0000-0000-0000000000c1'), '', 'empty name kept as empty string');
select ok((select phone is null and cpf is null from public.profiles where id = '00000000-0000-0000-0000-0000000000c1'), 'invalid phone and cpf dropped');
select is((select count(*) from public.addresses where user_id = '00000000-0000-0000-0000-0000000000c1'),
  0::bigint, 'address with invalid state ignored');
select lives_ok($$insert into auth.users (id, instance_id, aud, role, email)
  values ('00000000-0000-0000-0000-0000000000d1', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'd@test.dev')$$,
  'signup without any metadata works');
select is((select count(*) from public.consents where user_id = '00000000-0000-0000-0000-0000000000d1'), 0::bigint,
  'no consents without terms_version');

-- Isolation: act as B.
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000b1"}', true);
select is((select count(*) from public.profiles), 1::bigint, 'B sees only own profile');
select is((select count(*) from public.addresses), 0::bigint, 'B sees no addresses of A');
select is((select count(*) from public.consents), 2::bigint, 'B sees only own consents');
select is_empty($$with u as (update public.profiles set name = 'hack' where id = '00000000-0000-0000-0000-0000000000a1' returning 1) select * from u$$,
  'B cannot update profile of A');
select is_empty($$with u as (update public.addresses set city = 'x' where user_id = '00000000-0000-0000-0000-0000000000a1' returning 1) select * from u$$,
  'B cannot update address of A');
select throws_ok($$insert into public.consents (user_id, type, granted, version) values ('00000000-0000-0000-0000-0000000000a1', 'terms', true, 'x')$$,
  '42501', null, 'B cannot insert consent for A');
select lives_ok($$insert into public.consents (user_id, type, granted, version) values ('00000000-0000-0000-0000-0000000000b1', 'email_marketing', true, 'x')$$,
  'owner can append own consent');

-- Consents are append-only, even for the owner.
select throws_ok($$update public.consents set granted = false$$, '42501', null, 'owner cannot update consents');
select throws_ok($$delete from public.consents$$, '42501', null, 'owner cannot delete consents');

-- Admins: B is a regular user.
select is_empty($$select * from public.admins$$, 'non-admin reads no admins');
select throws_ok($$insert into public.admins (user_id) values ('00000000-0000-0000-0000-0000000000b1')$$,
  '42501', null, 'non-admin cannot self-promote');
select is((select public.is_admin()), false, 'is_admin false for regular user');

-- Seed admin.
select set_config('request.jwt.claims', '{"sub":"a0000000-0000-4000-8000-000000000001"}', true);
select is((select public.is_admin()), true, 'is_admin true for seed admin');
select ok((select count(*) > 1 from public.profiles), 'admin reads other profiles');
select is((select count(*) from public.admins), 1::bigint, 'only the seed admin exists in admins');

-- Positive proof: admin can write products (catalog tests only proved denial).
select lives_ok($$insert into public.products (slug, name, category_label) values ('admin-made', 'ADMIN MADE', 'Teste')$$,
  'admin inserts a product');
select isnt_empty($$with u as (update public.products set name = 'EDITED' where slug = 'admin-made' returning 1) select * from u$$,
  'admin updates a product');

select * from finish();
rollback;
