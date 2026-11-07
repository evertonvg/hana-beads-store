begin;
select plan(2);

select is((select count(*) from pg_tables where schemaname = 'public' and not rowsecurity), 0::bigint, 'every public table has RLS enabled');
select is((select count(*) from information_schema.role_table_grants
  where table_schema = 'public' and privilege_type = 'TRUNCATE' and grantee in ('anon', 'authenticated')),
  0::bigint, 'no public table grants TRUNCATE to anon or authenticated');

select * from finish();
rollback;
