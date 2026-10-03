# MINIMAL. — tienda online

Tienda y panel de administración en React + Vite + Tailwind, con Supabase como base de datos
y MercadoPago para los pagos. Se publica en Vercel desde la rama `main`.

## Desarrollo

```bash
npm install
npm run dev      # tienda en http://localhost:5173
npm test         # tests de precios, estados de pedido y comprobantes
npm run lint
npm run build
```

Variables en `.env.local` (y en Vercel):

| Variable | Uso |
|---|---|
| `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY` | Conexión pública a Supabase |
| `SUPABASE_SERVICE_ROLE_KEY` | Solo en Vercel: clave del servidor para confirmar pagos |
| `MP_ACCESS_TOKEN` | Solo en Vercel: MercadoPago |
| `RESEND_API_KEY`, `STORE_EMAIL_SENDER` | Opcional: comprobante por email |
| `VITE_SUPPORT_EMAIL` | Opcional: email de soporte en Seguimiento |
| `VITE_GOOGLE_LOGIN` | `true` para mostrar el login con Google |

## Estructura

- `src/pages/store`, `src/pages/admin`: pantallas de la tienda y del panel.
- `src/context/StoreContext.jsx`: catálogo, carrito y sesión.
- `src/pricing.js`, `src/orderStatus.js`, `src/reservations.js`: reglas de precios, estados de
  pedido y reserva de stock. Toda pantalla que necesite esas cuentas las toma de acá.
- `api/`: funciones de Vercel (checkout y avisos de MercadoPago).
- `supabase/`: migraciones SQL, para correr en orden en el SQL Editor de Supabase.

## Stock y reservas

`stock` es lo que hay físicamente. Una orden sin pagar reserva sus unidades: siguen en stock
pero no se pueden vender a otro cliente. Si se paga, se descuentan del stock y queda registrado
en el historial del producto. Si no se paga, la reserva vence sola (10 minutos con MercadoPago,
48 horas por transferencia) y las unidades vuelven a estar disponibles.

El panel de administración acepta solo usuarios de Supabase con `app_metadata.role = "admin"`.
