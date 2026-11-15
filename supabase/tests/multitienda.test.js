import { describe, it, expect, beforeAll } from 'vitest';
import { readFileSync } from 'node:fs';
import { PGlite } from '@electric-sql/pglite';

// Corre las migraciones reales (001, 002, 003) sobre PostgreSQL en memoria y verifica
// que cada tienda quede aislada de las demás.

const sql = (file) => readFileSync(new URL(`../${file}`, import.meta.url), 'utf8');

const MINIMAL = '00000000-0000-0000-0000-000000000001';
const STORE_B = '00000000-0000-0000-0000-0000000000b0';
const STORE_OFF = '00000000-0000-0000-0000-0000000000c0';
const ADMIN = '00000000-0000-0000-0000-00000000aaaa';
const OWNER_B = '00000000-0000-0000-0000-00000000bbbb';
const CUSTOMER = '00000000-0000-0000-0000-00000000cccc';

const claims = {
  anon: { role: 'anon' },
  // Superadmin con la verificación en dos pasos hecha (aal2), y la misma cuenta con solo la contraseña
  admin: { role: 'authenticated', sub: ADMIN, email: 'admin@x.com', aal: 'aal2', app_metadata: { role: 'admin' } },
  adminPasswordOnly: { role: 'authenticated', sub: ADMIN, email: 'admin@x.com', aal: 'aal1', app_metadata: { role: 'admin' } },
  ownerB: { role: 'authenticated', sub: OWNER_B, email: 'owner@velas.com', app_metadata: {} },
  customer: { role: 'authenticated', sub: CUSTOMER, email: 'cliente@x.com', app_metadata: {} }
};

let db;
const ids = {};

// Ejecuta una consulta como lo haría la API de Supabase con ese usuario
async function as(who, query, params = []) {
  return db.transaction(async (tx) => {
    await tx.query(`select set_config('request.jwt.claims', $1, true)`, [JSON.stringify(claims[who])]);
    await tx.exec(`set local role ${claims[who].role}`);
    return (await tx.query(query, params)).rows;
  });
}

const orderArgs = (items, store) => [
  'Cliente', 'cliente@x.com', '291', '30111222', JSON.stringify({ city: 'Bahía' }), 'MercadoPago',
  JSON.stringify(items), store
];
const createOrder = `select public.create_order($1, $2, $3, $4, $5::jsonb, $6, $7::jsonb, $8::uuid) as o`;

beforeAll(async () => {
  db = new PGlite();
  await db.exec(readFileSync(new URL('./supabase_shim.sql', import.meta.url), 'utf8'));
  await db.exec(sql('001_estructura.sql'));
  await db.exec(sql('002_seguridad.sql'));

  // Un producto que ya existía antes de la plataforma
  ids.old = (await db.query(`insert into products (name, price, stock) values ('Remera vieja', 100, 5) returning id`)).rows[0].id;

  await db.exec(sql('003_multitienda.sql'));
  await db.exec(sql('003_multitienda.sql')); // se puede correr dos veces

  await db.query(`insert into auth.users (id, email) values ($1, 'admin@x.com'), ($2, 'owner@velas.com'), ($3, 'cliente@x.com')`, [ADMIN, OWNER_B, CUSTOMER]);
  await db.query(`insert into stores (id, slug, name, custom_domain, template) values ($1, 'velas-luna', 'Velas Luna', 'velasluna.com.ar', 'velas')`, [STORE_B]);
  await db.query(`insert into stores (id, slug, name, status) values ($1, 'apagada', 'Apagada', 'suspended')`, [STORE_OFF]);
  await db.query(`insert into store_members (store_id, user_id, role) values ($1, $2, 'owner')`, [STORE_B, OWNER_B]);
  await db.query(`insert into store_settings (store_id, shipping_cost) values ($1, 10)`, [STORE_B]);

  ids.minimal = (await db.query(`insert into products (name, price, stock) values ('Buzo', 200, 5) returning id`)).rows[0].id;
  ids.velas = (await db.query(`insert into products (name, price, stock, store_id) values ('Vela', 50, 3, $1) returning id`, [STORE_B])).rows[0].id;
  ids.off = (await db.query(`insert into products (name, price, stock, store_id) values ('Oculto', 1, 1, $1) returning id`, [STORE_OFF])).rows[0].id;
}, 60000);

