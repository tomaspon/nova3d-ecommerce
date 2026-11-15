-- ============================================================================
-- 009 · SEGURIDAD DEL SUPERADMIN
-- El administrador de la plataforma solo tiene sus permisos (ver y editar TODAS las
-- tiendas) cuando inició sesión con contraseña Y con el código de la app del celular
-- (verificación en dos pasos, nivel "aal2" del token de Supabase).
-- Con solo la contraseña es una cuenta común: si alguien la roba, no puede tocar
-- ninguna tienda ajena. Los dueños siguen entrando a SU tienda con email y contraseña.
--
-- ANTES de correrlo: entrá a /superadmin y activá la verificación en dos pasos
-- (te pide escanear un QR con Google Authenticator o Authy). Si lo corrés antes,
-- igual podés activarla después: el superadmin te la pide al entrar.
--
-- Se puede ejecutar más de una vez.
-- Dónde: Supabase > SQL Editor > New query > pegar todo > Run.
-- ============================================================================

create or replace function public.is_admin()
returns boolean
language sql
stable
set search_path = ''
as $$
  select coalesce(
    (auth.jwt() -> 'app_metadata' ->> 'role') = 'admin'
    and (auth.jwt() ->> 'aal') = 'aal2',
    false
  );
$$;

notify pgrst, 'reload schema';
