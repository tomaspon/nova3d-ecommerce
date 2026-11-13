import { Link } from 'react-router-dom';
import { BookOpen, Rocket, LayoutDashboard, Package, Tag, Box, Truck, Settings, ShoppingBag, Users, Globe, HelpCircle, Lightbulb } from 'lucide-react';
import { useStore } from '../../context/StoreContext';
import { isAdminUser } from '../../adminAccess';
import { RESERVATION_MINUTES, TRANSFER_RESERVATION_HOURS } from '../../orderStatus';

// Manual del panel, paso a paso. Las secciones platformOnly las ve solo el administrador de la plataforma.

const SECTIONS = [
  {
    id: 'primeros-pasos', icon: Rocket, title: 'Primeros pasos',
    intro: 'Lo mínimo para que tu tienda esté lista para vender.',
    steps: [
      ['Configurá tu tienda', <>En <Link to="/admin/settings">Config.</Link> completá el nombre del negocio, el email de contacto y el costo de envío.</>],
      ['Creá tus categorías', <>En <Link to="/admin/categories">Categorías</Link> armá las secciones de tu catálogo (por ejemplo: Remeras, Buzos, Accesorios).</>],
      ['Cargá tus productos', <>En <Link to="/admin/products">Productos</Link> tocá <b>Nuevo Producto</b>, subí fotos, poné precio y stock.</>],
      ['Revisá cómo se ve', <>Abrí tu tienda con <b>Ver la Tienda</b> (abajo en el menú) y hacé una compra de prueba con transferencia para conocer el recorrido.</>]
    ]
  },
  {
    id: 'resumen', icon: LayoutDashboard, title: 'Resumen',
    intro: 'La primera pantalla del panel: cómo viene tu negocio de un vistazo.',
    items: [
      ['Ingresos totales', 'Suma de los pedidos pagados (incluye los que están preparándose, enviados o entregados).'],
      ['Pedidos pagados', 'Cantidad de ventas confirmadas.'],
      ['Productos activos', 'Productos publicados en la tienda.'],
      ['Reservas activas', 'Pedidos creados que todavía esperan el pago. Mientras tanto, esas unidades quedan apartadas.'],
      ['Mermas', 'Valor de lo que se registró como dañado o perdido en los movimientos de stock.'],
      ['Últimos movimientos', 'Las ventas más recientes. Tocá una para ver el detalle: productos, comprador, envío y total.']
    ]
  },
  {
    id: 'productos', icon: Package, title: 'Productos',
    intro: 'Tu catálogo y tu inventario.',
    steps: [
      ['Crear un producto', <>Tocá <b>Nuevo Producto</b>. Subí una o varias fotos (la primera es la principal), escribí nombre, precio base, descuento (si tiene) y descripción, y elegí la categoría o creá una nueva ahí mismo.</>],
      ['Stock inicial', 'Al crear el producto indicás cuántas unidades tenés. Queda registrado como "Ingreso" en su historial.'],
      ['Sumar o restar stock', <>Abrí el producto y en <b>Stock y Movimientos</b> elegí <b>Sumar</b> o <b>Restar</b>, la cantidad y el motivo (ingreso de fábrica, devolución, dañado, perdido, venta manual o ajuste). Podés agregar una nota.</>],
      ['Pausar o eliminar', <><b>Pausar Publicación</b> lo saca de la tienda sin borrarlo (lo podés volver a activar). El ícono de tacho lo elimina para siempre.</>],
      ['Buscar y filtrar', 'Arriba tenés el buscador y los filtros: en stock, agotados, en oferta, activos, pausados y por categoría.'],
      ['Exportar', <>Con <b>CSV (Excel)</b> descargás la lista de productos para abrirla en Excel.</>]
    ],
    tip: <>En cada producto vas a ver <b>On Hand</b> (lo que tenés físicamente) y <b>Reservado</b> (lo que está en pedidos sin pagar). Lo que se puede vender es la diferencia.</>
  },
  {
    id: 'categorias', icon: Tag, title: 'Categorías',
    intro: 'Las secciones que ven tus clientes arriba del catálogo.',
    steps: [
      ['Crear', <>Escribí el nombre en <b>Nueva Categoría</b> y guardá.</>],
      ['Eliminar', <>Tocá eliminar y escribí la palabra <b>ELIMINAR</b> para confirmar. Los productos no se borran: solo pierden esa sección.</>]
    ],
    tip: 'En la tienda solo aparecen las categorías que tienen productos a la venta, así nunca se ve una sección vacía.'
  },
  {
    id: 'ordenes', icon: Box, title: 'Órdenes',
    intro: 'Todas las ventas, con su estado y el detalle de cada compra.',
    items: [
      ['Reservado', `El cliente hizo el pedido y todavía no se acreditó el pago. Las unidades quedan apartadas ${RESERVATION_MINUTES} minutos si eligió MercadoPago, o ${TRANSFER_RESERVATION_HOURS} horas si eligió transferencia.`],
      ['Pagado', 'Pago confirmado. En ese momento se descuenta el stock y queda registrado como "Venta".'],
      ['Preparando', 'Lo estás armando.'],
      ['Enviado', 'Salió. Lo marcás desde Envíos, con el transportista y el código de seguimiento.'],
      ['Entregado', 'Llegó al cliente.'],
      ['Cancelado (tiempo agotado)', 'No se pagó a tiempo: la reserva se liberó sola y no se descontó stock.']
    ],
    steps: [
      ['Ver el detalle', 'Tocá una orden para ver cliente, DNI, teléfono, dirección, medio de pago y productos.'],
      ['Cambiar el estado', 'Tocá la etiqueta de estado y elegí el nuevo. Las de MercadoPago pasan a "Pagado" solas cuando el pago se acredita.'],
      ['Confirmar una transferencia', 'Cuando veas la plata en tu cuenta, cambiá la orden de "Reservado" a "Pagado".'],
      ['Buscar', 'Usá el buscador (cliente, email o número de orden) o filtrá por fecha.']
    ],
    tip: <>Si cancelás un pedido que ya estaba pagado, el stock no vuelve solo: sumalo desde el producto con el motivo <b>Devolución</b>.</>
  },
  {
    id: 'envios', icon: Truck, title: 'Envíos',
    intro: 'El centro de despacho: solo pedidos pagados, listos para armar y enviar.',
    steps: [
      ['Cola de despachos', 'Ves los pedidos pagados o en preparación, con la dirección de entrega (o "Retiro en local").'],
      ['Confirmar el despacho', <>Tocá <b>Confirmar Despacho</b>, cargá el transportista (Andreani, Correo Argentino, etc.) y el código de seguimiento. El pedido pasa a "Enviado" y el cliente ve esos datos en su seguimiento.</>],
      ['Historial', <>En <b>Historial Enviados</b> están los pedidos que ya salieron.</>]
    ]
  },
  {
    id: 'configuracion', icon: Settings, title: 'Configuración',
    intro: 'Los datos de tu tienda y las campañas.',
    steps: [
      ['Perfil de la tienda', 'Nombre del negocio y email de contacto.'],
      ['Envío', 'El costo de envío fijo que se suma a cada compra (0 = envío gratis).'],
      ['Banner de temporada', <>Activá <b>Habilitar Banner Principal</b> y elegí un diseño listo (Verano, Primavera, Invierno) o <b>Subir propia</b>. Con una foto propia podés arrastrarla para encuadrarla.</>],
      ['Nombre de la campaña', 'El título del banner (por ejemplo "Summer Sale").'],
      ['Productos de la campaña', <>En <b>Destacar Productos en esta campaña</b> elegí cuáles aparecen en el carrusel de ofertas. El banner muestra solo el mayor descuento real entre ellos ("Hasta 30% OFF").</>]
    ],
    tip: 'Acordate de guardar: los cambios se aplican en la tienda al instante.'
  },
  {
    id: 'clientes', icon: ShoppingBag, title: 'Cómo compran tus clientes',
    intro: 'El recorrido del otro lado, para que puedas ayudarlos.',
    steps: [
      ['Carrito y datos', 'Agregan productos, completan nombre, DNI, teléfono y dirección, y eligen MercadoPago o transferencia. No hace falta crear una cuenta.'],
      ['Pago', `Con MercadoPago pagan en el momento; si no lo terminan en ${RESERVATION_MINUTES} minutos, la reserva se libera. Con transferencia tienen ${TRANSFER_RESERVATION_HOURS} horas y vos la confirmás.`],
      ['Seguimiento', <>En <b>Seguimiento</b> ven el estado con el link de su compra o buscando por DNI.</>],
      ['Cuenta (opcional)', 'Si se registran, ven todos sus pedidos, descargan el comprobante, guardan favoritos y sus datos quedan cargados para la próxima compra.']
    ]
  },
  {
    id: 'usuarios', icon: Users, title: 'Usuarios', platformOnly: true,
    intro: 'Las cuentas de toda la plataforma (solo para vos).',
    steps: [
      ['Buscar', 'Por nombre, email, teléfono, DNI o ciudad, con filtros de activos, desactivados, con compras y admins.'],
      ['Restablecer contraseña', 'Le manda a esa persona un mail con un enlace para elegir una contraseña nueva.'],
      ['Desactivar', 'La cuenta no puede iniciar sesión hasta que la reactives. Sus pedidos se conservan. Las cuentas de administrador no se desactivan desde acá.']
    ]
  },
  {
    id: 'plataforma', icon: Globe, title: 'Plataforma: tus tiendas', platformOnly: true,
    intro: <>Desde <Link to="/plataforma">Mis tiendas</Link> manejás todas las tiendas (solo vos lo ves).</>,
    steps: [
      ['Crear una tienda', <>Tocá <b>Nueva tienda</b>: nombre, enlace (se arma solo y no se cambia después), rubro y plantilla. La plantilla copia envío, campaña y banner de otra tienda; los productos no se copian.</>],
      ['Asignar al dueño', 'Poné su email al crearla o con "Agregar dueño". Si no tiene cuenta, le llega una invitación. El dueño entra solo al panel de su tienda.'],
      ['Conectar un dominio', <>Tocá <b>Conectar dominio</b> y pegá el dominio del cliente. El panel te dice qué registro DNS crear donde lo compró (registro A para "velas.com.ar", CNAME para "tienda.velas.com"). Puede tardar hasta 48 horas.</>],
      ['Ver la tienda y su panel', 'Cada tarjeta tiene "Ver tienda" y "Panel". Mientras no tengas el dominio de la plataforma, los links usan ?tienda= en la dirección actual.'],
      ['Suspender', 'Una tienda suspendida muestra "no disponible" y no recibe pedidos. La tienda principal no se puede suspender.']
    ]
  },
  {
    id: 'preguntas', icon: HelpCircle, title: 'Preguntas frecuentes',
    items: [
      ['Un producto dice "Agotado" pero tengo unidades', 'Puede haber unidades reservadas por pedidos sin pagar. Si el pago no llega, se liberan solas cuando vence la reserva.'],
      ['Un cliente pagó por transferencia', 'Buscá su orden en Órdenes y pasala a "Pagado". Ahí se descuenta el stock.'],
      ['Me equivoqué con el stock', 'Abrí el producto y hacé un ajuste (Sumar o Restar) con el motivo "Ajuste de Inventario". Todo queda en el historial.'],
      ['¿El cliente recibe un mail con el comprobante?', 'Todavía no: los mails automáticos se activan más adelante. Si tiene cuenta, lo descarga desde "Mi perfil"; si no, ve el detalle de su compra en Seguimiento.']
    ]
  }
];

