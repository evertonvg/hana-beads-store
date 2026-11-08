begin;
select plan(25);

select has_trigger('auth', 'users', 'on_auth_user_pending_updated', 'pending-metadata trigger exists');
select has_function('public', 'apply_signup_metadata', array['uuid', 'jsonb'], 'shared signup validation exists');
select has_function('public', 'pending_user_id', array['text'], 'pending lookup exists');

-- A pending sign-up with CPF, marketing and an address (the "first comer").
insert into auth.users (id, instance_id, aud, role, email, raw_app_meta_data, raw_user_meta_data)
values (
  '00000000-0000-0000-0000-0000000000c1', '00000000-0000-0000-0000-000000000000',
  'authenticated', 'authenticated', 'pending@test.dev', '{"provider":"email","providers":["email"]}',
  '{"name":"Quem Chegou Antes","cpf":"123.456.789-09","terms_version":"t1","marketing_email":true,
    "address":{"cep":"01310-100","street":"Av. Paulista","number":"1000","district":"Bela Vista","city":"São Paulo","state":"SP"}}'
);

-- A new sign-up for the same pending e-mail (e.g. a third party's checkout) refreshes name and
-- phone, keeps the CPF and the address, and appends consents (never deletes them).
update auth.users
set raw_user_meta_data = '{"name":"Dona do E-mail","phone":"11988887777","terms_version":"t2","marketing_email":false}'
where id = '00000000-0000-0000-0000-0000000000c1';

select is((select name || '|' || phone || '|' || coalesce(cpf, '-') from public.profiles where id = '00000000-0000-0000-0000-0000000000c1'),
  'Dona do E-mail|11988887777|12345678909', 'name and phone refreshed, the CPF kept');
select is((select string_agg(type || ':' || version, ',' order by type, version) from public.consents where user_id = '00000000-0000-0000-0000-0000000000c1'),
  'email_marketing:t1,privacy:t1,privacy:t2,terms:t1,terms:t2', 'consents appended, none deleted');
select is((select count(*) from public.addresses where user_id = '00000000-0000-0000-0000-0000000000c1' and street = 'Av. Paulista'),
  1::bigint, 'the existing address is kept');

-- A different CPF and address do not replace the ones already there; absent phone keeps the old.
update auth.users
set raw_user_meta_data = '{"name":"Dona do E-mail","cpf":"529.982.247-25","terms_version":"t3",
  "address":{"cep":"01310-100","street":"Rua A","number":"1","district":"Centro","city":"São Paulo","state":"SP"}}'
where id = '00000000-0000-0000-0000-0000000000c1';
select is((select cpf || '|' || phone from public.profiles where id = '00000000-0000-0000-0000-0000000000c1'),
  '12345678909|11988887777', 'CPF not overwritten, phone kept when absent');
select is((select string_agg(street, ',') from public.addresses where user_id = '00000000-0000-0000-0000-0000000000c1'),
  'Av. Paulista', 'the new address is not added next to the existing one');
select is((select count(*) from public.consents where user_id = '00000000-0000-0000-0000-0000000000c1'),
  7::bigint, 'every sign-up''s consents are kept');

-- The same metadata written again (GoTrue adds identity keys right after the insert) records no
-- duplicate consent.
update auth.users
set raw_user_meta_data = raw_user_meta_data || '{"email_verified":false}'
where id = '00000000-0000-0000-0000-0000000000c1';
select is((select count(*) from public.consents where user_id = '00000000-0000-0000-0000-0000000000c1'),
  7::bigint, 'an already recorded consent is not appended again');

-- A pending account without CPF or address gets them from the new sign-up (nothing to keep).
insert into auth.users (id, instance_id, aud, role, email, raw_app_meta_data, raw_user_meta_data)
values (
  '00000000-0000-0000-0000-0000000000c2', '00000000-0000-0000-0000-000000000000',
  'authenticated', 'authenticated', 'pending2@test.dev', '{"provider":"email","providers":["email"]}',
  '{"name":"Sem Dados","terms_version":"t1"}'
);
update auth.users
set raw_user_meta_data = '{"name":"Sem Dados","cpf":"123","terms_version":"t2",
  "address":{"cep":"01310-100","street":"Rua B","number":"2","district":"Centro","city":"São Paulo","state":"SP"}}'
where id = '00000000-0000-0000-0000-0000000000c2';
select is((select coalesce(cpf, '-') from public.profiles where id = '00000000-0000-0000-0000-0000000000c2'),
  '-', 'invalid CPF dropped, same rules as the insert trigger');
