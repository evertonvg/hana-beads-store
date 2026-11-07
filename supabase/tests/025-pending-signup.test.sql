begin;
select plan(17);

select has_trigger('auth', 'users', 'on_auth_user_pending_updated', 'pending-metadata trigger exists');
select has_function('public', 'apply_signup_metadata', array['uuid', 'jsonb'], 'shared signup validation exists');
select has_function('public', 'pending_user_id', array['text'], 'pending lookup exists');

-- A pending sign-up with CPF, marketing and an address (the "first comer").
insert into auth.users (id, instance_id, aud, role, email, raw_user_meta_data)
values (
  '00000000-0000-0000-0000-0000000000c1', '00000000-0000-0000-0000-000000000000',
  'authenticated', 'authenticated', 'pending@test.dev',
  '{"name":"Quem Chegou Antes","cpf":"123.456.789-09","terms_version":"t1","marketing_email":true,
    "address":{"cep":"01310-100","street":"Av. Paulista","number":"1000","district":"Bela Vista","city":"São Paulo","state":"SP"}}'
);

-- A new sign-up for the same pending e-mail replaces the metadata (keys absent = removed).
update auth.users
set raw_user_meta_data = '{"name":"Dona do E-mail","phone":"11988887777","terms_version":"t2","marketing_email":false}'
where id = '00000000-0000-0000-0000-0000000000c1';

select is((select name || '|' || phone || '|' || coalesce(cpf, '-') from public.profiles where id = '00000000-0000-0000-0000-0000000000c1'),
  'Dona do E-mail|11988887777|-', 'profile refreshed from the new metadata, old CPF dropped');
select is((select string_agg(type || ':' || version, ',' order by type) from public.consents where user_id = '00000000-0000-0000-0000-0000000000c1'),
  'privacy:t2,terms:t2', 'consents replaced: new versions, no marketing');
select is((select count(*) from public.addresses where user_id = '00000000-0000-0000-0000-0000000000c1'),
  0::bigint, 'the first comer''s address is gone');

-- Invalid fields in the new metadata are dropped, same rules as the insert trigger.
update auth.users
set raw_user_meta_data = '{"name":"Dona do E-mail","cpf":"123","terms_version":"t3",
  "address":{"cep":"01310-100","street":"Rua A","number":"1","district":"Centro","city":"São Paulo","state":"SP"}}'
where id = '00000000-0000-0000-0000-0000000000c1';
select is((select coalesce(cpf, '-') || '|' || coalesce(phone, '-') from public.profiles where id = '00000000-0000-0000-0000-0000000000c1'),
  '-|-', 'invalid CPF dropped, absent phone cleared');
select is((select count(*) from public.addresses where user_id = '00000000-0000-0000-0000-0000000000c1' and is_default and street = 'Rua A'),
  1::bigint, 'new address saved as default');
select is((select count(*) from public.consents where user_id = '00000000-0000-0000-0000-0000000000c1'),
  2::bigint, 'still one terms + one privacy consent');

-- Pending lookup (service role only).
select is(public.pending_user_id(' PENDING@test.dev '), '00000000-0000-0000-0000-0000000000c1'::uuid, 'finds the pending user (trimmed, any case)');
select is(public.pending_user_id('ana@teste.dev'), null::uuid, 'a confirmed user is not pending');
select is(public.pending_user_id('nobody@test.dev'), null::uuid, 'unknown e-mail');

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
