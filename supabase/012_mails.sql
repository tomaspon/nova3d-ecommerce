-- ============================================================================
-- 012 · MAILS AL CLIENTE (pedido recibido y comprobante de compra)
-- Cada orden registra qué mails ya se mandaron, para que ninguno salga dos veces
-- (el aviso de MercadoPago y la verificación al volver del pago pueden llegar juntos).
--   orders.emails_sent  {"received": "2026-11-15T...", "paid": "..."}
-- Solo el servidor (service_role) puede marcarlos.
--
-- Se puede ejecutar más de una vez.
-- Dónde: Supabase > SQL Editor > New query > pegar todo > Run.
-- ============================================================================

alter table public.orders
  add column if not exists emails_sent jsonb not null default '{}'::jsonb;

-- Toma el envío de un mail (devuelve true solo la primera vez), o lo libera si el envío falló
create or replace function public.claim_order_email(p_order_id uuid, p_kind text, p_release boolean default false)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
begin
  if p_kind is null or p_kind not in ('received', 'paid') then
    raise exception 'Tipo de mail inválido.';
  end if;

  if p_release then
    update public.orders o set emails_sent = o.emails_sent - p_kind where o.id = p_order_id;
    return true;
  end if;

  update public.orders o
  set emails_sent = o.emails_sent || jsonb_build_object(p_kind, now())
  where o.id = p_order_id and not (o.emails_sent ? p_kind);
  return found;
end;
$$;

revoke all on function public.claim_order_email(uuid, text, boolean) from public, anon, authenticated;
grant execute on function public.claim_order_email(uuid, text, boolean) to service_role;

notify pgrst, 'reload schema';
