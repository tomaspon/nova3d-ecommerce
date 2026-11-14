-- ============================================================================
-- 007 · ARREGLO: NUMERACIÓN DE store_settings
-- La tabla nació para una sola tienda: su id tenía un valor fijo (1) en lugar de un
-- contador, así que la primera tienda nueva chocaba con la fila de MINIMAL
-- ("duplicate key value violates unique constraint store_settings_pkey").
--
-- Este archivo le pone un contador al id (o adelanta el que tenga), quita la regla
-- de "una sola fila" si existe, y crea la configuración de las tiendas que quedaron
-- sin ella. Se puede ejecutar más de una vez.
-- Dónde: Supabase > SQL Editor > New query > pegar todo > Run.
-- ============================================================================

do $$
declare
  v_seq text := pg_get_serial_sequence('public.store_settings', 'id');
  r record;
begin
  -- Reglas tipo "id = 1" de cuando había una sola configuración
  for r in
    select conname from pg_constraint
    where conrelid = 'public.store_settings'::regclass
      and contype = 'c'
      and pg_get_constraintdef(oid) ~* '\mid\M'
  loop
    execute format('alter table public.store_settings drop constraint %I', r.conname);
  end loop;

  -- Sin contador propio (valor fijo o nada): se le crea uno
  if v_seq is null then
    create sequence if not exists public.store_settings_id_seq;
    alter sequence public.store_settings_id_seq owned by public.store_settings.id;
    alter table public.store_settings alter column id set default nextval('public.store_settings_id_seq');
    v_seq := 'public.store_settings_id_seq';
  end if;

  -- El próximo id es el siguiente al mayor que ya existe
  perform setval(v_seq, greatest((select coalesce(max(id), 0) from public.store_settings), 1));
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
