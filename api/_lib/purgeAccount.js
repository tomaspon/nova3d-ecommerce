// HERRAMIENTA TEMPORAL (etapa de pruebas): borra para siempre una cuenta y las tiendas de
// las que es único dueño, con todo lo que tienen (productos, pedidos, historial de stock,
// favoritos, configuración, MercadoPago conectado y fotos).
// Se apaga con DISABLE_HARD_DELETE=true en Vercel (el botón desaparece y el servidor la rechaza).
// Nunca toca la tienda principal (MINIMAL, plantilla base) ni cuentas de administrador.
import { DEFAULT_STORE_ID } from '../../src/storeIds.js';

export const isHardDeleteEnabled = () => process.env.DISABLE_HARD_DELETE !== 'true';

const check = ({ error }) => { if (error) throw error; };

// Todos los archivos debajo de una carpeta de un bucket (las carpetas vienen con id null)
async function listFiles(storage, bucket, prefix) {
  const files = [];
  const { data, error } = await storage.from(bucket).list(prefix, { limit: 1000 });
  if (error || !data) return files;
  for (const entry of data) {
    const path = `${prefix}/${entry.name}`;
    if (entry.id) files.push(path);
    else files.push(...await listFiles(storage, bucket, path));
  }
  return files;
}

// Fotos de la tienda: productos y logo (bucket images), banners (bucket products)
async function removeStoreFiles(supabase, storeId) {
  let removed = 0;
  for (const bucket of ['images', 'products']) {
    try {
      const files = await listFiles(supabase.storage, bucket, storeId);
      for (let i = 0; i < files.length; i += 100) {
        const { error } = await supabase.storage.from(bucket).remove(files.slice(i, i + 100));
        if (!error) removed += Math.min(100, files.length - i);
      }
    } catch (err) {
      console.error(`purge: no se pudieron borrar archivos de ${bucket}/${storeId}:`, err.message);
    }
  }
  return removed;
}

// Borra una tienda entera, de lo que depende de ella hacia ella (las tablas no borran en cascada)
export async function deleteStore(supabase, storeId) {
  if (!storeId || storeId === DEFAULT_STORE_ID) throw new Error('La tienda principal no se borra.');
  check(await supabase.from('favorites').delete().eq('store_id', storeId));
  check(await supabase.from('inventory_logs').delete().eq('store_id', storeId));
  check(await supabase.from('orders').delete().eq('store_id', storeId));
  check(await supabase.from('products').delete().eq('store_id', storeId));
  check(await supabase.from('store_settings').delete().eq('store_id', storeId));
  // Dueños y cuenta de MercadoPago se van con la tienda (on delete cascade)
  check(await supabase.from('stores').delete().eq('id', storeId));
  return removeStoreFiles(supabase, storeId);
}

/**
 * Tiendas que se borrarían con la cuenta: aquellas de las que es el ÚNICO dueño.
 * Si una tienda tiene otro dueño, no se borra: solo pierde a este.
 */
export async function storesToDelete(supabase, userId) {
  const { data: own, error } = await supabase.from('store_members').select('store_id').eq('user_id', userId).eq('role', 'owner');
  if (error) throw error;
  const ids = (own || []).map(m => m.store_id).filter(id => id !== DEFAULT_STORE_ID);
  if (!ids.length) return { remove: [], keep: [] };

  const [{ data: owners, error: ownersError }, { data: stores, error: storesError }] = await Promise.all([
    supabase.from('store_members').select('store_id, user_id').in('store_id', ids).eq('role', 'owner'),
    supabase.from('stores').select('id, slug, name').in('id', ids)
  ]);
  if (ownersError) throw ownersError;
  if (storesError) throw storesError;

  const remove = [], keep = [];
  for (const store of stores || []) {
    const others = (owners || []).filter(o => o.store_id === store.id && o.user_id !== userId);
    (others.length ? keep : remove).push(store);
  }
  return { remove, keep };
}

// Borra la cuenta y sus tiendas. Devuelve qué se borró.
export async function purgeAccount(supabase, userId) {
  const { remove, keep } = await storesToDelete(supabase, userId);
  for (const store of remove) await deleteStore(supabase, store.id);
  check(await supabase.from('favorites').delete().eq('user_id', userId));
  const { error } = await supabase.auth.admin.deleteUser(userId);
  if (error) throw error;
  return { deletedStores: remove, keptStores: keep };
}