select is((select count(*) from public.addresses where user_id = '00000000-0000-0000-0000-0000000000c2' and is_default and street = 'Rua B'),
  1::bigint, 'first address saved as default');

-- Pending lookup (service role only).
select is(public.pending_user_id(' PENDING@test.dev '), '00000000-0000-0000-0000-0000000000c1'::uuid, 'finds the pending user (trimmed, any case)');
select is(public.pending_user_id('ana@teste.dev'), null::uuid, 'a confirmed user is not pending');
select is(public.pending_user_id('nobody@test.dev'), null::uuid, 'unknown e-mail');

-- Unconfirmed accounts with a social identity are not plain e-mail sign-ups.
insert into auth.users (id, instance_id, aud, role, email, raw_app_meta_data, raw_user_meta_data)
values
  ('00000000-0000-0000-0000-0000000000d1', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
   'social@test.dev', '{"provider":"google","providers":["google"]}', '{"name":"Social"}'),
  ('00000000-0000-0000-0000-0000000000d2', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
   'mixed@test.dev', '{"provider":"email","providers":["email","google"]}', '{"name":"Misto"}');
insert into auth.identities (user_id, provider, provider_id, identity_data) values
  ('00000000-0000-0000-0000-0000000000d1', 'google', 'g-d1', '{"sub":"g-d1"}'),
  ('00000000-0000-0000-0000-0000000000d2', 'email', '00000000-0000-0000-0000-0000000000d2', '{"sub":"00000000-0000-0000-0000-0000000000d2"}'),
  ('00000000-0000-0000-0000-0000000000d2', 'google', 'g-d2', '{"sub":"g-d2"}');
select is(public.pending_user_id('social@test.dev'), null::uuid, 'OAuth-only pending account is not a pending e-mail sign-up');
select is(public.pending_user_id('mixed@test.dev'), null::uuid, 'pending account with a social identity is left out');

-- GoTrue rewrites an unconfirmed OAuth account's metadata on each login: the pending trigger must
-- leave it alone (OAuth provider, or an e-mail account that has a social identity).
insert into public.addresses (user_id, cep, street, number, district, city, state, is_default)
values ('00000000-0000-0000-0000-0000000000d1', '01310100', 'Rua Social', '5', 'Centro', 'São Paulo', 'SP', true);
update auth.users set raw_user_meta_data = '{"name":"Reescrito","terms_version":"t5"}'
where id in ('00000000-0000-0000-0000-0000000000d1', '00000000-0000-0000-0000-0000000000d2');
select is((select string_agg(name, ',' order by name) from public.profiles
  where id in ('00000000-0000-0000-0000-0000000000d1', '00000000-0000-0000-0000-0000000000d2')),
  'Misto,Social', 'unconfirmed OAuth / mixed accounts: profile untouched by metadata rewrites');
select is((select count(*) from public.consents
  where user_id in ('00000000-0000-0000-0000-0000000000d1', '00000000-0000-0000-0000-0000000000d2') and version = 't5'),
  0::bigint, 'unconfirmed OAuth / mixed accounts: no consents recorded by the rewrite');
select is((select count(*) from public.addresses where user_id = '00000000-0000-0000-0000-0000000000d1'),
  1::bigint, 'unconfirmed OAuth account: address untouched');

-- Confirmation: once confirmed, metadata changes no longer touch the profile.
update auth.users set email_confirmed_at = now() where id = '00000000-0000-0000-0000-0000000000c1';
select is(public.pending_user_id('pending@test.dev'), null::uuid, 'no longer pending after confirmation');
update auth.users
set raw_user_meta_data = '{"name":"Outra Pessoa","terms_version":"t9"}'
where id = '00000000-0000-0000-0000-0000000000c1';
select is((select name from public.profiles where id = '00000000-0000-0000-0000-0000000000c1'),
  'Dona do E-mail', 'confirmed user: profile untouched by metadata changes');
select is((select count(*) from public.consents where user_id = '00000000-0000-0000-0000-0000000000c1' and version = 't9'),
  0::bigint, 'confirmed user: consents untouched');

-- Privileges: only the service role may look up pending users.
select ok(not has_function_privilege('anon', 'public.pending_user_id(text)', 'execute'), 'anon cannot call pending_user_id');
select ok(not has_function_privilege('authenticated', 'public.pending_user_id(text)', 'execute'), 'authenticated cannot call pending_user_id');

select * from finish();
rollback;