describe('migración', () => {
  it('lo que ya existía queda en MINIMAL, con su configuración', async () => {
    const [p] = (await db.query(`select store_id from products where id = $1`, [ids.old])).rows;
    expect(p.store_id).toBe(MINIMAL);
    const settings = (await db.query(`select id, store_id from store_settings order by id`)).rows;
    expect(settings[0]).toEqual({ id: 1, store_id: MINIMAL });
    expect(settings[1].store_id).toBe(STORE_B); // id generado solo para la tienda nueva
  });
});

describe('catálogo público', () => {
  it('muestra productos de tiendas activas y oculta los de tiendas suspendidas', async () => {
    const names = (await as('anon', `select name from products`)).map(r => r.name);
    expect(names).toEqual(expect.arrayContaining(['Remera vieja', 'Buzo', 'Vela']));
    expect(names).not.toContain('Oculto');
  });

  it('resuelve la tienda por dominio propio, con www, por subdominio o no encuentra ninguna', async () => {
    const host = async (h) => (await as('anon', `select public.get_store_by_host($1) as s`, [h]))[0].s;
    expect((await host('velasluna.com.ar')).slug).toBe('velas-luna');
    expect((await host('WWW.velasluna.com.ar')).slug).toBe('velas-luna');
    expect((await host('velas-luna.miplataforma.com')).slug).toBe('velas-luna');
    expect((await host('minimal.miplataforma.com:443')).slug).toBe('minimal');
    expect(await host('localhost')).toBeNull();
    expect((await as('anon', `select public.get_store_by_slug('velas-luna') as s`))[0].s.id).toBe(STORE_B);
  });
});

describe('dueño de una tienda', () => {
  it('carga productos en su tienda pero no en otra', async () => {
    const rows = await as('ownerB', `insert into products (name, price, stock, store_id) values ('Vela XL', 80, 2, $1) returning id`, [STORE_B]);
    expect(rows).toHaveLength(1);
    await expect(as('ownerB', `insert into products (name, price, stock) values ('Intruso', 1, 1)`)).rejects.toThrow(/row-level security/);
  });

  it('no puede editar ni borrar productos de otra tienda', async () => {
    expect(await as('ownerB', `update products set price = 1 where id = $1 returning id`, [ids.minimal])).toHaveLength(0);
    expect(await as('ownerB', `delete from products where id = $1 returning id`, [ids.minimal])).toHaveLength(0);
    // ni mover uno suyo a otra tienda
    await expect(as('ownerB', `update products set store_id = $1 where id = $2`, [MINIMAL, ids.velas])).rejects.toThrow(/row-level security/);
  });

  it('edita la marca de su tienda, pero no el estado ni otras tiendas', async () => {
    expect(await as('ownerB', `update stores set branding = '{"color":"#000"}' where id = $1 returning id`, [STORE_B])).toHaveLength(1);
    expect(await as('ownerB', `update stores set name = 'X' where id = $1 returning id`, [MINIMAL])).toHaveLength(0);
    await expect(as('ownerB', `update stores set status = 'active' where id = $1`, [STORE_B])).rejects.toThrow(/permission denied/);
    await expect(as('ownerB', `insert into store_members (store_id, user_id) values ($1, $2)`, [MINIMAL, OWNER_B])).rejects.toThrow(/permission denied/);
  });

  it('solo ve sus tiendas; el administrador de plataforma ve todas', async () => {
    expect(await as('ownerB', `select slug, role from public.my_stores()`)).toEqual([{ slug: 'velas-luna', role: 'owner' }]);
    // Las tiendas de prueba se crean en el mismo instante: se compara sin importar el orden
    expect((await as('admin', `select slug from public.my_stores()`)).map(r => r.slug).sort()).toEqual(['apagada', 'minimal', 'velas-luna']);
    expect(await as('customer', `select slug from public.my_stores()`)).toEqual([]);
  });

  it('sube imágenes solo dentro de la carpeta de su tienda', async () => {
    expect(await as('ownerB', `insert into storage.objects (bucket_id, name) values ('images', $1) returning id`, [`${STORE_B}/vela.jpg`])).toHaveLength(1);
    await expect(as('ownerB', `insert into storage.objects (bucket_id, name) values ('images', $1)`, [`${MINIMAL}/x.jpg`])).rejects.toThrow(/row-level security/);
    await expect(as('ownerB', `insert into storage.objects (bucket_id, name) values ('images', 'suelta.jpg')`)).rejects.toThrow(/row-level security/);
    expect(await as('admin', `insert into storage.objects (bucket_id, name) values ('images', 'suelta.jpg') returning id`)).toHaveLength(1);
  });
});

