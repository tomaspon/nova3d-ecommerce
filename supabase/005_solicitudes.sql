-- ============================================================================
-- 005 · SOLICITUDES DE TIENDA
-- Los emprendedores piden su tienda desde la página oficial de la plataforma.
-- La tabla no es accesible desde el navegador: se escribe y se lee solo desde las
-- funciones del servidor (api/store-request.js y api/platform-stores.js).
--
-- Guarda también cuándo, desde qué IP y con qué versión aceptó los términos:
-- es el registro de su consentimiento.
--
-- Se puede ejecutar más de una vez.
-- Dónde: Supabase > SQL Editor > New query > pegar todo > Run.
-- ============================================================================

create table if not exists public.store_requests (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  status text not null default 'nueva'
    check (status in ('nueva', 'contactada', 'aprobada', 'rechazada')),

  -- Titular
  owner_name text not null,
  tax_id text not null,          -- DNI o CUIT/CUIL (solo números)
  email text not null,
  phone text not null,
  city text not null,
  province text not null,

  -- Negocio
  business_name text not null,
  category text not null,
  social_url text,
  has_domain boolean not null default false,
  domain text,
  message text,

  -- Consentimiento (prueba de qué aceptó, cuándo y desde dónde)
  terms_version text not null,
  accepted_at timestamptz not null,
  ip text,
  user_agent text,

  -- Seguimiento interno
  admin_notes text,
  store_id uuid references public.stores (id) on delete set null
);

create index if not exists store_requests_created_at_idx on public.store_requests (created_at desc);
create index if not exists store_requests_email_idx on public.store_requests (lower(email));

-- Cerrada al público: sin políticas, con RLS activo nadie la ve salvo el servidor
alter table public.store_requests enable row level security;
revoke all on public.store_requests from anon, authenticated;

notify pgrst, 'reload schema';