function Steps({ steps }) {
  return (
    <ol className="space-y-4">
      {steps.map(([title, text], index) => (
        <li key={title} className="flex gap-4">
          <span className="w-7 h-7 rounded-full bg-indigo-500/15 text-indigo-300 text-xs font-black flex items-center justify-center shrink-0 mt-0.5">{index + 1}</span>
          <div className="min-w-0">
            <p className="font-bold text-white">{title}</p>
            <p className="text-sm text-zinc-400 leading-relaxed mt-0.5">{text}</p>
          </div>
        </li>
      ))}
    </ol>
  );
}

function Items({ items }) {
  return (
    <dl className="divide-y divide-white/5 rounded-xl border border-white/5 bg-white/[0.02]">
      {items.map(([term, text]) => (
        <div key={term} className="px-4 py-3 sm:grid sm:grid-cols-[12rem_minmax(0,1fr)] sm:gap-4">
          <dt className="font-bold text-white text-sm">{term}</dt>
          <dd className="text-sm text-zinc-400 leading-relaxed mt-0.5 sm:mt-0">{text}</dd>
        </div>
      ))}
    </dl>
  );
}

export default function ManualPage() {
  const { user } = useStore();
  const sections = SECTIONS.filter(s => !s.platformOnly || isAdminUser(user));

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl sm:text-4xl font-black text-white tracking-tight flex items-center gap-3">
          <BookOpen className="w-8 h-8 text-indigo-400" /> Manual del panel
        </h1>
        <p className="text-zinc-400 text-sm mt-2">Cómo funciona cada sección, paso a paso.</p>
      </div>

      <div className="grid lg:grid-cols-[14rem_minmax(0,1fr)] gap-8 items-start">
        {/* Índice */}
        <nav aria-label="Índice del manual" className="lg:sticky lg:top-24 bg-black border border-white/10 rounded-2xl p-3">
          <ul className="flex lg:flex-col gap-1 overflow-x-auto hide-scrollbar">
            {sections.map(({ id, icon: Icon, title }) => (
              <li key={id} className="shrink-0">
                <a href={`#${id}`} className="flex items-center gap-2.5 px-3 py-2 rounded-xl text-sm font-medium text-zinc-400 hover:text-white hover:bg-white/5 transition whitespace-nowrap">
                  <Icon className="w-4 h-4 shrink-0" /> {title}
                </a>
              </li>
            ))}
          </ul>
        </nav>

        {/* Secciones */}
        <div className="space-y-6 min-w-0 [&_a]:text-indigo-300 [&_a:hover]:text-indigo-200">
          {sections.map(({ id, icon: Icon, title, intro, steps, items, tip, platformOnly }) => (
            <section key={id} id={id} className="scroll-mt-24 bg-black border border-white/10 rounded-2xl p-5 sm:p-7 space-y-5">
              <div>
                <h2 className="text-xl font-black text-white flex items-center gap-2.5">
                  <Icon className="w-5 h-5 text-indigo-400" /> {title}
                  {platformOnly && <span className="ml-1 px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider bg-indigo-500/15 text-indigo-300">Solo plataforma</span>}
                </h2>
                {intro && <p className="text-sm text-zinc-400 mt-1.5">{intro}</p>}
              </div>
              {items && <Items items={items} />}
              {steps && <Steps steps={steps} />}
              {tip && (
                <p className="flex gap-3 rounded-xl bg-amber-500/5 border border-amber-500/15 p-4 text-sm text-amber-100/90">
                  <Lightbulb className="w-5 h-5 shrink-0 text-amber-400" /> <span>{tip}</span>
                </p>
              )}
            </section>
          ))}
        </div>
      </div>
    </div>
  );
}