describe('órdenes por tienda', () => {
  it('cada orden se arma con productos y envío de su tienda', async () => {
    const [{ o }] = await as('anon', createOrder, orderArgs([{ id: ids.velas, quantity: 1 }], STORE_B));
    expect(o.total).toBe(60); // 50 + envío 10 de Velas Luna
    ids.orderB = o.id;

    await expect(as('anon', createOrder, orderArgs([{ id: ids.minimal, quantity: 1 }], STORE_B)))
      .rejects.toThrow(/ya no está disponible/);
    await expect(as('anon', createOrder, orderArgs([{ id: ids.off, quantity: 1 }], STORE_OFF)))
      .rejects.toThrow(/no está disponible/);
  });

  it('sin indicar tienda sigue funcionando como hoy (MINIMAL)', async () => {
    const [{ o }] = await as('anon', `select public.create_order('Cliente', 'cliente@x.com', '291', '30111222', '{}'::jsonb, 'Transferencia', $1::jsonb) as o`,
      [JSON.stringify([{ id: ids.minimal, quantity: 2 }])]);
    expect(o.total).toBe(400);
    ids.orderMinimal = o.id;
    expect((await db.query(`select store_id from orders where id = $1`, [o.id])).rows[0].store_id).toBe(MINIMAL);

    // Los otros llamados del código publicado, también sin tienda
    const reserved = (await as('anon', `select product_id from public.get_reserved_stock()`)).map(r => r.product_id);
    expect(reserved).toEqual(expect.arrayContaining([ids.minimal, ids.velas]));
    const tracked = (await as('anon', `select public.track_orders_by_document('30111222') as t`))[0].t;
    expect(tracked.map(t => t.short_id)).toEqual([o.id.slice(0, 8)]);
  });

  it('cada dueño ve solo las órdenes de su tienda', async () => {
    const seen = (await as('ownerB', `select id from orders`)).map(r => r.id);
    expect(seen).toEqual([ids.orderB]);
    expect((await as('admin', `select id from orders`)).length).toBeGreaterThanOrEqual(2);
  });

  it('las reservas y el seguimiento por DNI se cuentan por tienda', async () => {
    const reserved = await as('anon', `select product_id from public.get_reserved_stock($1)`, [STORE_B]);
    expect(reserved.map(r => r.product_id)).toEqual([ids.velas]);
    const tracked = (await as('anon', `select public.track_orders_by_document('30111222', $1) as t`, [STORE_B]))[0].t;
    expect(tracked).toHaveLength(1);
    expect(tracked[0].short_id).toBe(ids.orderB.slice(0, 8));
  });

  it('confirmar el pago: solo quien administra esa tienda (o el servidor)', async () => {
    await expect(as('ownerB', `select public.mark_order_paid($1)`, [ids.orderMinimal])).rejects.toThrow(/No autorizado/);
    await expect(as('customer', `select public.mark_order_paid($1)`, [ids.orderB])).rejects.toThrow(/No autorizado/);

    expect((await as('ownerB', `select public.mark_order_paid($1) as s`, [ids.orderB]))[0].s).toBe('pagado');
    const [p] = (await db.query(`select stock from products where id = $1`, [ids.velas])).rows;
    expect(p.stock).toBe(2);
    const [log] = (await db.query(`select store_id, reason from inventory_logs where product_id = $1`, [ids.velas])).rows;
    expect(log).toEqual({ store_id: STORE_B, reason: 'Venta' });

    expect((await as('admin', `select public.mark_order_paid($1) as s`, [ids.orderMinimal]))[0].s).toBe('pagado');
  });
});

describe('inventario por tienda', () => {
  it('ajustes de stock solo sobre productos propios', async () => {
    await expect(as('ownerB', `select public.adjust_stock($1, 5, 'Ingreso')`, [ids.minimal])).rejects.toThrow(/No autorizado/);
    expect((await as('ownerB', `select public.adjust_stock($1, 5, 'Ingreso') as s`, [ids.velas]))[0].s).toBe(7);
  });

  it('no se pueden anotar movimientos de productos de otra tienda', async () => {
    await expect(as('ownerB', `insert into inventory_logs (product_id, change_amount, stock_after, reason, store_id) values ($1, 1, 1, 'x', $2)`, [ids.minimal, STORE_B]))
      .rejects.toThrow(/row-level security/);
    expect((await as('ownerB', `select store_id from inventory_logs`)).every(r => r.store_id === STORE_B)).toBe(true);
  });
});

