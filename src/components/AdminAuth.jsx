import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Lock, Loader2, Eye, EyeOff, ShieldCheck, Smartphone } from 'lucide-react';
import { supabase } from '../supabaseClient';
import { isAdminUser } from '../adminAccess';
import { useStore } from '../context/StoreContext';

// Puerta de entrada de los paneles.
//   mode="store"     panel de una tienda: entra quien la administra (lo decide la base)
//   mode="platform"  superadmin: rol de plataforma + verificación en dos pasos obligatoria
//   mode="account"   solo pide sesión (lista "mis tiendas")
// Quien tiene la verificación en dos pasos activada siempre tiene que ingresar el código:
// sin él, la base no le reconoce permisos de plataforma (supabase/009_seguridad_superadmin.sql).

// Nivel de verificación de la sesión, tal como lo ve la base ("aal1" o "aal2")
const tokenAal = (session) => {
  try {
    const payload = session.access_token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/');
    return JSON.parse(atob(payload)).aal || 'aal1';
  } catch {
    return 'aal1';
  }
};

const inputClass = 'w-full bg-black border border-white/10 rounded-xl px-4 py-3.5 text-white focus:outline-none focus:border-indigo-500 transition';
const primaryButton = 'w-full bg-indigo-600 hover:bg-indigo-500 text-white font-bold py-3.5 rounded-xl transition-all uppercase tracking-widest text-xs disabled:opacity-60 flex items-center justify-center gap-2';

function Card({ icon: Icon = Lock, title, subtitle, children, footer }) {
  return (
    <div className="min-h-screen bg-zinc-950 flex flex-col items-center justify-center p-4">
      <div className="bg-[#0a0a0a] border border-white/10 p-8 rounded-3xl w-full max-w-md shadow-2xl relative overflow-hidden">
        <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-indigo-500 via-purple-500 to-emerald-500" />
        <div className="flex justify-center mb-6">
          <div className="w-14 h-14 bg-white/5 border border-white/10 rounded-2xl flex items-center justify-center">
            <Icon className="w-7 h-7 text-indigo-400" />
          </div>
        </div>
        <h1 className="text-2xl font-black text-white text-center mb-2 tracking-tight">{title}</h1>
        {subtitle && <p className="text-sm text-zinc-400 text-center mb-6 break-words">{subtitle}</p>}
        <div className="relative z-10">{children}</div>
      </div>
      {footer}
    </div>
  );
}

const Spinner = () => (
  <div className="min-h-screen bg-zinc-950 flex items-center justify-center"><Loader2 className="w-8 h-8 text-indigo-500 animate-spin" /></div>
);

function LoginForm() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleLogin = async (e) => {
    e.preventDefault();
    setError('');
    setIsSubmitting(true);
    const { error: signInError } = await supabase.auth.signInWithPassword({ email, password });
    // Mismo mensaje para email inexistente y clave incorrecta: no revela qué cuentas existen
    if (signInError) setError('Email o contraseña incorrectos.');
    setPassword('');
    setIsSubmitting(false);
  };

  return (
    <form onSubmit={handleLogin} className="space-y-4">
      <input type="email" placeholder="Email" autoComplete="username" value={email} onChange={(e) => setEmail(e.target.value)} className={inputClass} required autoFocus />
      <div className="relative">
        <input type={showPassword ? 'text' : 'password'} placeholder="Contraseña" autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} className={`${inputClass} pr-12`} required />
        <button type="button" onClick={() => setShowPassword(!showPassword)} aria-label={showPassword ? 'Ocultar contraseña' : 'Mostrar contraseña'} className="absolute right-1 top-1/2 -translate-y-1/2 p-3 text-zinc-500 hover:text-white transition-colors">
          {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
        </button>
      </div>
      {error && <p role="alert" className="text-xs font-bold text-red-500 text-center">{error}</p>}
      <button type="submit" disabled={isSubmitting} className={primaryButton}>
        {isSubmitting && <Loader2 className="w-4 h-4 animate-spin" />} Ingresar
      </button>
    </form>
  );
}

function CodeInput({ value, onChange }) {
  return (
    <input
      value={value}
      onChange={(e) => onChange(e.target.value.replace(/\D/g, '').slice(0, 6))}
      inputMode="numeric"
      autoComplete="one-time-code"
      autoFocus
      placeholder="000000"
      aria-label="Código de 6 dígitos"
      className={`${inputClass} text-center text-2xl tracking-[0.5em] font-mono`}
    />
  );
}

