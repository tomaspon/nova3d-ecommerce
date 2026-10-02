// Un usuario es administrador si su app_metadata tiene role = "admin".
// app_metadata solo se puede cambiar desde Supabase (SQL o panel), nunca desde el navegador,
// a diferencia de user_metadata, que el propio usuario puede editar.
export const isAdminUser = (user) => user?.app_metadata?.role === 'admin';