// Va al final: pausa los productos de MINIMAL
describe('004 · pausar MINIMAL', () => {
  it('saca de la tienda los productos de MINIMAL sin borrarlos ni tocar otras tiendas', async () => {
    const before = (await db.query(`select count(*)::int as n from products where store_id = $1`, [MINIMAL])).rows[0].n;
    await db.exec(sql('004_pausar_minimal.sql'));

    const rows = (await db.query(`select is_active from products where store_id = $1`, [MINIMAL])).rows;
    expect(rows).toHaveLength(before);
    expect(rows.every(r => !r.is_active)).toBe(true);
    const names = (await as('anon', `select name from products where is_active`)).map(r => r.name);
    expect(names).toContain('Vela');
    expect(names).not.toContain('Buzo');
  });
});

describe('005 · solicitudes de tienda', () => {
  it('solo el servidor las lee y escribe: ni visitantes, ni clientes, ni dueños', async () => {
    await db.exec(sql('005_solicitudes.sql'));
    await db.exec(sql('005_solicitudes.sql')); // se puede correr dos veces
    await db.query(`insert into store_requests (owner_name, tax_id, email, phone, city, province, business_name, category, terms_version, accepted_at)
      values ('Ana Pérez', '20123456786', 'ana@x.com', '2915551234', 'Bahía', 'Buenos Aires', 'Velas', 'velas', 'v1', now())`);

    for (const who of ['anon', 'customer', 'ownerB', 'admin']) {
      await expect(as(who, `select * from store_requests`)).rejects.toThrow(/permission denied/);
      await expect(as(who, `insert into store_requests (owner_name) values ('x')`)).rejects.toThrow(/permission denied/);
    }
  });
});

describe('006 · alta por autoservicio', () => {
  it('una tienda sin ventas habilitadas no recibe pedidos; las existentes siguen vendiendo', async () => {
    await db.exec(sql('006_alta_autoservicio.sql'));
    await db.exec(sql('006_alta_autoservicio.sql')); // se puede correr dos veces

    expect((await db.query(`select bool_and(sales_enabled) as ok from stores`)).rows[0].ok).toBe(true);

    await db.query(`update stores set sales_enabled = false, signup_ip = '1.2.3.4' where id = $1`, [STORE_B]);
    await expect(as('anon', createOrder, orderArgs([{ id: ids.velas, quantity: 1 }], STORE_B)))
      .rejects.toThrow(/no está habilitada para vender/);

    const store = (await as('anon', `select public.get_store_by_slug('velas-luna') as s`))[0].s;
    expect(store.sales_enabled).toBe(false);

    await db.query(`update stores set sales_enabled = true where id = $1`, [STORE_B]);
    const [{ o }] = await as('anon', createOrder, orderArgs([{ id: ids.velas, quantity: 1 }], STORE_B));
    expect(o.id).toBeTruthy();
  });

  it('los datos del alta no son públicos, y el dueño no puede habilitarse las ventas solo', async () => {
    await expect(as('anon', `select signup_ip from stores`)).rejects.toThrow(/permission denied/);
    await expect(as('ownerB', `select created_by from stores`)).rejects.toThrow(/permission denied/);
    expect((await as('anon', `select slug, sales_enabled from stores where id = $1`, [STORE_B]))[0].slug).toBe('velas-luna');
    await expect(as('ownerB', `update stores set sales_enabled = true where id = $1`, [STORE_B])).rejects.toThrow(/permission denied/);
    // El catálogo público sigue funcionando con los permisos por columna
    expect((await as('anon', `select name from products where store_id = $1`, [STORE_B])).length).toBeGreaterThan(0);
  });
});