// Pide el código de la app del celular y sube la sesión a "aal2"
function MfaChallenge({ factorId }) {
  const [code, setCode] = useState('');
  const [error, setError] = useState('');
  const [isSending, setIsSending] = useState(false);

  const verify = async (e) => {
    e.preventDefault();
    setIsSending(true);
    setError('');
    const { error: verifyError } = await supabase.auth.mfa.challengeAndVerify({ factorId, code });
    if (verifyError) { setError('Código incorrecto o vencido. Probá con el que muestra ahora la app.'); setCode(''); }
    setIsSending(false);
  };

  return (
    <form onSubmit={verify} className="space-y-4">
      <CodeInput value={code} onChange={setCode} />
      {error && <p role="alert" className="text-xs font-bold text-red-500 text-center">{error}</p>}
      <button type="submit" disabled={isSending || code.length !== 6} className={primaryButton}>
        {isSending && <Loader2 className="w-4 h-4 animate-spin" />} Verificar
      </button>
    </form>
  );
}

// Primera vez: vincula la app del celular (Google Authenticator, Authy, 1Password...) con un QR
function MfaEnroll() {
  const [factor, setFactor] = useState(null); // { id, qr, secret }
  const [error, setError] = useState('');

  useEffect(() => {
    let cancelled = false;
    (async () => {
      // Si quedó una vinculación a medias, se descarta y se empieza de nuevo
      const { data: list } = await supabase.auth.mfa.listFactors();
      for (const f of list?.all || []) {
        if (f.status !== 'verified') await supabase.auth.mfa.unenroll({ factorId: f.id });
      }
      const { data, error: enrollError } = await supabase.auth.mfa.enroll({ factorType: 'totp', friendlyName: `Superadmin ${new Date().toISOString().slice(0, 10)}` });
      if (cancelled) return;
      if (enrollError) setError('No pudimos iniciar la verificación en dos pasos. Revisá que esté habilitada en Supabase (Authentication → Multi-Factor).');
      else setFactor({ id: data.id, qr: data.totp.qr_code, secret: data.totp.secret });
    })();
    return () => { cancelled = true; };
  }, []);

  if (error) return <p role="alert" className="text-sm text-red-400 text-center">{error}</p>;
  if (!factor) return <div className="flex justify-center py-8"><Loader2 className="w-6 h-6 text-indigo-500 animate-spin" /></div>;

  return (
    <div className="space-y-5">
      <ol className="text-sm text-zinc-400 space-y-1.5 list-decimal list-inside">
        <li>Instalá <b className="text-zinc-200">Google Authenticator</b> o <b className="text-zinc-200">Authy</b> en tu celular.</li>
        <li>Tocá <b className="text-zinc-200">+</b> y escaneá este código.</li>
        <li>Escribí el número de 6 dígitos que te muestra.</li>
      </ol>
      <div className="bg-white rounded-2xl p-3 w-48 h-48 mx-auto">
        <img src={factor.qr} alt="Código QR para la app de verificación" className="w-full h-full" />
      </div>
      <details className="text-xs text-zinc-500 text-center">
        <summary className="cursor-pointer hover:text-zinc-300">¿No podés escanear? Cargá la clave a mano</summary>
        <code className="mt-2 block break-all text-zinc-300 select-all">{factor.secret}</code>
      </details>
      <MfaChallenge factorId={factor.id} />
    </div>
  );
}

function SignOutButton() {
  return (
    <button type="button" onClick={() => supabase.auth.signOut()} className="w-full bg-white/10 hover:bg-white/15 text-white font-bold py-3.5 rounded-xl transition-all uppercase tracking-widest text-xs">
      Cerrar sesión
    </button>
  );
}

