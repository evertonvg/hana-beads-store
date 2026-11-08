-- Catalog revalidation: after any write to products, POST the changed slugs to the site's
-- /api/revalidate (pg_net, async, outside the transaction). SITE_URL and the secret live in the
-- Vault (`site_url`, `revalidate_secret`); without both (local stack) the trigger does nothing.
create extension if not exists pg_net;

create or replace function public.revalidate_catalog()
returns trigger
language plpgsql
-- Reads the Vault and queues the request even when an admin (authenticated) wrote the rows.
security definer
set search_path = ''
as $$
declare
  v_site text;
  v_secret text;
  v_slugs text[];
  v_chunk constant int := 100; -- most slugs /api/revalidate accepts per call
  i int;
begin
  select decrypted_secret into v_site from vault.decrypted_secrets where name = 'site_url';
  select decrypted_secret into v_secret from vault.decrypted_secrets where name = 'revalidate_secret';
  if coalesce(v_site, '') = '' or coalesce(v_secret, '') = '' then
    return null;
  end if;

  -- Each trigger only has its own transition tables (see the three triggers below).
  if tg_op = 'INSERT' then
    select array_agg(distinct slug order by slug) into v_slugs from new_rows;
  elsif tg_op = 'DELETE' then
    select array_agg(distinct slug order by slug) into v_slugs from old_rows;
  else
    -- Old and new slugs: a renamed product must drop its old page too.
    select array_agg(distinct slug order by slug) into v_slugs
      from (select slug from old_rows union select slug from new_rows) s;
  end if;
  if v_slugs is null then
    return null;
  end if;

  for i in 0 .. (cardinality(v_slugs) - 1) / v_chunk loop
    perform net.http_post(
      url := rtrim(v_site, '/') || '/api/revalidate',
      body := jsonb_build_object('slugs', to_jsonb(v_slugs[i * v_chunk + 1 : (i + 1) * v_chunk])),
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer ' || v_secret
      )
    );
  end loop;
  return null;
end;
$$;

revoke execute on function public.revalidate_catalog() from public, anon, authenticated;

-- Postgres forbids transition tables on a trigger with several events: one trigger per event.
create trigger products_revalidate_insert
  after insert on public.products
  referencing new table as new_rows
  for each statement execute function public.revalidate_catalog();

create trigger products_revalidate_update
  after update on public.products
  referencing old table as old_rows new table as new_rows
  for each statement execute function public.revalidate_catalog();

create trigger products_revalidate_delete
  after delete on public.products
  referencing old table as old_rows
  for each statement execute function public.revalidate_catalog();
