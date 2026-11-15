import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Loader2, Check, ArrowRight, Store, LayoutDashboard, ExternalLink, Mail } from 'lucide-react';
import { supabase } from '../../supabaseClient';
import { PLATFORM_BRAND, PLATFORM_DOMAIN } from '../../platformBrand';
import { STORE_TEMPLATES, storeUrls } from '../../platformStores';
import { validateStoreSignup, slugify, TERMS_VERSION } from '../../storeSignup';
import DesignStep from './DesignStep';

// Alta de tienda por autoservicio: cuenta → tienda → diseño → lista.
// La tienda se crea al instante; las ventas se habilitan después de verificar al titular.

const PENDING_KEY = 'pending_store_name';
const inputClass = 'w-full rounded-xl border border-zinc-300 bg-white px-4 py-3 text-base text-zinc-900 placeholder:text-zinc-400 focus:outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 transition';

function Steps({ current }) {
  const steps = ['Tu cuenta', 'Tu tienda', 'Diseño', 'Lista'];
  return (
    <ol className="flex flex-wrap items-center gap-x-2 gap-y-3 text-sm mb-8" aria-label="Pasos">
      {steps.map((label, i) => {
        const done = i < current, active = i === current;
        return (
          <li key={label} className="flex items-center gap-2">
            <span className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold ${done ? 'bg-emerald-500 text-white' : active ? 'bg-indigo-600 text-white' : 'bg-zinc-200 text-zinc-500'}`}>
              {done ? <Check className="w-4 h-4" /> : i + 1}
            </span>
            <span className={`${active ? 'font-semibold text-zinc-900' : 'text-zinc-500'} ${active ? '' : 'hidden sm:inline'}`}>{label}</span>
            {i < steps.length - 1 && <span className="w-4 sm:w-6 h-px bg-zinc-300 mx-1" />}
          </li>
        );
      })}
    </ol>
  );
}

function Field({ label, error, hint, children }) {
  return (
    <label className="block">
      <span className="block text-sm font-semibold text-zinc-700 mb-1.5">{label}</span>
      {children}
      {error ? <span className="block mt-1.5 text-sm text-red-600">{error}</span> : hint && <span className="block mt-1.5 text-xs text-zinc-500">{hint}</span>}
    </label>
  );
}

function AccountStep({ onDone }) {
  const [mode, setMode] = useState('signup'); // signup | login
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [checkEmail, setCheckEmail] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    setError('');
    if (password.length < 8) { setError('La contraseña tiene que tener al menos 8 caracteres.'); return; }
    setIsSending(true);
    if (mode === 'signup') {
      const { data, error: signUpError } = await supabase.auth.signUp({
        email, password, options: { emailRedirectTo: `${window.location.origin}/plataforma/crear` }
      });
      if (signUpError) setError(/registered|already/i.test(signUpError.message) ? 'Ese email ya tiene cuenta. Iniciá sesión.' : 'No pudimos crear la cuenta. Revisá los datos.');
      else if (data.user?.identities?.length === 0) setError('Ese email ya tiene cuenta. Iniciá sesión.');
      else if (!data.session) setCheckEmail(true);
      else onDone();
    } else {
      const { error: loginError } = await supabase.auth.signInWithPassword({ email, password });
      if (loginError) setError('Email o contraseña incorrectos.');
      else onDone();
    }
    setIsSending(false);
  };

  if (checkEmail) {
    return (
      <div className="text-center py-6">
        <Mail className="w-12 h-12 text-indigo-600 mx-auto" />
        <h2 className="mt-4 text-xl font-bold text-zinc-900">Confirmá tu email</h2>
        <p className="mt-2 text-zinc-600">Te mandamos un enlace a <b>{email}</b>. Tocalo y volvés acá para terminar de crear tu tienda.</p>
      </div>
    );
  }

  return (
    <form onSubmit={submit} className="space-y-4">
      <div className="grid grid-cols-2 rounded-xl bg-zinc-100 p-1 text-sm font-semibold" role="tablist">
        {[['signup', 'Crear cuenta'], ['login', 'Ya tengo cuenta']].map(([id, label]) => (
          <button key={id} type="button" role="tab" aria-selected={mode === id} onClick={() => { setMode(id); setError(''); }}
            className={`rounded-lg py-2 transition ${mode === id ? 'bg-white shadow text-zinc-900' : 'text-zinc-500'}`}>{label}</button>
        ))}
      </div>
      <Field label="Email">
        <input className={inputClass} type="email" required autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} />
      </Field>
      <Field label="Contraseña" hint={mode === 'signup' ? 'Mínimo 8 caracteres.' : undefined}>
        <input className={inputClass} type="password" required autoComplete={mode === 'signup' ? 'new-password' : 'current-password'} value={password} onChange={(e) => setPassword(e.target.value)} />
      </Field>
      {error && <p role="alert" className="text-sm text-red-600">{error}</p>}
      <button type="submit" disabled={isSending} className="w-full inline-flex items-center justify-center gap-2 rounded-full bg-indigo-600 text-white font-bold px-6 py-3.5 hover:bg-indigo-500 transition disabled:opacity-60">
        {isSending && <Loader2 className="w-5 h-5 animate-spin" />} Continuar <ArrowRight className="w-4 h-4" />
      </button>
    </form>
  );
}

function StoreStep({ onCreated }) {
  const [name, setName] = useState(() => { try { return localStorage.getItem(PENDING_KEY) || ''; } catch { return ''; } });
  const [slug, setSlug] = useState('');
  const [slugTouched, setSlugTouched] = useState(false);
  const [template, setTemplate] = useState('');
  const [accepted, setAccepted] = useState(false);
  const [errors, setErrors] = useState({});
  const [message, setMessage] = useState('');
  const [isSending, setIsSending] = useState(false);

  const finalSlug = slugTouched ? slug : slugify(name);
  const preview = storeUrls({ slug: finalSlug || 'tu-tienda' }, { origin: window.location.origin, platformDomain: PLATFORM_DOMAIN || null }).storefront.replace(/^https?:\/\//, '');

  const submit = async (e) => {
    e.preventDefault();
    const payload = { action: 'create', name, slug: finalSlug, template, accepted_terms: accepted, terms_version: TERMS_VERSION };
    const { errors: found } = validateStoreSignup(payload);
    if (Object.keys(found).length) { setErrors(found); return; }
    setIsSending(true);
    setMessage('');
    try {
      const { data } = await supabase.auth.getSession();
      const response = await fetch('/api/store-signup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${data.session?.access_token || ''}` },
        body: JSON.stringify(payload)
      });
      const body = await response.json().catch(() => ({}));
      if (!response.ok) {
        setErrors(body.errors || {});
        // En localhost no existen las funciones del servidor (viven en Vercel)
        setMessage(response.status === 404
          ? <>Estás en la versión local: crear la tienda necesita el servidor publicado. Seguí en <a className="underline font-semibold" href="https://nova3d-ecommerce.vercel.app/plataforma/crear">nova3d-ecommerce.vercel.app/plataforma/crear</a> e iniciá sesión con esta misma cuenta.</>
          : body.message || 'No pudimos crear tu tienda.');
      } else {
        try { localStorage.removeItem(PENDING_KEY); } catch { /* sin almacenamiento */ }
        onCreated(body.store);
      }
    } catch {
      setMessage('No hay conexión. Probá de nuevo.');
    }
    setIsSending(false);
  };

  return (
    <form onSubmit={submit} noValidate className="space-y-4">
      <Field label="Nombre de tu tienda" error={errors.name}>
        <input className={inputClass} autoFocus value={name} onChange={(e) => { setName(e.target.value); setErrors(x => ({ ...x, name: undefined })); }} placeholder="Ej: Velas Luna" />
      </Field>
      <Field label="Dirección de tu tienda" error={errors.slug} hint={<>Así va a quedar: <b className="text-zinc-700">{preview}</b></>}>
        <input className={`${inputClass} font-mono`} value={finalSlug} onChange={(e) => { setSlugTouched(true); setSlug(e.target.value.toLowerCase()); setErrors(x => ({ ...x, slug: undefined })); }} />
      </Field>
      <Field label="¿Qué vendés?" error={errors.template}>
        <select className={inputClass} value={template} onChange={(e) => { setTemplate(e.target.value); setErrors(x => ({ ...x, template: undefined })); }}>
          <option value="">Elegí tu rubro...</option>
          {STORE_TEMPLATES.map(t => <option key={t.id} value={t.id}>{t.label}</option>)}
        </select>
      </Field>
      <label className="flex items-start gap-3 text-sm text-zinc-700">
        <input type="checkbox" className="mt-0.5 w-5 h-5 rounded accent-indigo-600 shrink-0" checked={accepted} onChange={(e) => { setAccepted(e.target.checked); setErrors(x => ({ ...x, accepted_terms: undefined })); }} />
        <span>Acepto los <Link to="/plataforma/terminos" target="_blank" className="font-semibold text-indigo-600 underline">términos del servicio y la política de privacidad</Link>.</span>
      </label>
      {errors.accepted_terms && <p className="text-sm text-red-600">{errors.accepted_terms}</p>}
      {message && <p role="alert" className="text-sm text-red-600">{message}</p>}
      <button type="submit" disabled={isSending} className="w-full inline-flex items-center justify-center gap-2 rounded-full bg-indigo-600 text-white font-bold px-6 py-3.5 hover:bg-indigo-500 transition disabled:opacity-60">
        {isSending && <Loader2 className="w-5 h-5 animate-spin" />} Crear mi tienda
      </button>
    </form>
  );
}