export default function AdminAuth({ children, mode = 'store', platformOnly = false }) {
  const gate = platformOnly ? 'platform' : mode;
  const { store } = useStore();
  // session: undefined = todavía verificando, null = sin sesión
  const [session, setSession] = useState(undefined);
  // mfa: { key, factorId } — factorId de la app vinculada, o null si no tiene
  const [mfa, setMfa] = useState(null);
  const [access, setAccess] = useState(null); // { key, allowed }

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setSession(data.session));
    const { data: listener } = supabase.auth.onAuthStateChange((_event, newSession) => setSession(newSession));
    return () => listener.subscription.unsubscribe();
  }, []);

  const aal = session ? tokenAal(session) : null;
  const userId = session?.user?.id;

  // ¿Tiene la verificación en dos pasos activada?
  useEffect(() => {
    if (!userId) return;
    let cancelled = false;
    supabase.auth.mfa.listFactors().then(({ data }) => {
      if (!cancelled) setMfa({ key: userId, factorId: data?.totp?.[0]?.id || null });
    });
    return () => { cancelled = true; };
  }, [userId]);

  const mfaReady = Boolean(userId) && mfa?.key === userId;
  const needsCode = mfaReady && mfa.factorId && aal !== 'aal2';

  // ¿Puede entrar? (una vez que, si tiene la app vinculada, ya ingresó el código)
  const accessKey = session && mfaReady && !needsCode ? `${gate}:${userId}:${aal}:${store?.id || ''}` : null;
  useEffect(() => {
    if (!accessKey || gate === 'account') return;
    if (gate === 'store' && (!store || store.notFound)) return;
    let cancelled = false;
    (async () => {
      let allowed;
      if (gate === 'platform') {
        allowed = isAdminUser(session.user);
        if (!allowed) {
          // El rol viaja dentro del token: si se asignó después de iniciar sesión, se pide uno nuevo
          const { data } = await supabase.auth.refreshSession();
          allowed = isAdminUser(data?.session?.user);
        }
      } else {
        const { data } = await supabase.rpc('is_store_admin', { p_store_id: store.id });
        allowed = data === true;
      }
      if (!cancelled) setAccess({ key: accessKey, allowed });
    })();
    return () => { cancelled = true; };
    // session y store cambian de objeto sin cambiar de usuario o tienda: alcanza con la clave
  }, [accessKey]);

  const backLink = <Link to={gate === 'store' ? '/panel' : '/'} className="mt-6 text-sm text-zinc-500 hover:text-white transition-colors">{gate === 'store' ? 'Ver mis tiendas' : 'Volver'}</Link>;

  if (session === undefined) return <Spinner />;

  if (!session) {
    const subtitle = gate === 'platform' ? 'Acceso restringido.' : gate === 'store' && store?.name ? `Panel de ${store.name}` : 'Ingresá para administrar tu tienda.';
    return <Card title={gate === 'platform' ? 'Superadmin' : 'Ingresar'} subtitle={subtitle} footer={backLink}><LoginForm /></Card>;
  }

  if (!mfaReady) return <Spinner />;

  if (needsCode) {
    return (
      <Card icon={Smartphone} title="Verificación en dos pasos" subtitle="Escribí el código de 6 dígitos que muestra la app de tu celular." footer={backLink}>
        <MfaChallenge factorId={mfa.factorId} />
        <button type="button" onClick={() => supabase.auth.signOut()} className="mt-4 w-full text-xs text-zinc-500 hover:text-white">Usar otra cuenta</button>
      </Card>
    );
  }

  if (gate === 'account') return children;

  if (gate === 'store' && store?.notFound) {
    return <Card title="Esa tienda no existe" subtitle={`No encontramos ninguna tienda llamada "${store.slug}".`} footer={backLink}><SignOutButton /></Card>;
  }

  if (!store && gate === 'store') return <Spinner />;
  if (access?.key !== accessKey) return <Spinner />;

  if (!access.allowed) {
    return (
      <Card title="Acceso restringido" subtitle={`La cuenta ${session.user.email} no ${gate === 'platform' ? 'tiene acceso a esta sección' : `administra ${store?.name || 'esta tienda'}`}.`} footer={backLink}>
        <SignOutButton />
      </Card>
    );
  }

  // Superadmin: la verificación en dos pasos es obligatoria
  if (gate === 'platform' && aal !== 'aal2') {
    return (
      <Card icon={ShieldCheck} title="Activá la verificación en dos pasos" subtitle="Para entrar al superadmin, además de la contraseña vas a necesitar un código de tu celular." footer={backLink}>
        <MfaEnroll />
      </Card>
    );
  }

  return children;
}
