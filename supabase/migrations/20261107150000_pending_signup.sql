-- Pending sign-ups: a new sign-up for an e-mail whose account was never confirmed replaces the
-- sign-up data (this migration) and flags the account (app_metadata.resignup, set by the app through
-- the Auth admin API) so that confirming it replaces the password with a random one: neither the
-- first comer's password nor the latest one survives. GoTrue itself only re-sends the confirmation
-- e-mail and keeps the first comer's password and metadata (account pre-hijack).

-- Shared validation -----------------------------------------------------------------
-- Same rules handle_new_user had: reads validated fields from the metadata, drops invalid ones and
-- never raises. Replaces (not merges) the profile, consents and address of the user, which is only
-- correct while the account is unconfirmed: nobody has agreed to anything yet.
create or replace function public.apply_signup_metadata(p_user_id uuid, p_meta jsonb)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  meta jsonb := coalesce(p_meta, '{}'::jsonb);
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

  insert into public.profiles (id, name, phone, cpf) values (p_user_id, v_name, v_phone, v_cpf)
  on conflict (id) do update set name = excluded.name, phone = excluded.phone, cpf = excluded.cpf;

  delete from public.consents where user_id = p_user_id;
  delete from public.addresses where user_id = p_user_id;

  if jsonb_typeof(meta -> 'terms_version') = 'string' then
    v_terms := btrim(meta ->> 'terms_version');
    if char_length(v_terms) not between 1 and 40 then v_terms := null; end if;
  end if;

  if v_terms is not null then
    insert into public.consents (user_id, type, granted, version)
    values (p_user_id, 'terms', true, v_terms), (p_user_id, 'privacy', true, v_terms);

    if meta -> 'marketing_email' = 'true'::jsonb then
      v_mkt_version := v_terms;
      if jsonb_typeof(meta -> 'marketing_version') = 'string'
         and char_length(btrim(meta ->> 'marketing_version')) between 1 and 40 then
        v_mkt_version := btrim(meta ->> 'marketing_version');
      end if;
      insert into public.consents (user_id, type, granted, version)
      values (p_user_id, 'email_marketing', true, v_mkt_version);
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
          p_user_id,
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
end
$$;

revoke execute on function public.apply_signup_metadata(uuid, jsonb) from public, anon, authenticated, service_role;

-- Insert trigger: same behaviour as before, now through the shared function.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform public.apply_signup_metadata(new.id, new.raw_user_meta_data);
  return new;
end
$$;

-- Update trigger: only while the account is (and stays) unconfirmed.
create or replace function public.handle_pending_user_update()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform public.apply_signup_metadata(new.id, new.raw_user_meta_data);
  return new;
end
$$;

revoke execute on function public.handle_pending_user_update() from public, anon, authenticated;

create trigger on_auth_user_pending_updated
  after update of raw_user_meta_data on auth.users
  for each row
  when (
    old.email_confirmed_at is null
    and new.email_confirmed_at is null
    and old.raw_user_meta_data is distinct from new.raw_user_meta_data
  )
  execute function public.handle_pending_user_update();

-- Pending lookup ----------------------------------------------------------------------
-- The id of the unconfirmed e-mail/password account for an e-mail (null when none). Accounts with
-- any social identity are left out. Server only (secret key).
create or replace function public.pending_user_id(p_email text)
returns uuid
language sql
stable
security definer
set search_path = ''
as $$
  select u.id from auth.users u
  where u.email = lower(btrim(p_email))
    and u.email_confirmed_at is null
    and u.deleted_at is null
    and not u.is_anonymous
    and u.raw_app_meta_data ->> 'provider' = 'email'
    and not exists (
      select 1 from auth.identities i where i.user_id = u.id and i.provider <> 'email'
    )
  limit 1
$$;

revoke execute on function public.pending_user_id(text) from public, anon, authenticated;
grant execute on function public.pending_user_id(text) to service_role;
