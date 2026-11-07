-- Accounts: profiles, addresses, consents, admins policies and the signup trigger.

-- Profiles ------------------------------------------------------------------
create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  name text not null default '' check (char_length(name) <= 120),
  phone text check (char_length(phone) <= 20),
  cpf text check (cpf ~ '^[0-9]{11}$'),
  avatar_url text check (char_length(avatar_url) <= 500)
);
alter table public.profiles enable row level security;

create policy profiles_select on public.profiles
  for select to authenticated
  using (id = (select auth.uid()) or (select public.is_admin()));
create policy profiles_update on public.profiles
  for update to authenticated
  using (id = (select auth.uid()) or (select public.is_admin()))
  with check (id = (select auth.uid()) or (select public.is_admin()));
-- No insert/delete policies: rows are created by the signup trigger and removed by cascade.

-- Admins ---------------------------------------------------------------------
-- No write policies: rows are inserted manually or by the seed (superuser).
create policy admins_select on public.admins
  for select to authenticated
  using ((select public.is_admin()));

-- Addresses ------------------------------------------------------------------
create table public.addresses (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  label text check (char_length(label) <= 60),
  cep text not null check (cep ~ '^[0-9]{8}$'),
  street text not null check (char_length(street) between 1 and 160),
  number text not null check (char_length(number) between 1 and 20),
  complement text check (char_length(complement) <= 80),
  district text not null check (char_length(district) between 1 and 80),
  city text not null check (char_length(city) between 1 and 80),
  state text not null check (state ~ '^[A-Z]{2}$'),
  is_default boolean not null default false,
  created_at timestamptz not null default now()
);
create index addresses_user_id_idx on public.addresses (user_id);
create unique index addresses_one_default_idx on public.addresses (user_id) where is_default;
alter table public.addresses enable row level security;

create policy addresses_owner on public.addresses
  for all to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

-- Consents (append-only) -------------------------------------------------------
create table public.consents (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  type text not null check (type in ('terms', 'privacy', 'email_marketing')),
  granted boolean not null,
  version text not null check (char_length(version) between 1 and 40),
  granted_at timestamptz not null default now(),
  revoked_at timestamptz
);
create index consents_user_id_idx on public.consents (user_id);
alter table public.consents enable row level security;

create policy consents_select on public.consents
  for select to authenticated using (user_id = (select auth.uid()));
create policy consents_insert on public.consents
  for insert to authenticated with check (user_id = (select auth.uid()));
-- Append-only: no UPDATE/DELETE for any API role, not even through a policy.
revoke all on public.consents from anon, authenticated, service_role;
grant select, insert on public.consents to authenticated, service_role;

-- Timestamps are server-controlled: revocation is a new row, but it cannot be backdated.
create or replace function public.consents_force_timestamps()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.granted_at := now();
  if new.revoked_at is not null then new.revoked_at := now(); end if;
  return new;
end
$$;

create trigger consents_force_timestamps
  before insert on public.consents
  for each row execute function public.consents_force_timestamps();

-- Signup trigger -----------------------------------------------------------------
-- Reads validated fields from raw_user_meta_data. Invalid fields are dropped;
-- this function must never abort a signup.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  meta jsonb := coalesce(new.raw_user_meta_data, '{}'::jsonb);
  v_name text := '';
  v_phone text;
  v_cpf text;
  v_terms text;
  v_mkt_version text;
  v_addr jsonb := meta -> 'address';
  v_cep text;
  v_state text;
  v_label text;
  v_complement text;
begin
  if jsonb_typeof(meta -> 'name') = 'string' then
    v_name := btrim(meta ->> 'name');
    if char_length(v_name) > 120 then v_name := ''; end if;
  end if;

  if jsonb_typeof(meta -> 'phone') = 'string' then
    v_phone := btrim(meta ->> 'phone');
    if char_length(v_phone) = 0 or char_length(v_phone) > 20 then v_phone := null; end if;
  end if;

  if jsonb_typeof(meta -> 'cpf') = 'string' then
    v_cpf := regexp_replace(meta ->> 'cpf', '[^0-9]', '', 'g');
    if v_cpf !~ '^[0-9]{11}$' then v_cpf := null; end if;
  end if;

  insert into public.profiles (id, name, phone, cpf) values (new.id, v_name, v_phone, v_cpf);

  if jsonb_typeof(meta -> 'terms_version') = 'string' then
    v_terms := btrim(meta ->> 'terms_version');
    if char_length(v_terms) not between 1 and 40 then v_terms := null; end if;
  end if;

  if v_terms is not null then
    insert into public.consents (user_id, type, granted, version)
    values (new.id, 'terms', true, v_terms), (new.id, 'privacy', true, v_terms);

    if meta -> 'marketing_email' = 'true'::jsonb then
      v_mkt_version := v_terms;
      if jsonb_typeof(meta -> 'marketing_version') = 'string'
         and char_length(btrim(meta ->> 'marketing_version')) between 1 and 40 then
        v_mkt_version := btrim(meta ->> 'marketing_version');
      end if;
      insert into public.consents (user_id, type, granted, version)
      values (new.id, 'email_marketing', true, v_mkt_version);
    end if;
  end if;

  if jsonb_typeof(v_addr) = 'object' then
    begin
      if jsonb_typeof(v_addr -> 'cep') = 'string' then
        v_cep := regexp_replace(v_addr ->> 'cep', '[^0-9]', '', 'g');
      end if;
      if jsonb_typeof(v_addr -> 'state') = 'string' then
        v_state := v_addr ->> 'state';
      end if;
      -- Optional fields: an invalid one is dropped alone, the address is still saved.
      if jsonb_typeof(v_addr -> 'label') = 'string' and char_length(v_addr ->> 'label') between 1 and 60 then
        v_label := v_addr ->> 'label';
      end if;
      if jsonb_typeof(v_addr -> 'complement') = 'string' and char_length(v_addr ->> 'complement') between 1 and 80 then
        v_complement := v_addr ->> 'complement';
      end if;
      if v_cep ~ '^[0-9]{8}$' and v_state ~ '^[A-Z]{2}$'
         and jsonb_typeof(v_addr -> 'street') = 'string'
         and jsonb_typeof(v_addr -> 'number') = 'string'
         and jsonb_typeof(v_addr -> 'district') = 'string'
         and jsonb_typeof(v_addr -> 'city') = 'string' then
        insert into public.addresses (user_id, label, cep, street, number, complement, district, city, state, is_default)
        values (
          new.id,
          v_label,
          v_cep,
          v_addr ->> 'street',
          v_addr ->> 'number',
          v_complement,
          v_addr ->> 'district',
          v_addr ->> 'city',
          v_state,
          true
        );
      end if;
    exception when others then
      null; -- invalid address (length checks): ignored, signup proceeds
    end;
  end if;

  return new;
end
$$;

revoke execute on function public.handle_new_user() from public, anon, authenticated;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();