function DoneStep({ store, existing }) {
  const urls = storeUrls(store, { origin: window.location.origin, platformDomain: PLATFORM_DOMAIN || null });
  return (
    <div>
      <div className="text-center">
        <span className="w-14 h-14 rounded-full bg-emerald-100 text-emerald-600 inline-flex items-center justify-center"><Store className="w-7 h-7" /></span>
        <h2 className="mt-4 text-2xl font-extrabold text-zinc-900">{existing ? `Ya tenés tu tienda: ${store.name}` : `¡${store.name} está creada!`}</h2>
        <p className="mt-2 text-zinc-600">Ya podés cargar productos y personalizarla.</p>
      </div>
      <div className="mt-6 grid sm:grid-cols-2 gap-3">
        <a href={urls.admin} className="inline-flex items-center justify-center gap-2 rounded-full bg-indigo-600 text-white font-bold px-6 py-3.5 hover:bg-indigo-500 transition">
          <LayoutDashboard className="w-4 h-4" /> Ir a mi panel
        </a>
        <a href={urls.storefront} target="_blank" rel="noopener noreferrer" className="inline-flex items-center justify-center gap-2 rounded-full border border-zinc-300 font-bold px-6 py-3.5 hover:bg-zinc-50 transition">
          Ver mi tienda <ExternalLink className="w-4 h-4" />
        </a>
      </div>
      <div className="mt-8 rounded-2xl bg-zinc-50 border border-zinc-200 p-5">
        <p className="font-bold text-zinc-900">Próximos pasos</p>
        <ol className="mt-3 space-y-2 text-sm text-zinc-600 list-decimal list-inside">
          <li>Cargá tus productos con fotos, precios y stock.</li>
          <li>Configurá el costo de envío.</li>
          <li>Cuando esté lista, tocá <b>"Pedir activación"</b> en tu panel: verificamos tus datos y habilitamos las ventas.</li>
        </ol>
      </div>
    </div>
  );
}

