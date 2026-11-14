-- ============================================================================
-- 008 · COBROS POR TIENDA
-- 1) Cada tienda conecta su propia cuenta de MercadoPago (OAuth): los tokens se
--    guardan cifrados en store_payment_accounts, una tabla que solo lee el servidor.
-- 2) Cada tienda tiene sus datos de transferencia y su WhatsApp de contacto.
--
-- MINIMAL queda con los datos de transferencia que tenía escritos en el código y,
-- hasta que conecte su propia cuenta, sigue cobrando con la cuenta de la plataforma.
-- Requiere 006. Se puede ejecutar más de una vez.
-- Dónde: Supabase > SQL Editor > New query > pegar todo > Run.
-- ============================================================================

-- ── Datos de cobro y contacto de cada tienda (públicos: se muestran al comprador) ──
alter table public.store_settings
  add column if not exists transfer_alias text,
  add column if not exists transfer_cbu text,
  add column if not exists transfer_holder text,
  add column if not exists contact_whatsapp text;

update public.store_settings
set transfer_alias = 'tomizinho',
    transfer_holder = 'Tomas Pon Oses',
    contact_whatsapp = '5492915751347'
where store_id = '00000000-0000-0000-0000-000000000001'
  and transfer_alias is null;

-- ── Cuenta de MercadoPago conectada (privada: tokens cifrados) ──────────────
create table if not exists public.store_payment_accounts (
  store_id uuid primary key references public.stores (id) on delete cascade,
  provider text not null default 'mercadopago',
  mp_user_id text,
  access_token_enc text not null,
  refresh_token_enc text,
  public_key text,
  live_mode boolean,
  expires_at timestamptz,
  connected_by uuid references auth.users (id) on delete set null,
  connected_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.store_payment_accounts enable row level security;
revoke all on public.store_payment_accounts from anon, authenticated;

-- Marca pública: la tienda puede cobrar con MercadoPago (sin exponer ningún dato de la cuenta)
alter table public.stores add column if not exists mp_connected boolean not null default false;
grant select (mp_connected) on public.stores to anon, authenticated;

create or replace function public.get_store_by_host(p_host text)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  with h as (
    select regexp_replace(lower(split_part(coalesce(p_host, ''), ':', 1)), '^www\.', '') as host
  )
  select to_jsonb(x)
  from (
    select s.id, s.slug, s.name, s.status, s.template, s.branding, s.sales_enabled, s.mp_connected
    from public.stores s, h
    where lower(s.custom_domain) = h.host
       or s.slug = split_part(h.host, '.', 1)
    order by (lower(s.custom_domain) = h.host) desc nulls last
    limit 1
  ) x;
$$;

create or replace function public.get_store_by_slug(p_slug text)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select to_jsonb(x)
  from (
    select s.id, s.slug, s.name, s.status, s.template, s.branding, s.sales_enabled, s.mp_connected
    from public.stores s
    where s.slug = lower(trim(p_slug))
  ) x;
$$;

notify pgrst, 'reload schema';
