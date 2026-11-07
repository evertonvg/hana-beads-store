-- Catalog: products, admin check, accent-insensitive search RPC.

create extension if not exists unaccent with schema extensions;

-- unaccent() is only STABLE; a pinned dictionary + fixed search_path makes this safe as IMMUTABLE
-- so it can back a generated column and an index.
create or replace function public.immutable_unaccent(text)
returns text
language sql
immutable
parallel safe
strict
set search_path = ''
as $$
  select extensions.unaccent('extensions.unaccent'::regdictionary, $1)
$$;

-- Escapes LIKE wildcards so user input is matched literally.
create or replace function public.escape_like(text)
returns text
language sql
immutable
parallel safe
strict
set search_path = ''
as $$
  select replace(replace(replace($1, '\', '\'), '%', '\%'), '_', '\_')
$$;

create or replace function public.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end
$$;

-- Admins. Policies and tests arrive with the auth migration; RLS is on from the start.
create table public.admins (
  user_id uuid primary key references auth.users (id) on delete cascade
);
alter table public.admins enable row level security;

create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (select 1 from public.admins where user_id = (select auth.uid()))
$$;

create table public.products (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  name text not null,
  description text not null default '',
  price_cents integer check (price_cents is null or price_cents >= 0),
  rarity text check (rarity in ('comum', 'raro', 'epico')),
  is_new boolean not null default false,
  stock integer not null default 0 check (stock >= 0),
  categories text[] not null default '{}'
    check (categories <@ array['personagens', 'estrelas', 'iniciais', 'bichinhos', 'icones']::text[]),
  category_label text not null,
  colors text[] not null default '{}'
    check (colors <@ array['rosa', 'vermelho', 'roxo', 'laranja', 'verde', 'preto']::text[]),
  images jsonb not null default '[]',
  art jsonb,
  illustrative boolean not null default false,
  size_cm numeric,
  bead_count integer,
  -- Same shape as Product.options: [{ "type": "argola", "value": "...", "priceDeltaCents": 0 }]
  options jsonb not null default '[]',
  featured_rank integer unique,
  published boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  search tsvector generated always as (
    to_tsvector('simple', public.immutable_unaccent(name || ' ' || category_label))
  ) stored
);

create index products_search_idx on public.products using gin (search);
create index products_created_idx on public.products (created_at, id);

create trigger products_set_updated_at
  before update on public.products
  for each row execute function public.set_updated_at();

alter table public.products enable row level security;

create policy products_select on public.products
  for select using (published);
create policy products_insert on public.products
  for insert to authenticated with check ((select public.is_admin()));
create policy products_update on public.products
  for update to authenticated using ((select public.is_admin())) with check ((select public.is_admin()));
create policy products_delete on public.products
  for delete to authenticated using ((select public.is_admin()));

-- Mirrors filterProducts (lib/shop-query.ts) + the mock catalog's page clamping.
-- SECURITY INVOKER (default): RLS decides which rows are visible.
create or replace function public.search_products(
  p_categoria text,
  p_q text,
  p_cores text[],
  p_disponivel boolean,
  p_ordem text,
  p_pagina int,
  p_page_size int
)
returns table (item jsonb, total bigint)
language sql
stable
set search_path = ''
as $$
  with params as (
    select
      public.escape_like(public.immutable_unaccent(lower(btrim(coalesce(p_q, ''))))) as needle,
      greatest(1, coalesce(p_page_size, 12)) as size
  ),
  filtered as (
    select
      p.*,
      count(*) over () as cnt,
      row_number() over (
        order by
          case when p_ordem = 'destaque' then p.featured_rank end asc nulls last,
          (case when p_ordem = 'destaque' then p.name end) collate "pt-BR-x-icu" asc,
          case when p_ordem = 'novo' then p.is_new end desc,
          case when p_ordem = 'menor' then p.price_cents end asc nulls last,
          case when p_ordem = 'maior' then p.price_cents end desc nulls last,
          p.created_at, p.id
      ) as rn
    from public.products p, params
    where (p_categoria is null or p_categoria = 'todos' or p_categoria = any (p.categories))
      and (
        params.needle = ''
        or public.immutable_unaccent(lower(p.name)) like '%' || params.needle || '%' escape '\'
        or public.immutable_unaccent(lower(p.category_label)) like '%' || params.needle || '%' escape '\'
      )
      and (p_cores is null or cardinality(p_cores) = 0 or p.colors && p_cores)
      and (not coalesce(p_disponivel, false) or p.stock > 0)
  )
  select
    jsonb_build_object(
      'id', f.id,
      'slug', f.slug,
      'name', f.name,
      'description', f.description,
      'priceCents', f.price_cents,
      'rarity', f.rarity,
      'isNew', f.is_new,
      'stock', f.stock,
      'categories', to_jsonb(f.categories),
      'categoryLabel', f.category_label,
      'colors', to_jsonb(f.colors),
      'images', f.images,
      'art', f.art,
      'illustrative', f.illustrative,
      'sizeCm', f.size_cm,
      'beadCount', f.bead_count,
      'cuteness', 'MAX',
      'options', f.options,
      'featuredRank', f.featured_rank
    ) as item,
    f.cnt as total
  from filtered f, params
  where f.rn > (
      least(greatest(1, coalesce(p_pagina, 1)), greatest(1, ceil(f.cnt::numeric / params.size)::int)) - 1
    ) * params.size
    and f.rn <= least(greatest(1, coalesce(p_pagina, 1)), greatest(1, ceil(f.cnt::numeric / params.size)::int)) * params.size
  order by f.rn
$$;

grant execute on function public.search_products(text, text, text[], boolean, text, int, int)
  to anon, authenticated;
