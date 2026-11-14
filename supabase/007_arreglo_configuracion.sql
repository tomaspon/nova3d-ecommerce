-- ============================================================================
-- 007 · ARREGLO: NUMERACIÓN DE store_settings
-- La configuración de MINIMAL se cargó con id = 1 a mano y el contador automático
-- de la tabla quedó atrás: la primera tienda nueva chocaba con ese id
-- ("duplicate key value violates unique constraint store_settings_pkey").
--
-- Este archivo adelanta el contador y crea la configuración de las tiendas que
-- quedaron sin ella. Se puede ejecutar más de una vez.
-- Dónde: Supabase > SQL Editor > New query > pegar todo > Run.
-- ============================================================================

do $$
declare
  v_seq text := pg_get_serial_sequence('public.store_settings', 'id');
begin
  if v_seq is not null then
    perform setval(v_seq, greatest((select coalesce(max(id), 0) from public.store_settings), 1));
  end if;
end $$;

-- Mis tiendas: si quien llama es dueño, figura como dueño aunque además sea
-- administrador de la plataforma (así el alta reconoce su tienda)
create or replace function public.my_stores()
returns table (id uuid, slug text, name text, status text, role text)
language sql
stable
security definer
set search_path = ''
as $$
  select s.id, s.slug, s.name, s.status, coalesce(m.role, 'platform')
  from public.stores s
  left join public.store_members m on m.store_id = s.id and m.user_id = auth.uid()
  where public.is_admin() or m.user_id is not null
  order by s.created_at;
$$;

revoke all on function public.my_stores() from public;
grant execute on function public.my_stores() to authenticated;

-- Tiendas sin configuración (creadas antes de este arreglo)
insert into public.store_settings (store_id, store_name)
select s.id, s.name
from public.stores s
where not exists (select 1 from public.store_settings x where x.store_id = s.id);
