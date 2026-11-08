-- Re-sign-up of a pending account keeps what is already there (final review, backend 1/4).
-- Before: a new sign-up for an unconfirmed e-mail REPLACED the profile, consents and address, so a
-- third party (e.g. the checkout's "save my data") could wipe the pending owner's address and CPF
-- and delete consents. Now:
--   * profile: name and phone are refreshed (only when the new value is valid); the CPF is kept,
--     and only filled when there was none;
--   * address: kept; the new one is saved only when the account has no address yet;
--   * consents: appended, never deleted (a log of what each sign-up agreed to). A consent already
--     recorded (same type and version, granted, not revoked) is not added again: GoTrue rewrites
--     the metadata right after the insert (identity keys), which runs the update trigger once more.
-- For a new account (insert trigger) nothing exists yet, so the result is the same as before.
--
-- The update trigger also fired for unconfirmed OAuth accounts (GoTrue rewrites their metadata on
-- each login). It is now limited to plain e-mail accounts, with the same predicate as
-- pending_user_id: provider 'email' and no non-email identity.

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
  on conflict (id) do update set
    name = case when excluded.name <> '' then excluded.name else public.profiles.name end,
    phone = coalesce(excluded.phone, public.profiles.phone),
    cpf = coalesce(public.profiles.cpf, excluded.cpf);

  if jsonb_typeof(meta -> 'terms_version') = 'string' then
    v_terms := btrim(meta ->> 'terms_version');
    if char_length(v_terms) not between 1 and 40 then v_terms := null; end if;
  end if;

  if v_terms is not null then
    if meta -> 'marketing_email' = 'true'::jsonb then
      v_mkt_version := v_terms;
      if jsonb_typeof(meta -> 'marketing_version') = 'string'
         and char_length(btrim(meta ->> 'marketing_version')) between 1 and 40 then
        v_mkt_version := btrim(meta ->> 'marketing_version');
      end if;
    end if;

    insert into public.consents (user_id, type, granted, version)
    select p_user_id, c.type, true, c.version
    from (values ('terms', v_terms), ('privacy', v_terms), ('email_marketing', v_mkt_version)) as c (type, version)
    where c.version is not null
      and not exists (
        select 1 from public.consents x
        where x.user_id = p_user_id and x.type = c.type and x.version = c.version
          and x.granted and x.revoked_at is null
      );
  end if;

  if jsonb_typeof(v_addr) = 'object'
     and not exists (select 1 from public.addresses a where a.user_id = p_user_id) then
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

-- Update trigger: plain e-mail accounts only (a trigger WHEN cannot look at auth.identities, so the
-- identity check lives here; the provider check is also in the WHEN to skip the call early).
create or replace function public.handle_pending_user_update()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if exists (
    select 1 from auth.identities i where i.user_id = new.id and i.provider <> 'email'
  ) then
    return new;
  end if;
  perform public.apply_signup_metadata(new.id, new.raw_user_meta_data);
  return new;
end
$$;

revoke execute on function public.handle_pending_user_update() from public, anon, authenticated;

drop trigger on_auth_user_pending_updated on auth.users;
create trigger on_auth_user_pending_updated
  after update of raw_user_meta_data on auth.users
  for each row
  when (
    old.email_confirmed_at is null
    and new.email_confirmed_at is null
    and old.raw_user_meta_data is distinct from new.raw_user_meta_data
    and new.raw_app_meta_data ->> 'provider' = 'email'
    and not coalesce(new.is_anonymous, false)
  )
  execute function public.handle_pending_user_update();
