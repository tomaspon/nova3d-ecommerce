import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Loader2, Check, ArrowRight, Store, LayoutDashboard, ExternalLink, Mail } from 'lucide-react';
import { supabase, rememberAuthReturn } from '../../supabaseClient';
import { PLATFORM_BRAND, PLATFORM_DOMAIN, onPlatformHost, platformOrigin, storesOrigin } from '../../platformBrand';
import { STORE_TEMPLATES, storeUrls } from '../../platformStores';
import { validateStoreSignup, slugify, TERMS_VERSION, SALES_CHANNELS } from '../../storeSignup';
import DesignStep from './DesignStep';
import ThemeToggle from '../../components/ThemeToggle';
import SocialButtons from '../../components/SocialButtons';
import CompleteProfile from '../../components/CompleteProfile';
import { validateSignup, needsProfile, cleanPhone, MIN_PASSWORD_LENGTH } from '../../profileCompletion';

// Alta de tienda por autoservicio: cuenta → tienda → diseño → lista.
// La tienda se crea al instante; las ventas se habilitan después de verificar al titular.

const PENDING_KEY = 'pending_store_name';

// Lo que se va escribiendo se guarda en la pestaña (sessionStorage): un F5 no borra nada.
// Nunca se guardan contraseñas. Al cerrar la pestaña se borra solo.
const DRAFT_KEY = 'vitrina_alta_borrador';
const PROGRESS_KEY = 'vitrina_alta_progreso'; // { storeId, designDone }

const readJson = (key) => { try { return JSON.parse(sessionStorage.getItem(key) || 'null'); } catch { return null; } };
const writeJson = (key, value) => { try { sessionStorage.setItem(key, JSON.stringify(value)); } catch { /* sin almacenamiento */ } };
const clearAlta = () => { try { sessionStorage.removeItem(DRAFT_KEY); sessionStorage.removeItem(PROGRESS_KEY); } catch { /* nada */ } };

// Como useState, pero el valor queda guardado en el borrador de la pestaña
function useDraft(field, initial) {
  const [value, setValue] = useState(() => readJson(DRAFT_KEY)?.[field] ?? initial);
  useEffect(() => { writeJson(DRAFT_KEY, { ...(readJson(DRAFT_KEY) || {}), [field]: value }); }, [field, value]);
  return [value, setValue];
}
const urlOptions = () => ({ origin: storesOrigin() || window.location.origin, platformDomain: PLATFORM_DOMAIN || null, platformOrigin: platformOrigin() });
const inputClass = 'w-full rounded-xl border border-zinc-300 bg-white px-4 py-3 text-base text-zinc-900 placeholder:text-zinc-400 focus:outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 transition dark:border-white/15 dark:bg-zinc-950 dark:text-white';

const STEP_LABELS = ['Tu cuenta', 'Tu tienda', 'Diseño', 'Lista'];

function Steps({ current }) {
  return (
    <ol className="grid grid-cols-4 max-w-md mx-auto mb-10" aria-label="Pasos para crear tu tienda">
      {STEP_LABELS.map((label, i) => {
        const done = i < current, active = i === current;
        return (
          <li key={label} aria-current={active ? 'step' : undefined} className="relative flex flex-col items-center text-center">
            {/* Tramo de línea desde el paso anterior (se pinta al llegar) */}
            {i > 0 && (
              <span aria-hidden="true" className={`absolute top-4 right-1/2 w-full h-0.5 -translate-y-1/2 transition-colors duration-300 ${i <= current ? 'bg-indigo-600' : 'bg-zinc-200 dark:bg-zinc-700'}`} />
            )}
            <span className={`relative z-10 w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold ring-4 ring-zinc-50 transition-colors duration-300 dark:ring-zinc-900 ${done ? 'bg-indigo-600 text-white' : active ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-600/30' : 'bg-white text-zinc-400 border-2 border-zinc-200 dark:bg-zinc-950 dark:border-white/10'}`}>
              {done ? <Check className="w-4 h-4" strokeWidth={3} /> : i + 1}
            </span>
            <span className={`mt-2 text-xs sm:text-sm ${active ? 'font-bold text-zinc-900 dark:text-white' : done ? 'font-medium text-zinc-600 dark:text-zinc-400' : 'text-zinc-400'}`}>{label}</span>
          </li>
        );
      })}
    </ol>
  );
}

