import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Store, Plus, ExternalLink, LayoutDashboard, Globe, Users, Loader2, X, AlertTriangle, CheckCircle2, RefreshCw, Pause, Play, Trash2, LogOut, Copy } from 'lucide-react';
import { supabase } from '../../supabaseClient';
import { formatMoney } from '../../pricing';
import RequestsList from './RequestsList';
import { STORE_TEMPLATES, slugify, slugError, normalizeDomain, isValidDomain, storeUrls } from '../../platformStores';

async function callPlatformApi(options = {}) {
  const { data } = await supabase.auth.getSession();
  const response = await fetch('/api/platform-stores', {
    ...options,
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${data.session?.access_token || ''}` }
  });
  const body = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(response.status === 404
      ? 'El panel de plataforma funciona en la versión publicada (necesita las funciones de Vercel).'
      : body.message || 'No se pudo completar la acción.');
  }
  return body;
}

const DOMAIN_STATUS = {
  active: { label: 'Funcionando', tone: 'text-emerald-300 bg-emerald-500/10' },
  dns: { label: 'Falta configurar DNS', tone: 'text-amber-300 bg-amber-500/10' },
  verify: { label: 'Falta verificar', tone: 'text-amber-300 bg-amber-500/10' },
  missing: { label: 'No está en Vercel', tone: 'text-red-300 bg-red-500/10' },
  unknown: { label: 'Agregar en Vercel a mano', tone: 'text-zinc-300 bg-white/10' }
};

const inputClass = 'w-full bg-black border border-white/10 rounded-xl px-3.5 py-2.5 text-sm text-white placeholder:text-zinc-600 focus:outline-none focus:border-indigo-500 transition';

export default function PlatformPage() {
  const [data, setData] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [view, setView] = useState('stores'); // stores | requests
  const [dialog, setDialog] = useState(null); // { type: 'create' | 'domain' | 'owner', store? }
  const [notice, setNotice] = useState(null);
  const [busyId, setBusyId] = useState(null);

  const load = useCallback(async () => {
    setIsLoading(true);
    setLoadError('');
    try {
      setData(await callPlatformApi());
    } catch (error) {
      setLoadError(error.message);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    if (!notice) return;
    const timer = setTimeout(() => setNotice(null), 6000);
    return () => clearTimeout(timer);
  }, [notice]);

  // Ejecuta una acción, avisa el resultado y recarga la lista
  const run = async (payload, busyKey) => {
    setBusyId(busyKey || null);
    try {
      const body = await callPlatformApi({ method: 'POST', body: JSON.stringify(payload) });
      setNotice({ type: 'ok', text: body.message });
      setDialog(null);
      await load();
      return true;
    } catch (error) {
      setNotice({ type: 'error', text: error.message });
      return false;
    } finally {
      setBusyId(null);
    }
  };

  const stores = data?.stores || [];
  const requests = data ? data.requests : [];
  const newRequests = (requests || []).filter(r => r.status === 'nueva').length;
  const origin = window.location.origin;
  const totals = [
    { label: 'Tiendas', value: stores.length },
    { label: 'Activas', value: stores.filter(s => s.status === 'active').length },
    { label: 'Productos', value: stores.reduce((n, s) => n + s.productCount, 0) },
    { label: 'Ventas', value: formatMoney(stores.reduce((n, s) => n + s.revenue, 0)) }
  ];

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-300">
      <header className="h-16 border-b border-white/5 bg-black/80 backdrop-blur sticky top-0 z-30">
        <div className="max-w-6xl mx-auto h-full px-4 sm:px-6 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 bg-gradient-to-br from-indigo-500 to-indigo-700 rounded-lg flex items-center justify-center text-white">
              <Store className="w-4 h-4" />
            </div>
            <div>
              <p className="font-black text-white text-sm leading-none">Plataforma</p>
              <p className="text-[10px] text-zinc-500 font-bold uppercase tracking-widest mt-0.5">Tus tiendas</p>
            </div>
          </div>
          <button
            type="button"
            onClick={async () => { await supabase.auth.signOut(); window.location.href = '/'; }}
            className="inline-flex items-center gap-2 text-xs font-bold text-zinc-500 hover:text-red-400 transition"
          >
            <LogOut className="w-4 h-4" /> <span className="hidden sm:inline">Cerrar sesión</span>
          </button>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-4 sm:px-6 py-8 space-y-6">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div>
            <h1 className="text-3xl sm:text-4xl font-black text-white tracking-tight">Tiendas</h1>
            <p className="text-sm text-zinc-400 mt-1">Creá tiendas, conectá sus dominios y asigná a sus dueños.</p>
          </div>
          <div className="flex gap-2">
            <button type="button" onClick={load} disabled={isLoading} aria-label="Actualizar" className="p-2.5 rounded-xl bg-white/5 border border-white/10 hover:bg-white/10 text-white transition disabled:opacity-50">
              <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
            </button>
            <button type="button" onClick={() => setDialog({ type: 'create' })} className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-sm font-bold text-white transition">
              <Plus className="w-4 h-4" /> Nueva tienda
            </button>
          </div>
        </div>

        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          {totals.map(t => (
            <div key={t.label} className="bg-black border border-white/10 rounded-2xl p-4 sm:p-5">
              <p className="text-[10px] font-bold uppercase tracking-widest text-zinc-500">{t.label}</p>
              <p className="mt-1 text-2xl font-black text-white tabular-nums truncate">{isLoading && !data ? '–' : t.value}</p>
            </div>
          ))}
        </div>

        {data && !data.vercelConfigured && (
          <div className="flex gap-3 rounded-2xl border border-amber-500/20 bg-amber-500/5 p-4 text-sm text-amber-100/90">
            <AlertTriangle className="w-5 h-5 shrink-0 text-amber-400" />
            <p>
              Vercel no está conectado: los dominios propios se guardan, pero hay que agregarlos a mano en tu proyecto de Vercel
              (Settings → Domains). Para que se agreguen solos, cargá <code className="text-amber-300">VERCEL_TOKEN</code> y <code className="text-amber-300">VERCEL_PROJECT_ID</code> en Vercel.
            </p>
          </div>
        )}

        <div className="flex gap-2 border-b border-white/10 pb-4" role="tablist">
          {[['stores', 'Tiendas', stores.length], ['requests', 'Solicitudes', newRequests]].map(([id, label, count]) => (
            <button
              key={id}
              type="button"
              role="tab"
              aria-selected={view === id}
              onClick={() => setView(id)}
              className={`inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-bold transition ${view === id ? 'bg-white/10 text-white' : 'text-zinc-500 hover:text-white hover:bg-white/5'}`}
            >
              {label}
              {count > 0 && <span className={`min-w-5 px-1.5 py-0.5 rounded-full text-[10px] ${id === 'requests' ? 'bg-indigo-600 text-white' : 'bg-white/10 text-zinc-300'}`}>{count}</span>}
            </button>
          ))}
        </div>

        {isLoading && !data ? (
          <div className="p-12 flex items-center justify-center gap-3 text-zinc-500"><Loader2 className="w-5 h-5 animate-spin" /> Cargando tiendas...</div>
        ) : loadError ? (
          <div className="p-10 text-center bg-black border border-white/10 rounded-2xl">
            <AlertTriangle className="w-10 h-10 text-amber-400/70 mx-auto mb-3" />
            <p className="text-sm text-zinc-300 max-w-md mx-auto">{loadError}</p>
          </div>
        ) : view === 'requests' ? (
          <RequestsList
            requests={requests}
            onUpdate={(requestId, changes) => run({ action: 'updateRequest', requestId, ...changes })}
            onCreateStore={(request) => setDialog({ type: 'create', request })}
          />
        ) : (
          <ul className="space-y-4">
            {stores.map(store => (
              <StoreCard
                key={store.id}
                store={store}
                urls={storeUrls(store, { origin, platformDomain: data.platformDomain })}
                busy={busyId === store.id}
                onToggleStatus={() => run({ action: 'update', storeId: store.id, status: store.status === 'active' ? 'suspended' : 'active' }, store.id)}
                onToggleSales={() => run({ action: 'update', storeId: store.id, salesEnabled: store.sales_enabled === false }, store.id)}
                onDomain={() => setDialog({ type: 'domain', store })}
                onAddOwner={() => setDialog({ type: 'owner', store })}
                onRemoveOwner={(owner) => {
                  if (window.confirm(`¿Quitarle a ${owner.email} el acceso a ${store.name}?`)) {
                    run({ action: 'removeOwner', storeId: store.id, userId: owner.userId }, store.id);
                  }
                }}
              />
            ))}
          </ul>
        )}

        <p className="text-xs text-zinc-600 pt-2">
          <Link to="/admin" className="hover:text-zinc-400">← Volver al panel de la tienda</Link>
        </p>
      </main>

      {dialog?.type === 'create' && (
        <CreateStoreDialog
          stores={stores}
          request={dialog.request}
          onClose={() => setDialog(null)}
          onSubmit={(payload) => run({ action: 'create', ...payload, fromRequest: dialog.request?.id || null })}
        />
      )}
      {dialog?.type === 'domain' && <DomainDialog store={dialog.store} onClose={() => setDialog(null)} onSubmit={(domain) => run({ action: 'setDomain', storeId: dialog.store.id, domain })} />}
      {dialog?.type === 'owner' && <OwnerDialog store={dialog.store} onClose={() => setDialog(null)} onSubmit={(email) => run({ action: 'addOwner', storeId: dialog.store.id, email })} />}

      {notice && (
        <div role="status" className={`fixed bottom-6 right-4 left-4 sm:left-auto sm:max-w-sm z-[70] flex items-start gap-3 rounded-xl border px-4 py-3 text-sm shadow-2xl ${notice.type === 'ok' ? 'bg-emerald-950 border-emerald-500/30 text-emerald-200' : 'bg-red-950 border-red-500/30 text-red-200'}`}>
          {notice.type === 'ok' ? <CheckCircle2 className="w-5 h-5 shrink-0" /> : <AlertTriangle className="w-5 h-5 shrink-0" />}
          <span className="flex-1">{notice.text}</span>
          <button type="button" onClick={() => setNotice(null)} aria-label="Cerrar aviso" className="opacity-70 hover:opacity-100"><X className="w-4 h-4" /></button>
        </div>
      )}
    </div>
  );
}

function StoreCard({ store, urls, busy, onToggleStatus, onToggleSales, onDomain, onAddOwner, onRemoveOwner }) {
  const salesOff = store.sales_enabled === false;
  const wantsActivation = salesOff && Boolean(store.activation_requested_at);
  const active = store.status === 'active';
  const template = STORE_TEMPLATES.find(t => t.id === store.template)?.label || store.template;
  const domainState = store.domain ? DOMAIN_STATUS[store.domain.status] || DOMAIN_STATUS.unknown : null;

  return (
    <li className={`bg-black border rounded-2xl overflow-hidden ${active ? 'border-white/10' : 'border-red-500/20'}`}>
      <div className="p-5 sm:p-6 flex flex-col lg:flex-row lg:items-center gap-5">
        <div className="flex items-start gap-4 flex-1 min-w-0">
          <span className={`w-12 h-12 rounded-xl flex items-center justify-center shrink-0 text-lg font-black ${active ? 'bg-indigo-500/10 text-indigo-300' : 'bg-red-500/10 text-red-400'}`}>
            {store.name.charAt(0).toUpperCase()}
          </span>
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="text-lg font-bold text-white truncate">{store.name}</h2>
              {store.isDefault && <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider bg-indigo-500/15 text-indigo-300">Principal</span>}
              {!active && <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider bg-red-500/15 text-red-300">Suspendida</span>}
              {wantsActivation && <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider bg-amber-500/20 text-amber-300 animate-pulse">Pidió activación</span>}
              {salesOff && !wantsActivation && <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider bg-white/10 text-zinc-300">Sin ventas</span>}
            </div>
            <p className="text-xs text-zinc-500 mt-1">{template} · <span className="font-mono">{store.slug}</span></p>
          </div>
        </div>

        <div className="grid grid-cols-3 gap-6 text-right lg:w-80 shrink-0">
          <Metric label="Productos" value={store.productCount} />
          <Metric label="Ventas" value={store.paidOrderCount} />
          <Metric label="Facturado" value={formatMoney(store.revenue)} accent />
        </div>
      </div>

      <div className="px-5 sm:px-6 pb-5 sm:pb-6 grid md:grid-cols-2 gap-4">
        {/* Links y dominio */}
        <div className="rounded-xl border border-white/5 bg-white/[0.02] p-4 space-y-3">
          <p className="text-[10px] font-bold uppercase tracking-widest text-zinc-500 flex items-center gap-2"><Globe className="w-3.5 h-3.5" /> Dirección</p>
          <LinkRow href={urls.storefront} />
          {store.custom_domain ? (
            <div className="flex flex-wrap items-center gap-2 text-sm">
              <span className="text-white font-medium">{store.custom_domain}</span>
              <span className={`px-2 py-0.5 rounded text-[11px] font-bold ${domainState.tone}`}>{domainState.label}</span>
            </div>
          ) : (
            <p className="text-xs text-zinc-500">Sin dominio propio.</p>
          )}
          <div className="flex flex-wrap gap-2 pt-1">
            <a href={urls.storefront} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg bg-white/5 hover:bg-white/10 text-xs font-bold text-white transition">
              <ExternalLink className="w-3.5 h-3.5" /> Ver tienda
            </a>
            <a href={urls.admin} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg bg-white/5 hover:bg-white/10 text-xs font-bold text-white transition">
              <LayoutDashboard className="w-3.5 h-3.5" /> Panel
            </a>
            <button type="button" onClick={onDomain} className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg bg-white/5 hover:bg-white/10 text-xs font-bold text-white transition">
              <Globe className="w-3.5 h-3.5" /> {store.custom_domain ? 'Cambiar dominio' : 'Conectar dominio'}
            </button>
          </div>
        </div>

        {/* Dueños y estado */}
        <div className="rounded-xl border border-white/5 bg-white/[0.02] p-4 space-y-3">
          <p className="text-[10px] font-bold uppercase tracking-widest text-zinc-500 flex items-center gap-2"><Users className="w-3.5 h-3.5" /> Dueños</p>
          {store.owners.length === 0 ? (
            <p className="text-xs text-zinc-500">Nadie la administra todavía (solo vos, como plataforma).</p>
          ) : (
            <ul className="space-y-1.5">
              {store.owners.map(owner => (
                <li key={owner.userId} className="flex items-center justify-between gap-2 text-sm">
                  <span className="text-zinc-200 truncate">{owner.email || owner.userId}</span>
                  <button type="button" onClick={() => onRemoveOwner(owner)} aria-label={`Quitar a ${owner.email}`} className="p-1.5 text-zinc-600 hover:text-red-400 transition">
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </li>
              ))}
            </ul>
          )}
          <div className="flex flex-wrap gap-2 pt-1">
            <button type="button" onClick={onAddOwner} className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg bg-white/5 hover:bg-white/10 text-xs font-bold text-white transition">
              <Plus className="w-3.5 h-3.5" /> Agregar dueño
            </button>
            <button
              type="button"
              onClick={onToggleSales}
              disabled={busy}
              className={`inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-bold transition disabled:opacity-50 ${salesOff ? 'bg-emerald-500/15 text-emerald-300 hover:bg-emerald-500/25' : 'bg-white/5 text-zinc-300 hover:bg-white/10'}`}
            >
              {salesOff ? 'Habilitar ventas' : 'Deshabilitar ventas'}
            </button>
            {!store.isDefault && (
              <button
                type="button"
                onClick={onToggleStatus}
                disabled={busy}
                className={`inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-bold transition disabled:opacity-50 ${active ? 'bg-red-500/10 text-red-300 hover:bg-red-500/20' : 'bg-emerald-500/10 text-emerald-300 hover:bg-emerald-500/20'}`}
              >
                {busy ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : active ? <Pause className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5" />}
                {active ? 'Suspender' : 'Reactivar'}
              </button>
            )}
          </div>
        </div>
      </div>
    </li>
  );
}

function Metric({ label, value, accent }) {
  return (
    <div className="min-w-0">
      <p className="text-[10px] font-bold uppercase tracking-widest text-zinc-500">{label}</p>
      <p className={`text-sm font-bold tabular-nums truncate ${accent ? 'text-emerald-400' : 'text-white'}`}>{value}</p>
    </div>
  );
}

function LinkRow({ href }) {
  const [copied, setCopied] = useState(false);
  return (
    <div className="flex items-center gap-2 min-w-0">
      <a href={href} target="_blank" rel="noopener noreferrer" className="text-sm text-indigo-300 hover:text-indigo-200 truncate">{href.replace(/^https?:\/\//, '')}</a>
      <button
        type="button"
        onClick={() => navigator.clipboard?.writeText(href).then(() => { setCopied(true); setTimeout(() => setCopied(false), 1500); })}
        aria-label="Copiar link"
        className="p-1 text-zinc-500 hover:text-white shrink-0"
      >
        {copied ? <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
      </button>
    </div>
  );
}

function Dialog({ title, onClose, children }) {
  return (
    <div className="fixed inset-0 z-[60] bg-black/70 backdrop-blur-sm flex items-end sm:items-center justify-center p-4" onClick={onClose}>
      <div role="dialog" aria-modal="true" aria-label={title} className="w-full max-w-md bg-[#0a0a0a] border border-white/10 rounded-2xl p-6 shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-start justify-between gap-4 mb-5">
          <h3 className="text-lg font-bold text-white">{title}</h3>
          <button type="button" onClick={onClose} aria-label="Cerrar" className="p-1 -m-1 text-zinc-500 hover:text-white"><X className="w-5 h-5" /></button>
        </div>
        {children}
      </div>
    </div>
  );
}

function SubmitRow({ onClose, isSaving, label, disabled }) {
  return (
    <div className="flex flex-col-reverse sm:flex-row sm:justify-end gap-2 pt-2">
      <button type="button" onClick={onClose} className="px-4 py-2.5 rounded-xl text-sm font-bold text-zinc-300 hover:bg-white/5 transition">Cancelar</button>
      <button type="submit" disabled={isSaving || disabled} className="inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-sm font-bold text-white transition disabled:opacity-50">
        {isSaving && <Loader2 className="w-4 h-4 animate-spin" />} {label}
      </button>
    </div>
  );
}

function useSubmit(onSubmit) {
  const [isSaving, setIsSaving] = useState(false);
  const submit = async (payload) => {
    setIsSaving(true);
    await onSubmit(payload);
    setIsSaving(false);
  };
  return [isSaving, submit];
}

// request: solicitud desde la que se crea (completa nombre, rubro y dueño)
function CreateStoreDialog({ stores, request, onClose, onSubmit }) {
  const [name, setName] = useState(request?.business_name || '');
  const [slug, setSlug] = useState('');
  const [slugTouched, setSlugTouched] = useState(false);
  const [template, setTemplate] = useState(() => STORE_TEMPLATES.some(t => t.id === request?.category) ? request.category : 'general');
  const [ownerEmail, setOwnerEmail] = useState(request?.email || '');
  // Por defecto arranca con la configuración de la tienda principal (MINIMAL), sin sus productos
  const [copyFrom, setCopyFrom] = useState(() => stores.find(s => s.isDefault)?.id || '');
  const [isSaving, submit] = useSubmit(onSubmit);

  const finalSlug = slugTouched ? slug : slugify(name);
  const error = finalSlug ? slugError(finalSlug) : null;

  return (
    <Dialog title={request ? `Tienda para ${request.owner_name}` : 'Nueva tienda'} onClose={onClose}>
      <form className="space-y-4" onSubmit={(e) => { e.preventDefault(); submit({ name, slug: finalSlug, template, ownerEmail, copyFrom: copyFrom || null }); }}>
        <label className="block">
          <span className="block text-xs font-semibold text-zinc-400 mb-1.5">Nombre</span>
          <input autoFocus required maxLength={60} value={name} onChange={(e) => setName(e.target.value)} placeholder="Velas Luna" className={inputClass} />
        </label>
        <label className="block">
          <span className="block text-xs font-semibold text-zinc-400 mb-1.5">Enlace (subdominio)</span>
          <input
            value={finalSlug}
            onChange={(e) => { setSlugTouched(true); setSlug(e.target.value.toLowerCase()); }}
            placeholder="velas-luna"
            className={`${inputClass} font-mono`}
          />
          {error ? <span className="block mt-1.5 text-xs text-red-400">{error}</span> : <span className="block mt-1.5 text-xs text-zinc-500">No se puede cambiar después.</span>}
        </label>
        <label className="block">
          <span className="block text-xs font-semibold text-zinc-400 mb-1.5">Rubro</span>
          <select value={template} onChange={(e) => setTemplate(e.target.value)} className={inputClass}>
            {STORE_TEMPLATES.map(t => <option key={t.id} value={t.id}>{t.label}</option>)}
          </select>
        </label>
        <label className="block">
          <span className="block text-xs font-semibold text-zinc-400 mb-1.5">Plantilla</span>
          <select value={copyFrom} onChange={(e) => setCopyFrom(e.target.value)} className={inputClass}>
            {stores.map(s => <option key={s.id} value={s.id}>Copiar configuración de {s.name}</option>)}
            <option value="">Empezar en blanco</option>
          </select>
          <span className="block mt-1.5 text-xs text-zinc-500">Copia envío, campaña y banner. Los productos no se copian: la tienda arranca vacía.</span>
        </label>
        <label className="block">
          <span className="block text-xs font-semibold text-zinc-400 mb-1.5">Email del dueño (opcional)</span>
          <input type="email" value={ownerEmail} onChange={(e) => setOwnerEmail(e.target.value)} placeholder="dueno@ejemplo.com" className={inputClass} />
          <span className="block mt-1.5 text-xs text-zinc-500">Si no tiene cuenta, le llega una invitación por mail.</span>
        </label>
        <SubmitRow onClose={onClose} isSaving={isSaving} label="Crear tienda" disabled={!name.trim() || !finalSlug || Boolean(error)} />
      </form>
    </Dialog>
  );
}

function DomainDialog({ store, onClose, onSubmit }) {
  const [value, setValue] = useState(store.custom_domain || '');
  const [isSaving, submit] = useSubmit(onSubmit);
  const domain = normalizeDomain(value);
  const invalid = domain && !isValidDomain(domain);
  // velas.com y velas.com.ar son dominios raíz (registro A); tienda.velas.com es un subdominio (CNAME)
  const rootLabels = /\.(com|net|org|gob|gov|edu|co)\.[a-z]{2}$/.test(domain) ? 3 : 2;
  const isSubdomain = domain.split('.').length > rootLabels;

  return (
    <Dialog title={`Dominio de ${store.name}`} onClose={onClose}>
      <form className="space-y-4" onSubmit={(e) => { e.preventDefault(); submit(domain); }}>
        <label className="block">
          <span className="block text-xs font-semibold text-zinc-400 mb-1.5">Dominio propio</span>
          <input autoFocus value={value} onChange={(e) => setValue(e.target.value)} placeholder="velasluna.com.ar" className={`${inputClass} font-mono`} />
          {invalid && <span className="block mt-1.5 text-xs text-red-400">Ese dominio no es válido.</span>}
          {!domain && store.custom_domain && <span className="block mt-1.5 text-xs text-zinc-500">Vacío = quitar el dominio.</span>}
        </label>

        {domain && !invalid && (
          <div className="rounded-xl bg-white/[0.03] border border-white/5 p-4 text-xs text-zinc-400 space-y-2">
            <p className="font-bold text-zinc-200">Después, donde compraste el dominio (NIC Argentina, GoDaddy, etc.), creá este registro DNS:</p>
            {isSubdomain ? (
              <p className="font-mono text-zinc-200">CNAME · {domain.split('.')[0]} → cname.vercel-dns.com</p>
            ) : (
              <p className="font-mono text-zinc-200">A · @ → 76.76.21.21</p>
            )}
            <p>Puede tardar desde minutos hasta 48 horas en empezar a funcionar. El estado se ve en esta lista.</p>
          </div>
        )}
        <SubmitRow onClose={onClose} isSaving={isSaving} label="Guardar" disabled={Boolean(invalid) || domain === (store.custom_domain || '')} />
      </form>
    </Dialog>
  );
}

function OwnerDialog({ store, onClose, onSubmit }) {
  const [email, setEmail] = useState('');
  const [isSaving, submit] = useSubmit(onSubmit);
  return (
    <Dialog title={`Agregar dueño a ${store.name}`} onClose={onClose}>
      <form className="space-y-4" onSubmit={(e) => { e.preventDefault(); submit(email); }}>
        <label className="block">
          <span className="block text-xs font-semibold text-zinc-400 mb-1.5">Email</span>
          <input autoFocus required type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="dueno@ejemplo.com" className={inputClass} />
          <span className="block mt-1.5 text-xs text-zinc-500">Va a poder entrar al panel de esta tienda (y solo de esta). Si no tiene cuenta, le llega una invitación.</span>
        </label>
        <SubmitRow onClose={onClose} isSaving={isSaving} label="Agregar" />
      </form>
    </Dialog>
  );
}
