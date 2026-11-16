import { useEffect } from 'react';
import { Link } from 'react-router-dom';
import { AlertTriangle } from 'lucide-react';
import { PLATFORM_BRAND, onPlatformHost } from '../../platformBrand';
import { TERMS_VERSION } from '../../storeRequest';
import ThemeToggle from '../../components/ThemeToggle';

// Términos del servicio y política de privacidad de la plataforma.
// BORRADOR: completar los datos entre corchetes y hacerlo revisar por un abogado.
// Si se cambia el contenido, subir TERMS_VERSION en src/storeRequest.js.

const SECTIONS = [
  {
    title: '1. Quién es el responsable',
    body: [
      `${PLATFORM_BRAND.name} es un servicio de [razón social o nombre y apellido], CUIT [número], con domicilio en [domicilio], responsable de los datos que nos das.`,
      'Para cualquier consulta sobre tus datos escribinos a [email de contacto].'
    ]
  },
  {
    title: '2. Qué datos pedimos y para qué',
    body: [
      'Al solicitar una tienda nos das: nombre y apellido, DNI o CUIT, email, teléfono, ciudad y provincia, y datos de tu negocio. Además registramos la fecha, la dirección IP y el navegador desde los que aceptaste estos términos, como constancia de tu consentimiento.',
      'Los usamos solo para: contactarte y enviarte el presupuesto, verificar tu identidad antes de activar tu tienda, facturar, prestarte el servicio y cumplir obligaciones legales.',
      'No vendemos ni cedemos tus datos. Los guardamos en proveedores de infraestructura (alojamiento y base de datos) que los procesan por cuenta nuestra.'
    ]
  },
  {
    title: '3. Verificación de identidad',
    body: [
      'Antes de activar una tienda podemos pedirte que confirmes tu identidad (por ejemplo, con tu CUIT o con el pago del servicio desde una cuenta a tu nombre). Podemos rechazar solicitudes con datos que no se puedan verificar.'
    ]
  },
  {
    title: '4. Tus obligaciones como vendedor',
    body: [
      'Sos responsable de lo que vendés y de cumplir con tus compradores: entregar lo ofrecido, respetar precios y plazos, y cumplir la Ley de Defensa del Consumidor y las normas impositivas.',
      'No podés usar la plataforma para vender productos ilegales, falsificados o robados, ni para engañar a compradores.',
      'Los datos que cargues deben ser verdaderos y mantenerse actualizados.'
    ]
  },
  {
    title: '5. Suspensión y colaboración con las autoridades',
    body: [
      'Podemos suspender una tienda si detectamos un uso contrario a estos términos o recibimos denuncias fundadas, para proteger a los compradores.',
      'Conservamos los registros de la cuenta y de las operaciones, y los entregamos a las autoridades cuando una orden judicial o un organismo competente lo requiera.'
    ]
  },
  {
    title: '6. Cuánto tiempo guardamos tus datos',
    body: [
      'Mientras uses el servicio y, después, durante el plazo que exijan las normas legales e impositivas. Las solicitudes que no avancen se eliminan a los [12] meses.'
    ]
  },
  {
    title: '7. Tus derechos',
    body: [
      'Podés pedir acceso, rectificación, actualización o supresión de tus datos en cualquier momento, gratis, escribiendo a [email de contacto]. Respondemos el pedido de acceso dentro de los 10 días corridos y el de rectificación o supresión dentro de los 5 días hábiles (Ley 25.326, arts. 14 a 16).',
      'La Agencia de Acceso a la Información Pública, órgano de control de la Ley 25.326, atiende las denuncias y reclamos de quienes consideren afectados sus derechos de protección de datos personales.'
    ]
  },
  {
    title: '8. Arrepentimiento',
    body: [
      'Si contrataste el servicio a distancia, podés revocar la contratación dentro de los 10 días corridos desde que la aceptaste, sin costo ni explicación, escribiéndonos a [email de contacto].'
    ]
  }
];

export default function TermsPage() {
  useEffect(() => {
    document.title = `Términos y privacidad | ${PLATFORM_BRAND.name}`;
  }, []);

  return (
    <div className="min-h-screen bg-white text-zinc-900 dark:bg-zinc-950 dark:text-white">
      <header className="border-b border-zinc-200 dark:border-white/10">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
          <Link to={onPlatformHost() ? '/' : '/inicio'} className="text-xl font-extrabold tracking-tight">{PLATFORM_BRAND.name}<span className="text-indigo-600 dark:text-indigo-400">.</span></Link>
          <ThemeToggle />
        </div>
      </header>
      <main className="max-w-3xl mx-auto px-4 sm:px-6 py-12 md:py-16">
        <div className="mb-8 flex gap-3 rounded-xl border border-amber-300 bg-amber-50 p-4 text-sm text-amber-900 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-200">
          <AlertTriangle className="w-5 h-5 shrink-0" />
          <p><b>Borrador.</b> Falta completar los datos entre corchetes y la revisión de un abogado antes de usarlo con clientes.</p>
        </div>
        <h1 className="text-3xl md:text-4xl font-extrabold tracking-tight">Términos del servicio y política de privacidad</h1>
        <p className="mt-2 text-sm text-zinc-500 dark:text-zinc-400">Versión {TERMS_VERSION}</p>
        <div className="mt-10 space-y-8">
          {SECTIONS.map(section => (
            <section key={section.title}>
              <h2 className="text-lg font-bold">{section.title}</h2>
              {section.body.map(paragraph => (
                <p key={paragraph.slice(0, 40)} className="mt-2 text-zinc-700 leading-relaxed dark:text-zinc-300">{paragraph}</p>
              ))}
            </section>
          ))}
        </div>
      </main>
    </div>
  );
}
