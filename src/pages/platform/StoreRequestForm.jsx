import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Loader2, CheckCircle2, ShieldCheck } from 'lucide-react';
import { PROVINCES, REQUEST_CATEGORIES, TERMS_VERSION, validateStoreRequest } from '../../storeRequest';

// Formulario "Solicitá tu tienda" de la página oficial. Se pide lo necesario para
// presupuestar y verificar al titular; nada más (minimización de datos).

const EMPTY = {
  owner_name: '', tax_id: '', email: '', phone: '', city: '', province: '',
  business_name: '', category: '', social_url: '', has_domain: false, domain: '', message: '',
  accepted_terms: false, website: ''
};

const inputClass = 'w-full rounded-xl border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 placeholder:text-zinc-400 focus:outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 transition dark:border-white/15 dark:bg-zinc-950 dark:text-white';

function Field({ label, error, hint, children, className = '' }) {
  return (
    <label className={`block ${className}`}>
      <span className="block text-xs font-semibold text-zinc-700 mb-1 dark:text-zinc-300">{label}</span>
      {children}
      {error ? <span className="block mt-1 text-xs text-red-600 dark:text-red-400">{error}</span> : hint && <span className="block mt-1 text-[11px] text-zinc-500 dark:text-zinc-400">{hint}</span>}
    </label>
  );
}

