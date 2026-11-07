-- Engagement: favorites, stock alerts, newsletter, saved carts, rate limits.

-- Favorites ------------------------------------------------------------------
create table public.favorites (
  user_id uuid not null references auth.users (id) on delete cascade,
  product_id uuid not null references public.products (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, product_id)
);
alter table public.favorites enable row level security;
create policy favorites_owner on public.favorites
  for all to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

-- Stock alerts ---------------------------------------------------------------
create table public.stock_alerts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users (id) on delete set null,
  email text not null check (char_length(email) <= 254 and email ~ '^[^@\s]+@[^@\s]+\.[^@\s]+$'),
  product_id uuid not null references public.products (id) on delete cascade,
  consented_at timestamptz not null,
  notified_at timestamptz
);
create unique index stock_alerts_pending_idx on public.stock_alerts (email, product_id) where notified_at is null;
create index stock_alerts_user_id_idx on public.stock_alerts (user_id);
create index stock_alerts_product_id_idx on public.stock_alerts (product_id);
alter table public.stock_alerts enable row level security;
create policy stock_alerts_select on public.stock_alerts
  for select to authenticated using (user_id = (select auth.uid()));
-- Inserts only through request_stock_alert().
revoke all on public.stock_alerts from anon, authenticated;
grant select on public.stock_alerts to authenticated;

-- Newsletter -----------------------------------------------------------------
create table public.newsletter_subscriptions (
  email text primary key check (char_length(email) <= 254 and email = lower(email)),
  consent_version text not null check (char_length(consent_version) between 1 and 40),
  consented_at timestamptz not null default now()
);
alter table public.newsletter_subscriptions enable row level security;
revoke all on public.newsletter_subscriptions from anon, authenticated;

-- Saved carts ----------------------------------------------------------------
create table public.saved_carts (
  user_id uuid primary key references auth.users (id) on delete cascade,
  data jsonb not null check (
    jsonb_typeof(data -> 'lines') = 'array' and jsonb_array_length(data -> 'lines') <= 50
  ),
  updated_at timestamptz not null default now()
);
alter table public.saved_carts enable row level security;
create policy saved_carts_owner on public.saved_carts
  for all to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

-- Rate limits ----------------------------------------------------------------
create table public.rate_limits (
  key text not null check (char_length(key) <= 200),
  window_start timestamptz not null,
  count int not null default 0,
  primary key (key, window_start)
);
alter table public.rate_limits enable row level security;
revoke all on public.rate_limits from anon, authenticated;

-- RPCs -------------------------------------------------------------------------
create or replace function public.subscribe_newsletter(p_email text, p_consent_version text)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_email text := lower(btrim(coalesce(p_email, '')));
  v_version text := btrim(coalesce(p_consent_version, ''));
  v_rows int;
begin
  if char_length(v_email) > 254 or v_email !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' then
    raise exception 'invalid_email' using errcode = '22023';
  end if;
  if char_length(v_version) not between 1 and 40 then
    raise exception 'invalid_consent_version' using errcode = '22023';
  end if;
  insert into public.newsletter_subscriptions (email, consent_version)
  values (v_email, v_version)
  on conflict (email) do nothing;
  get diagnostics v_rows = row_count;
  return case when v_rows = 1 then 'ok' else 'already' end;
end
$$;
revoke execute on function public.subscribe_newsletter(text, text) from public;
grant execute on function public.subscribe_newsletter(text, text) to anon, authenticated, service_role;

create or replace function public.request_stock_alert(p_email text, p_product_id uuid, p_consented_at timestamptz)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_email text := lower(btrim(coalesce(p_email, '')));
begin
  if char_length(v_email) > 254 or v_email !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' then
    raise exception 'invalid_email' using errcode = '22023';
  end if;
  if p_consented_at is null then
    raise exception 'consent_required' using errcode = '22023';
  end if;
  if not exists (select 1 from public.products where id = p_product_id and published) then
    raise exception 'product_not_found' using errcode = '22023';
  end if;
  insert into public.stock_alerts (user_id, email, product_id, consented_at)
  values ((select auth.uid()), v_email, p_product_id, p_consented_at)
  on conflict (email, product_id) where notified_at is null do nothing;
end
$$;
revoke execute on function public.request_stock_alert(text, uuid, timestamptz) from public;
grant execute on function public.request_stock_alert(text, uuid, timestamptz) to anon, authenticated, service_role;

-- Security invoker: the favorites RLS policy enforces ownership.
create or replace function public.toggle_favorite(p_product_id uuid)
returns boolean
language plpgsql
set search_path = ''
as $$
declare
  v_uid uuid := (select auth.uid());
begin
  if v_uid is null then
    raise exception 'not_authenticated' using errcode = '28000';
  end if;
  delete from public.favorites where user_id = v_uid and product_id = p_product_id;
  if found then
    return false;
  end if;
  insert into public.favorites (user_id, product_id) values (v_uid, p_product_id);
  return true;
end
$$;
revoke execute on function public.toggle_favorite(uuid) from public, anon;
grant execute on function public.toggle_favorite(uuid) to authenticated, service_role;

create or replace function public.rate_limit_hit(p_key text, p_max int, p_window_seconds int)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_window timestamptz;
  v_count int;
begin
  if p_window_seconds <= 0 then
    raise exception 'invalid_window' using errcode = '22023';
  end if;
  v_window := to_timestamp(floor(extract(epoch from now()) / p_window_seconds) * p_window_seconds);
  insert into public.rate_limits as r (key, window_start, count)
  values (p_key, v_window, 1)
  on conflict (key, window_start) do update set count = r.count + 1
  returning r.count into v_count;
  return v_count <= p_max;
end
$$;
revoke execute on function public.rate_limit_hit(text, int, int) from public, anon, authenticated;
grant execute on function public.rate_limit_hit(text, int, int) to service_role;

-- Hardening: Supabase grants ALL on public tables to API roles and RLS does not cover TRUNCATE.
revoke truncate, references, trigger on all tables in schema public from anon, authenticated;
alter default privileges in schema public revoke truncate, references, trigger on tables from anon, authenticated;