export default function CreateStorePage() {
  const [session, setSession] = useState(undefined);
  const [store, setStore] = useState(null);
  const [existing, setExisting] = useState(false);
  const [designDone, setDesignDone] = useState(false);

  useEffect(() => {
    document.title = `Creá tu tienda | ${PLATFORM_BRAND.name}`;
    supabase.auth.getSession().then(({ data }) => setSession(data.session));
    const { data: listener } = supabase.auth.onAuthStateChange((_e, s) => setSession(s));
    return () => listener.subscription.unsubscribe();
  }, []);

  // Si la cuenta ya tiene una tienda, se la mostramos en vez de crear otra
  const userId = session?.user?.id;
  useEffect(() => {
    if (!userId) return;
    supabase.rpc('my_stores').then(({ data }) => {
      const own = (data || []).find(s => s.role === 'owner');
      if (own) { setStore(own); setExisting(true); }
    });
  }, [userId]);

  // Quien ya tenía tienda va directo al final; el diseño se elige solo al crearla
  const step = !session ? 0 : !store ? 1 : existing || designDone ? 3 : 2;
  const TITLES = ['Creá tu tienda gratis', 'Contanos de tu tienda', 'Elegí cómo se ve', 'Listo'];
  const SUBTITLES = ['En 2 minutos tenés tu tienda online. Sin tarjeta.', 'Lo podés cambiar después desde tu panel.', 'Elegí lo básico; lo vas viendo en la vista previa.'];

  return (
    <div className="min-h-screen bg-zinc-50 text-zinc-900">
      <header className="bg-white border-b border-zinc-200">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
          <Link to="/plataforma/inicio" className="text-xl font-extrabold tracking-tight">{PLATFORM_BRAND.name}<span className="text-indigo-600">.</span></Link>
          {session && <button type="button" onClick={() => supabase.auth.signOut()} className="text-sm text-zinc-500 hover:text-zinc-900">Salir</button>}
        </div>
      </header>
      <main className={`${step === 2 ? 'max-w-4xl' : 'max-w-lg'} mx-auto px-4 sm:px-6 py-10 md:py-16`}>
        {session === undefined ? (
          <div className="flex justify-center py-20"><Loader2 className="w-8 h-8 animate-spin text-indigo-600" /></div>
        ) : (
          <>
            <Steps current={step} />
            <h1 className="text-3xl font-extrabold tracking-tight">
              {TITLES[step]}
            </h1>
            {step < 3 && <p className="mt-2 mb-8 text-zinc-600">{SUBTITLES[step]}</p>}
            <div className={`rounded-2xl bg-white border border-zinc-200 p-6 sm:p-8 shadow-sm ${step === 3 ? 'mt-6' : ''}`}>
              {step === 0 && <AccountStep onDone={() => supabase.auth.getSession().then(({ data }) => setSession(data.session))} />}
              {step === 1 && <StoreStep onCreated={(s) => setStore(s)} />}
              {step === 2 && <DesignStep store={store} onDone={() => setDesignDone(true)} />}
              {step === 3 && <DoneStep store={store} existing={existing} />}
            </div>
          </>
        )}
      </main>
    </div>
  );
}
