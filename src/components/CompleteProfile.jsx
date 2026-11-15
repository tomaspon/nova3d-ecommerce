import { useState } from 'react';
import { Loader2, UserCheck } from 'lucide-react';
import { supabase } from '../supabaseClient';
import { profileOf, missingProfileFields, isValidName, isValidPhone, isValidEmail, isRelayEmail, cleanPhone } from '../profileCompletion';

// "Completá tus datos": aparece después de entrar con Google, Apple, etc. (o con una cuenta
// vieja) hasta que la cuenta tenga nombre, teléfono y un email real. No se puede saltear.
export default function CompleteProfile({ user, variant = 'store', onSignOut }) {
  const current = profileOf(user);
  const missing = missingProfileFields(user);
  const askEmail = missing.includes('email');
  const [form, setForm] = useState({ name: current.name, phone: current.phone, email: askEmail && !isRelayEmail(current.email) ? current.email : '' });
  const [errors, setErrors] = useState({});
  const [message, setMessage] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  const set = (field) => (e) => { setForm(f => ({ ...f, [field]: e.target.value })); setErrors(x => ({ ...x, [field]: undefined })); };

  const save = async (e) => {
    e.preventDefault();
    const found = {};
    if (!isValidName(form.name)) found.name = 'Escribí tu nombre y apellido.';
    if (!isValidPhone(form.phone)) found.phone = 'Escribí tu celular con código de área (ej: 291 555 1234).';
    if (askEmail && (!isValidEmail(form.email) || isRelayEmail(form.email))) found.email = 'Escribí un email al que te podamos escribir.';
    if (Object.keys(found).length) { setErrors(found); return; }

    setIsSaving(true);
    setMessage('');
    const shipping = { ...(user.user_metadata?.shipping || {}), name: form.name.trim(), phone: cleanPhone(form.phone) };
    const update = { data: { shipping } };
    if (askEmail && form.email.trim().toLowerCase() !== (user.email || '').toLowerCase()) update.email = form.email.trim();
    const { error } = await supabase.auth.updateUser(update);
    setIsSaving(false);
    if (error) {
      setMessage(/already|registered|exists/i.test(error.message) ? 'Ese email ya está en otra cuenta.' : 'No pudimos guardar tus datos. Probá de nuevo.');
      return;
    }
    if (update.email) setMessage('Te mandamos un mail para confirmar tu email.');
  };

  const dark = variant === 'dark';
  const input = dark
    ? 'w-full bg-black border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-indigo-500'
    : 'w-full bg-zinc-50 dark:bg-black border border-zinc-200 dark:border-white/10 rounded-xl px-4 py-3 text-base text-zinc-900 dark:text-white focus:outline-none focus:border-zinc-900 dark:focus:border-white';
  const labelClass = `block text-xs font-bold uppercase tracking-wider mb-1.5 ${dark ? 'text-zinc-500' : 'text-zinc-500'}`;

  const Field = ({ id, label, children }) => (
    <label className="block">
      <span className={labelClass}>{label}</span>
      {children}
      {errors[id] && <span className="block mt-1 text-xs font-semibold text-red-500">{errors[id]}</span>}
    </label>
  );

  return (
    <form onSubmit={save} noValidate className="space-y-4">
      <div className="text-center">
        <span className={`w-12 h-12 rounded-full inline-flex items-center justify-center ${dark ? 'bg-indigo-500/15 text-indigo-300' : 'bg-zinc-100 dark:bg-white/10 text-zinc-700 dark:text-white'}`}><UserCheck className="w-6 h-6" /></span>
        <h2 className={`mt-3 text-xl font-black tracking-tight ${dark ? 'text-white' : 'text-zinc-900 dark:text-white'}`}>Completá tus datos</h2>
        <p className="mt-1 text-sm text-zinc-500">Los necesitamos para tus pedidos y para avisarte novedades.</p>
      </div>
      {Field({ id: 'name', label: 'Nombre y apellido', children: <input className={input} autoComplete="name" value={form.name} onChange={set('name')} /> })}
      {Field({ id: 'phone', label: 'Celular', children: <input className={input} type="tel" autoComplete="tel" placeholder="291 555 1234" value={form.phone} onChange={set('phone')} /> })}
      {askEmail && Field({ id: 'email', label: 'Email', children: <input className={input} type="email" autoComplete="email" value={form.email} onChange={set('email')} /> })}
      {message && <p role="status" className="text-sm font-semibold text-center text-zinc-500">{message}</p>}
      <button type="submit" disabled={isSaving} className={`w-full font-bold py-3.5 rounded-xl flex items-center justify-center gap-2 disabled:opacity-60 ${dark ? 'bg-indigo-600 hover:bg-indigo-500 text-white' : 'bg-brand text-brand-ink hover:opacity-90'}`}>
        {isSaving && <Loader2 className="w-4 h-4 animate-spin" />} Guardar y continuar
      </button>
      {onSignOut && <button type="button" onClick={onSignOut} className="w-full text-xs text-zinc-500 hover:underline">Salir de esta cuenta</button>}
    </form>
  );
}