function Field({ label, error, hint, children }) {
  return (
    <label className="block">
      <span className="block text-sm font-semibold text-zinc-700 mb-1.5 dark:text-zinc-300">{label}</span>
      {children}
      {error ? <span className="block mt-1.5 text-sm text-red-600 dark:text-red-400">{error}</span> : hint && <span className="block mt-1.5 text-xs text-zinc-500 dark:text-zinc-400">{hint}</span>}
    </label>
  );
}

function AccountStep({ onDone }) {
  const [mode, setMode] = useDraft('mode', 'signup'); // signup | login
  const [email, setEmail] = useDraft('email', '');
  const [password, setPassword] = useState('');
  const [passwordConfirm, setPasswordConfirm] = useState('');
  const [name, setName] = useDraft('ownerName', '');
  const [phone, setPhone] = useDraft('phone', '');
  const [fieldErrors, setFieldErrors] = useState({});
  const [error, setError] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [checkEmail, setCheckEmail] = useDraft('checkEmail', false);

  const submit = async (e) => {
    e.preventDefault();
    setError('');
    if (mode === 'signup') {
      const found = validateSignup({ name, phone, email, password, passwordConfirm });
      setFieldErrors(found);
      if (Object.keys(found).length) return;
    } else if (password.length < MIN_PASSWORD_LENGTH) { setError(`La contraseña tiene al menos ${MIN_PASSWORD_LENGTH} caracteres.`); return; }
    setIsSending(true);
    if (mode === 'signup') {
      rememberAuthReturn(`${window.location.origin}/crear`);
      const { data, error: signUpError } = await supabase.auth.signUp({
        email, password,
        options: {
          emailRedirectTo: `${window.location.origin}/crear`,
          data: { shipping: { name: name.trim(), phone: cleanPhone(phone) } }
        }
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
        <Mail className="w-12 h-12 text-indigo-600 mx-auto dark:text-indigo-400" />
        <h2 className="mt-4 text-xl font-bold text-zinc-900 dark:text-white">Confirmá tu email</h2>
        <p className="mt-2 text-zinc-600 dark:text-zinc-400">Te mandamos un enlace a <b>{email}</b>. Tocalo y volvés acá para terminar de crear tu tienda.</p>
      </div>
    );
  }

  return (
    <div className="space-y-5">
    <SocialButtons redirectTo={`${window.location.origin}/crear`} dividerLabel="o con tu email" />
    <form onSubmit={submit} noValidate className="space-y-4">
      <div className="grid grid-cols-2 rounded-xl bg-zinc-100 p-1 text-sm font-semibold dark:bg-zinc-800" role="tablist">
        {[['signup', 'Crear cuenta'], ['login', 'Ya tengo cuenta']].map(([id, label]) => (
          <button key={id} type="button" role="tab" aria-selected={mode === id} onClick={() => { setMode(id); setError(''); setFieldErrors({}); }}
            className={`rounded-lg py-2 transition ${mode === id ? 'bg-white shadow text-zinc-900 dark:bg-zinc-950 dark:text-white' : 'text-zinc-500 dark:text-zinc-400'}`}>{label}</button>
        ))}
      </div>
      {mode === 'signup' && (
        <div className="grid sm:grid-cols-2 gap-4">
          <Field label="Nombre y apellido" error={fieldErrors.name}>
            <input className={inputClass} autoComplete="name" value={name} onChange={(e) => setName(e.target.value)} />
          </Field>
          <Field label="Celular" error={fieldErrors.phone}>
            <input className={inputClass} type="tel" autoComplete="tel" placeholder="291 555 1234" value={phone} onChange={(e) => setPhone(e.target.value)} />
          </Field>
        </div>
      )}
      <Field label="Email" error={fieldErrors.email}>
        <input className={inputClass} type="email" required autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} />
      </Field>
      <Field label="Contraseña" error={fieldErrors.password} hint={mode === 'signup' ? `Mínimo ${MIN_PASSWORD_LENGTH} caracteres.` : undefined}>
        <input className={inputClass} type="password" required autoComplete={mode === 'signup' ? 'new-password' : 'current-password'} value={password} onChange={(e) => setPassword(e.target.value)} />
      </Field>
      {mode === 'signup' && (
        <Field label="Repetí la contraseña" error={fieldErrors.passwordConfirm}>
          <input className={inputClass} type="password" autoComplete="new-password" value={passwordConfirm} onChange={(e) => setPasswordConfirm(e.target.value)} />
        </Field>
      )}
      {error && <p role="alert" className="text-sm text-red-600 dark:text-red-400">{error}</p>}
      <button type="submit" disabled={isSending} className="w-full inline-flex items-center justify-center gap-2 rounded-full bg-indigo-600 text-white font-bold px-6 py-3.5 hover:bg-indigo-500 transition disabled:opacity-60">
        {isSending && <Loader2 className="w-5 h-5 animate-spin" />} Continuar <ArrowRight className="w-4 h-4" />
      </button>
    </form>
    </div>
  );
}

function StoreStep({ onCreated }) {
  const [name, setName] = useDraft('storeName', (() => { try { return localStorage.getItem(PENDING_KEY) || ''; } catch { return ''; } })());
  const [slug, setSlug] = useDraft('slug', '');
  const [slugTouched, setSlugTouched] = useDraft('slugTouched', false);
  const [template, setTemplate] = useDraft('template', '');
  const [accepted, setAccepted] = useDraft('accepted', false);
  const [whatsapp, setWhatsapp] = useDraft('whatsapp', '');
  const [channels, setChannels] = useDraft('channels', []);
  // El CUIL/CUIT no se guarda en el borrador: queda solo en memoria hasta enviarlo
  const [taxId, setTaxId] = useState('');
  const [errors, setErrors] = useState({});

  // WhatsApp: arranca con el teléfono de la cuenta
  useEffect(() => {
    if (whatsapp) return;
    supabase.auth.getSession().then(({ data }) => {
      const phone = data.session?.user?.user_metadata?.shipping?.phone;
      if (phone) setWhatsapp(phone);
    });
  }, []); // eslint-disable-line react-hooks/exhaustive-deps
  // "Todavía no vendo" no se combina con los demás
  const toggleChannel = (id) => setChannels(list => (list.includes(id) ? list.filter(x => x !== id)
    : id === 'ninguno' ? ['ninguno'] : [...list.filter(x => x !== 'ninguno'), id]));
  const [message, setMessage] = useState('');
  const [isSending, setIsSending] = useState(false);

  const finalSlug = slugTouched ? slug : slugify(name);
  const preview = storeUrls({ slug: finalSlug || 'tu-tienda' }, urlOptions()).storefront.replace(/^https?:\/\//, '');

  const submit = async (e) => {
    e.preventDefault();
    const payload = { action: 'create', name, slug: finalSlug, template, tax_id: taxId, whatsapp, sales_channels: channels, accepted_terms: accepted, terms_version: TERMS_VERSION };
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
          ? <>Estás en la versión local: crear la tienda necesita el servidor publicado. Seguí en <a className="underline font-semibold" href="https://nova3d-ecommerce.vercel.app/crear">nova3d-ecommerce.vercel.app/crear</a> e iniciá sesión con esta misma cuenta.</>
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
      <Field label="Dirección de tu tienda" error={errors.slug} hint={<>Así va a quedar: <b className="text-zinc-700 dark:text-zinc-300">{preview}</b></>}>
        <input className={`${inputClass} font-mono`} value={finalSlug} onChange={(e) => { setSlugTouched(true); setSlug(e.target.value.toLowerCase()); setErrors(x => ({ ...x, slug: undefined })); }} />
      </Field>
      <Field label="¿Qué vendés?" error={errors.template}>
        <select className={inputClass} value={template} onChange={(e) => { setTemplate(e.target.value); setErrors(x => ({ ...x, template: undefined })); }}>
          <option value="">Elegí tu rubro...</option>
          {STORE_TEMPLATES.map(t => <option key={t.id} value={t.id}>{t.label}</option>)}
        </select>
      </Field>
      <div className="grid sm:grid-cols-2 gap-4">
        <Field label="CUIL (mayor de 18) o CUIT" error={errors.tax_id} hint="El de la cuenta bancaria donde vas a cobrar. No hace falta estar inscripto.">
          <input className={`${inputClass} font-mono`} inputMode="numeric" autoComplete="off" maxLength={13} placeholder="20-12345678-9"
            value={taxId} onChange={(e) => { setTaxId(e.target.value.replace(/[^\d-]/g, '')); setErrors(x => ({ ...x, tax_id: undefined })); }} />
        </Field>
        <Field label="WhatsApp" error={errors.whatsapp} hint="Para avisarte de ventas y ayudarte a arrancar.">
          <input className={inputClass} type="tel" inputMode="tel" autoComplete="tel" placeholder="11 2345 6789"
            value={whatsapp} onChange={(e) => { setWhatsapp(e.target.value); setErrors(x => ({ ...x, whatsapp: undefined })); }} />
        </Field>
      </div>
      <fieldset>
        <legend className="block text-sm font-semibold text-zinc-700 dark:text-zinc-300 mb-1.5">¿Dónde vendés hoy? <span className="font-normal text-zinc-500 dark:text-zinc-400">(opcional)</span></legend>
        <div className="flex flex-wrap gap-2">
          {SALES_CHANNELS.map(c => {
            const on = channels.includes(c.id);
            return (
              <button key={c.id} type="button" aria-pressed={on} onClick={() => toggleChannel(c.id)}
                className={`min-h-10 px-3.5 rounded-full border text-sm font-semibold transition ${on ? 'border-indigo-600 bg-indigo-600 text-white' : 'border-zinc-300 text-zinc-700 hover:border-zinc-400 dark:border-white/15 dark:text-zinc-300 dark:hover:border-white/30'}`}>
                {on && <Check className="inline w-4 h-4 -mt-0.5 mr-1" />}{c.label}
              </button>
            );
          })}
        </div>
        <p className="mt-1.5 text-xs text-zinc-500 dark:text-zinc-400">Así te mostramos primero lo que más te sirve.</p>
      </fieldset>
      <label className="flex items-start gap-3 text-sm text-zinc-700 dark:text-zinc-300">
        <input type="checkbox" className="mt-0.5 w-5 h-5 rounded accent-indigo-600 shrink-0" checked={accepted} onChange={(e) => { setAccepted(e.target.checked); setErrors(x => ({ ...x, accepted_terms: undefined })); }} />
        <span>Acepto los <Link to="/terminos" target="_blank" className="font-semibold text-indigo-600 underline dark:text-indigo-400">términos del servicio y la política de privacidad</Link>.</span>
      </label>
      {errors.accepted_terms && <p className="text-sm text-red-600 dark:text-red-400">{errors.accepted_terms}</p>}
      {message && <p role="alert" className="text-sm text-red-600 dark:text-red-400">{message}</p>}
      <button type="submit" disabled={isSending} className="w-full inline-flex items-center justify-center gap-2 rounded-full bg-indigo-600 text-white font-bold px-6 py-3.5 hover:bg-indigo-500 transition disabled:opacity-60">
        {isSending && <Loader2 className="w-5 h-5 animate-spin" />} Crear mi tienda
      </button>
    </form>
  );
}

function DoneStep({ store, existing, onSwitchAccount }) {
  const urls = storeUrls(store, urlOptions());
  return (
    <div>
      <div className="text-center">
        <span className="w-14 h-14 rounded-full bg-emerald-100 text-emerald-600 inline-flex items-center justify-center"><Store className="w-7 h-7" /></span>
        <h2 className="mt-4 text-2xl font-extrabold text-zinc-900 dark:text-white">{existing ? `Ya tenés tu tienda: ${store.name}` : `¡${store.name} está creada!`}</h2>
        <p className="mt-2 text-zinc-600 dark:text-zinc-400">
          {existing
            ? <>Cada cuenta puede tener una tienda. Entrá a tu panel para seguir con <b>{store.name}</b>, o usá otro email para crear una nueva.</>
            : 'Ya podés cargar productos y personalizarla.'}
        </p>
      </div>
      <div className="mt-6 grid sm:grid-cols-2 gap-3">
        <a href={urls.admin} className="inline-flex items-center justify-center gap-2 rounded-full bg-indigo-600 text-white font-bold px-6 py-3.5 hover:bg-indigo-500 transition">
          <LayoutDashboard className="w-4 h-4" /> Ir a mi panel
        </a>
        <a href={urls.storefront} target="_blank" rel="noopener noreferrer" className="inline-flex items-center justify-center gap-2 rounded-full border border-zinc-300 font-bold px-6 py-3.5 hover:bg-zinc-50 transition dark:border-white/15 dark:hover:bg-white/5">
          Ver mi tienda <ExternalLink className="w-4 h-4" />
        </a>
      </div>
      {existing && (
        <button type="button" onClick={onSwitchAccount} className="mt-3 w-full text-sm font-semibold text-zinc-500 hover:text-zinc-900 py-2 dark:text-zinc-400 dark:hover:text-white">
          Crear otra tienda con otro email
        </button>
      )}
      <div className="mt-8 rounded-2xl bg-zinc-50 border border-zinc-200 p-5 dark:bg-zinc-900 dark:border-white/10">
        <p className="font-bold text-zinc-900 dark:text-white">Próximos pasos</p>
        <ol className="mt-3 space-y-2 text-sm text-zinc-600 list-decimal list-inside dark:text-zinc-400">
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
  // stores: undefined = buscando las tiendas de la cuenta; luego { store, existing } o null
  const [found, setFound] = useState(undefined);
  const [designDone, setDesignDone] = useState(() => Boolean(readJson(PROGRESS_KEY)?.designDone));

  useEffect(() => {
    document.title = `Creá tu tienda | ${PLATFORM_BRAND.name}`;
    supabase.auth.getSession().then(({ data }) => setSession(data.session));
    const { data: listener } = supabase.auth.onAuthStateChange((_e, s) => setSession(s));
    return () => listener.subscription.unsubscribe();
  }, []);

  // ¿La cuenta ya tiene tienda? Si la creó en esta misma pestaña (progreso guardado), se retoma
  // donde estaba (por ejemplo, en Diseño). Si ya la tenía de antes, se muestra cuál es.
  const userId = session?.user?.id;
  useEffect(() => {
    if (!userId) { setFound(undefined); return; }
    let cancelled = false;
    (async () => {
      const { data } = await supabase.rpc('my_stores');
      const own = (data || []).find(s => s.role === 'owner');
      if (!own) { if (!cancelled) setFound(null); return; }
      // Con la marca completa (el paso Diseño arranca del estilo que ya tiene)
      const { data: full } = await supabase.rpc('get_store_by_slug', { p_slug: own.slug });
      const progress = readJson(PROGRESS_KEY);
      if (!cancelled) setFound({ store: { ...own, ...(full || {}) }, existing: progress?.storeId !== own.id });
    })();
    return () => { cancelled = true; };
  }, [userId]);

  const onCreated = (created) => {
    writeJson(PROGRESS_KEY, { storeId: created.id, designDone: false });
    try { sessionStorage.removeItem(DRAFT_KEY); } catch { /* nada */ }
    setFound({ store: created, existing: false });
  };
  const onDesignDone = () => {
    writeJson(PROGRESS_KEY, { ...(readJson(PROGRESS_KEY) || {}), designDone: true });
    setDesignDone(true);
  };
  const signOut = async () => {
    clearAlta();
    setFound(undefined);
    setDesignDone(false);
    await supabase.auth.signOut();
  };

  const store = found?.store || null;
  const existing = Boolean(found?.existing);
  const profileMissing = Boolean(session) && needsProfile(session.user);
  const loading = session === undefined || (session && !profileMissing && found === undefined);
  const step = !session || profileMissing ? 0 : !store ? 1 : existing || designDone ? 3 : 2;
  const TITLES = ['Creá tu tienda gratis', 'Contanos de tu tienda', 'Elegí cómo se ve', existing ? 'Ya tenés tu tienda' : '¡Listo!'];
  const SUBTITLES = ['En 2 minutos tenés tu tienda online. Sin tarjeta.', 'Lo podés cambiar después desde tu panel.', 'Elegí lo básico; lo vas viendo en la vista previa.'];

  return (
    <div className="min-h-screen bg-zinc-50 text-zinc-900 dark:bg-zinc-900 dark:text-white">
      <header className="bg-white border-b border-zinc-200 dark:bg-zinc-950 dark:border-white/10">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
          <Link to={onPlatformHost() ? '/' : '/inicio'} className="text-xl font-extrabold tracking-tight">{PLATFORM_BRAND.name}<span className="text-indigo-600 dark:text-indigo-400">.</span></Link>
          <span className="flex items-center gap-3 text-sm text-zinc-500 min-w-0 dark:text-zinc-400">
            {session && (
              <>
                <span className="hidden sm:inline truncate max-w-[16rem]">{session.user.email}</span>
                <button type="button" onClick={signOut} className="font-semibold hover:text-zinc-900 dark:hover:text-white">Salir</button>
              </>
            )}
            <ThemeToggle />
          </span>
        </div>
      </header>
      <main className={`${step === 2 ? 'max-w-4xl' : 'max-w-lg'} mx-auto px-4 sm:px-6 py-10 md:py-14`}>
        {loading ? (
          <div className="flex justify-center py-20"><Loader2 className="w-8 h-8 animate-spin text-indigo-600 dark:text-indigo-400" /></div>
        ) : (
          <>
            <Steps current={step} />
            <div className="text-center">
              <h1 className="text-3xl font-extrabold tracking-tight">{TITLES[step]}</h1>
              {step < 3 && <p className="mt-2 text-zinc-600 dark:text-zinc-400">{SUBTITLES[step]}</p>}
            </div>
            <div className="mt-8 rounded-2xl bg-white border border-zinc-200 p-6 sm:p-8 shadow-sm dark:bg-zinc-950 dark:border-white/10">
              {step === 0 && (profileMissing
                ? <CompleteProfile user={session.user} variant="platform" onSignOut={signOut} />
                : <AccountStep onDone={() => supabase.auth.getSession().then(({ data }) => setSession(data.session))} />)}
              {step === 1 && <StoreStep onCreated={onCreated} />}
              {step === 2 && <DesignStep store={store} onDone={onDesignDone} />}
              {step === 3 && <DoneStep store={store} existing={existing} onSwitchAccount={signOut} />}
            </div>
          </>
        )}
      </main>
    </div>
  );
}
