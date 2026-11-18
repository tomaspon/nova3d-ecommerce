-- 017 · Cuánto se guarda cada cosa (privacidad).
--  - Tráfico (analytics_events): 180 días. Alcanza para comparar temporadas; después se borra.
--  - Errores (app_errors): 30 días (016). Límites de intentos: 1 día (016).
-- La limpieza la hace la misma base de vez en cuando, al registrar visitas: no hace falta un programador de tareas.
-- Se puede correr más de una vez.

create or replace function public.analytics_retention()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  -- Una vez cada ~500 registros (barato y suficiente)
  if random() < 0.002 then
    delete from public.analytics_events where created_at < now() - interval '180 days';
  end if;
  return null;
end;
$$;

drop trigger if exists analytics_events_retention on public.analytics_events;
create trigger analytics_events_retention
  after insert on public.analytics_events
  for each statement execute function public.analytics_retention();

revoke all on function public.analytics_retention() from public, anon, authenticated;