describe('007 · arreglo de la numeración de store_settings', () => {
  it('con el id fijo en 1 (como en producción) las tiendas nuevas vuelven a poder guardarse', async () => {
    // Reproduce producción: el id tiene un valor fijo (1) en vez de contador, y una regla
    // de "una sola fila" (NOT VALID: las filas de prueba existentes ya tienen otros ids)
    await db.exec(`alter table store_settings alter column id set default 1`);
    await db.exec(`alter sequence store_settings_id_seq owned by none`);
    await db.exec(`alter table store_settings add constraint store_settings_single_row check (id = 1) not valid`);
    const [nueva] = (await db.query(`insert into stores (slug, name) values ('sin-config', 'Sin config') returning id`)).rows;
    await expect(db.query(`insert into store_settings (store_id) values ($1)`, [nueva.id])).rejects.toThrow(/store_settings_pkey/);

    await db.exec(sql('007_arreglo_configuracion.sql'));
    await db.exec(sql('007_arreglo_configuracion.sql')); // se puede correr dos veces

    // Completó la configuración que faltaba, con el nombre de la tienda
    const [cfg] = (await db.query(`select store_name from store_settings where store_id = $1`, [nueva.id])).rows;
    expect(cfg.store_name).toBe('Sin config');
    const sinConfig = (await db.query(`select count(*)::int as n from stores s where not exists (select 1 from store_settings x where x.store_id = s.id)`)).rows[0].n;
    expect(sinConfig).toBe(0);
    // Y la próxima tienda se guarda sin chocar
    const [otra] = (await db.query(`insert into stores (slug, name) values ('otra-nueva', 'Otra') returning id`)).rows;
    await db.query(`insert into store_settings (store_id) values ($1)`, [otra.id]);
  });
});

describe('007 · mis tiendas', () => {
  it('un administrador de plataforma que además es dueño figura como dueño', async () => {
    await db.query(`insert into store_members (store_id, user_id, role) values ($1, $2, 'owner')`, [STORE_B, ADMIN]);
    const rows = await as('admin', `select slug, role from public.my_stores()`);
    expect(rows.find(r => r.slug === 'velas-luna').role).toBe('owner');
    expect(rows.find(r => r.slug === 'minimal').role).toBe('platform');
  });
});

describe('008 · cobros por tienda', () => {
  it('las cuentas de MercadoPago son privadas; la marca de conectada y los datos de transferencia, públicos', async () => {
    await db.exec(sql('008_cobros_por_tienda.sql'));
    await db.exec(sql('008_cobros_por_tienda.sql')); // se puede correr dos veces

    await db.query(`insert into store_payment_accounts (store_id, access_token_enc) values ($1, 'v1.cifrado')`, [STORE_B]);
    for (const who of ['anon', 'customer', 'ownerB', 'admin']) {
      await expect(as(who, `select * from store_payment_accounts`)).rejects.toThrow(/permission denied/);
    }
    await expect(as('ownerB', `update stores set mp_connected = true where id = $1`, [STORE_B])).rejects.toThrow(/permission denied/);

    await db.query(`update stores set mp_connected = true where id = $1`, [STORE_B]);
    expect((await as('anon', `select public.get_store_by_slug('velas-luna') as s`))[0].s.mp_connected).toBe(true);

    // MINIMAL conserva el alias que antes estaba escrito en el código
    const [minimal] = await as('anon', `select transfer_alias, contact_whatsapp from store_settings where store_id = $1`, [MINIMAL]);
    expect(minimal).toEqual({ transfer_alias: 'tomizinho', contact_whatsapp: '5492915751347' });
  });
});

describe('009 · seguridad del superadmin', () => {
  it('con solo la contraseña, el superadmin no tiene permisos sobre tiendas ajenas', async () => {
    await db.exec(sql('009_seguridad_superadmin.sql'));
    await db.exec(sql('009_seguridad_superadmin.sql')); // se puede correr dos veces

    // Con el código del celular: es administrador de la plataforma
    expect((await as('admin', `select public.is_admin() as a`))[0].a).toBe(true);
    expect((await as('admin', `select public.is_store_admin($1) as a`, [MINIMAL]))[0].a).toBe(true);

    // Solo con la contraseña: cuenta común (sigue viendo las tiendas de las que es dueño)
    expect((await as('adminPasswordOnly', `select public.is_admin() as a`))[0].a).toBe(false);
    expect((await as('adminPasswordOnly', `select public.is_store_admin($1) as a`, [MINIMAL]))[0].a).toBe(false);
    expect((await as('adminPasswordOnly', `select slug from public.my_stores()`)).map(r => r.slug)).toEqual(['velas-luna']);

    // Un dueño entra solo a su tienda
    expect((await as('ownerB', `select public.is_store_admin($1) as a`, [STORE_B]))[0].a).toBe(true);
    expect((await as('ownerB', `select public.is_store_admin($1) as a`, [MINIMAL]))[0].a).toBe(false);
  });
});