export default function StoreRequestForm() {
  const [form, setForm] = useState(EMPTY);
  const [errors, setErrors] = useState({});
  const [status, setStatus] = useState('idle'); // idle | sending | sent
  const [serverMessage, setServerMessage] = useState('');

  const set = (field) => (e) => {
    const value = e.target.type === 'checkbox' ? e.target.checked : e.target.value;
    setForm(prev => ({ ...prev, [field]: value }));
    if (errors[field]) setErrors(prev => ({ ...prev, [field]: undefined }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const payload = { ...form, terms_version: TERMS_VERSION };
    const { errors: found } = validateStoreRequest(payload);
    if (Object.keys(found).length > 0) {
      setErrors(found);
      setServerMessage('');
      return;
    }

    setStatus('sending');
    try {
      const response = await fetch('/api/store-request', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      const body = await response.json().catch(() => ({}));
      if (!response.ok) {
        setErrors(body.errors || {});
        setServerMessage(response.status === 404 ? 'El formulario funciona en la versión publicada.' : body.message || 'No pudimos enviar tu solicitud.');
        setStatus('idle');
        return;
      }
      setServerMessage(body.message);
      setStatus('sent');
    } catch {
      setServerMessage('No hay conexión. Probá de nuevo en un momento.');
      setStatus('idle');
    }
  };

  if (status === 'sent') {
    return (
      <div role="status" className="rounded-xl border border-emerald-200 bg-emerald-50 p-6 text-center">
        <CheckCircle2 className="w-12 h-12 text-emerald-600 mx-auto" />
        <h3 className="mt-4 text-xl font-bold text-zinc-900 dark:text-white">{serverMessage}</h3>
        <p className="mt-2 text-zinc-600 dark:text-zinc-400">Te vamos a escribir a <b>{form.email}</b> o por WhatsApp con el presupuesto y los próximos pasos.</p>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} noValidate className="rounded-xl bg-white p-4 sm:p-5 space-y-5 dark:bg-zinc-950">
      {/* Trampa para bots: invisible para las personas */}
      <input type="text" name="website" value={form.website} onChange={set('website')} tabIndex={-1} autoComplete="off" aria-hidden="true" className="hidden" />

      <fieldset className="space-y-3">
        <legend className="text-sm font-bold text-zinc-900 mb-1 dark:text-white">Tus datos</legend>
        <div className="grid sm:grid-cols-2 gap-3">
          <Field label="Nombre y apellido" error={errors.owner_name}>
            <input className={inputClass} autoComplete="name" value={form.owner_name} onChange={set('owner_name')} />
          </Field>
          <Field label="DNI o CUIT" error={errors.tax_id} hint="Lo usamos para verificar tu identidad y facturarte.">
            <input className={inputClass} inputMode="numeric" value={form.tax_id} onChange={set('tax_id')} />
          </Field>
          <Field label="Email" error={errors.email}>
            <input className={inputClass} type="email" autoComplete="email" value={form.email} onChange={set('email')} />
          </Field>
          <Field label="WhatsApp" error={errors.phone} hint="Con código de área, ej: 291 555 1234.">
            <input className={inputClass} type="tel" autoComplete="tel" value={form.phone} onChange={set('phone')} />
          </Field>
          <Field label="Ciudad" error={errors.city}>
            <input className={inputClass} autoComplete="address-level2" value={form.city} onChange={set('city')} />
          </Field>
          <Field label="Provincia" error={errors.province}>
            <select className={inputClass} value={form.province} onChange={set('province')}>
              <option value="">Elegí...</option>
              {PROVINCES.map(p => <option key={p} value={p}>{p}</option>)}
            </select>
          </Field>
        </div>
      </fieldset>

      <fieldset className="space-y-3">
        <legend className="text-sm font-bold text-zinc-900 mb-1 dark:text-white">Tu negocio</legend>
        <div className="grid sm:grid-cols-2 gap-3">
          <Field label="Nombre de la marca" error={errors.business_name}>
            <input className={inputClass} value={form.business_name} onChange={set('business_name')} />
          </Field>
          <Field label="Rubro" error={errors.category}>
            <select className={inputClass} value={form.category} onChange={set('category')}>
              <option value="">Elegí...</option>
              {REQUEST_CATEGORIES.map(c => <option key={c.id} value={c.id}>{c.label}</option>)}
            </select>
          </Field>
          <Field label="Instagram o web actual (opcional)" className="sm:col-span-2">
            <input className={inputClass} placeholder="instagram.com/tumarca" value={form.social_url} onChange={set('social_url')} />
          </Field>
        </div>
        <label className="flex items-center gap-3 text-xs text-zinc-700 dark:text-zinc-300">
          <input type="checkbox" className="w-4 h-4 rounded accent-indigo-600" checked={form.has_domain} onChange={set('has_domain')} />
          Ya tengo un dominio (por ejemplo, tumarca.com.ar)
        </label>
        {form.has_domain && (
          <Field label="Tu dominio">
            <input className={inputClass} placeholder="tumarca.com.ar" value={form.domain} onChange={set('domain')} />
          </Field>
        )}
        <Field label="¿Algo más que quieras contarnos? (opcional)">
          <textarea className={`${inputClass} min-h-16`} value={form.message} onChange={set('message')} placeholder="Cantidad de productos, si vendés por Instagram, etc." />
        </Field>
      </fieldset>

      <div className="space-y-3">
        <label className="flex items-start gap-3 text-xs text-zinc-700 dark:text-zinc-300">
          <input type="checkbox" className="mt-0.5 w-4 h-4 rounded accent-indigo-600 shrink-0" checked={form.accepted_terms} onChange={set('accepted_terms')} />
          <span>
            Acepto los <Link to="/terminos" target="_blank" className="font-semibold text-indigo-600 underline dark:text-indigo-400">términos del servicio y la política de privacidad</Link>, y que mis datos se usen para contactarme, verificar mi identidad y prestar el servicio.
          </span>
        </label>
        {errors.accepted_terms && <p className="text-sm text-red-600 dark:text-red-400">{errors.accepted_terms}</p>}
        {serverMessage && <p role="alert" className="text-sm text-red-600 dark:text-red-400">{serverMessage}</p>}

        <button type="submit" disabled={status === 'sending'} className="w-full sm:w-auto inline-flex items-center justify-center gap-2 rounded-full bg-indigo-600 text-white text-sm font-bold px-6 py-3 hover:bg-indigo-500 transition disabled:opacity-60">
          {status === 'sending' && <Loader2 className="w-5 h-5 animate-spin" />} Solicitar mi tienda
        </button>
        <p className="flex items-center gap-2 text-xs text-zinc-500 dark:text-zinc-400">
          <ShieldCheck className="w-4 h-4" /> Tus datos viajan cifrados y solo los usamos para prestarte el servicio.
        </p>
      </div>
    </form>
  );
}
