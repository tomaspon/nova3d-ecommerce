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
  admin: { role: 'authenticated', sub: ADMIN, email: 'admin@x.com', app_metadata: { role: 'admin' } },
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
describe('004 · tienda de ejemplo', () => {
  it('crea NORTE. con 5 productos, copia la configuración de MINIMAL y pausa sus productos', async () => {
    await db.query(`update store_settings set shipping_cost = 1500, campaign_name = 'Summer Sale' where id = 1`);
    await db.exec(sql('004_tienda_demo.sql'));
    await db.exec(sql('004_tienda_demo.sql')); // no duplica

    const [demo] = (await db.query(`select id, name from stores where slug = 'demo'`)).rows;
    expect(demo.name).toBe('NORTE.');
    const products = (await db.query(`select name, image_url from products where store_id = $1`, [demo.id])).rows;
    expect(products).toHaveLength(5);
    expect(products.every(p => p.image_url.startsWith('/demo/'))).toBe(true);

    const [settings] = (await db.query(`select store_name, shipping_cost, campaign_name from store_settings where store_id = $1`, [demo.id])).rows;
    expect(settings).toEqual({ store_name: 'NORTE.', shipping_cost: '1500', campaign_name: 'Summer Sale' });

    const active = (await db.query(`select count(*)::int as n from products where store_id = $1 and is_active`, [MINIMAL])).rows[0].n;
    expect(active).toBe(0);
    // En el catálogo público la demo se ve; MINIMAL no muestra nada pausado
    const names = (await as('anon', `select name from products where is_active`)).map(r => r.name);
    expect(names).toEqual(expect.arrayContaining(['Remera Oversize Arena', 'Vela']));
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
