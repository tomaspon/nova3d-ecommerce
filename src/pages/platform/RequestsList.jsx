import { useState } from 'react';
import { Mail, MessageCircle, ExternalLink, Plus, ShieldCheck, Save, Loader2, Inbox } from 'lucide-react';
import { REQUEST_CATEGORIES, isValidCuit } from '../../storeRequest';

// Bandeja de solicitudes de tienda (panel de plataforma).

const STATUS = {
  nueva: { label: 'Nueva', tone: 'bg-indigo-500/15 text-indigo-300' },
  contactada: { label: 'Contactada', tone: 'bg-amber-500/15 text-amber-300' },
  aprobada: { label: 'Aprobada', tone: 'bg-emerald-500/15 text-emerald-300' },
  rechazada: { label: 'Rechazada', tone: 'bg-red-500/15 text-red-300' }
};

const formatDate = (value) => new Date(value).toLocaleString('es-AR', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });

// Celulares argentinos en WhatsApp: 54 9 + característica + número (sin 0 ni 15)
function whatsappLink(phone, name) {
  let digits = phone.replace(/\D/g, '').replace(/^0/, '');
  if (!digits.startsWith('54')) digits = `549${digits}`;
  return `https://wa.me/${digits}?text=${encodeURIComponent(`¡Hola ${name.split(' ')[0]}! Te escribimos por tu solicitud de tienda online.`)}`;
}

const formatTaxId = (id) => id.length === 11 ? `${id.slice(0, 2)}-${id.slice(2, 10)}-${id.slice(10)}` : id;

function Detail({ label, children }) {
  return (
    <div className="min-w-0">
      <dt className="text-[10px] font-bold uppercase tracking-widest text-zinc-500">{label}</dt>
      <dd className="mt-0.5 text-sm text-zinc-200 break-words">{children || '—'}</dd>
    </div>
  );
}

function RequestCard({ request, onUpdate, onCreateStore }) {
  const [notes, setNotes] = useState(request.admin_notes || '');
  const [isSaving, setIsSaving] = useState(false);
  const status = STATUS[request.status] || STATUS.nueva;
  const category = REQUEST_CATEGORIES.find(c => c.id === request.category)?.label || request.category;
  const isCuit = request.tax_id.length === 11;

  const save = async (changes) => {
    setIsSaving(true);
    await onUpdate(changes);
    setIsSaving(false);
  };

  return (
    <li className="bg-black border border-white/10 rounded-2xl p-5 sm:p-6 space-y-5">
      <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="text-lg font-bold text-white">{request.business_name}</h3>
            <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider ${status.tone}`}>{status.label}</span>
          </div>
          <p className="text-xs text-zinc-500 mt-1">{category} · {request.city}, {request.province} · {formatDate(request.created_at)}</p>
        </div>
        <select
          value={request.status}
          onChange={(e) => save({ status: e.target.value })}
          disabled={isSaving}
          aria-label="Estado de la solicitud"
          className="bg-black border border-white/10 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-indigo-500"
        >
          {Object.entries(STATUS).map(([value, s]) => <option key={value} value={value}>{s.label}</option>)}
        </select>
      </div>

      <dl className="grid grid-cols-2 md:grid-cols-4 gap-x-6 gap-y-4">
        <Detail label="Titular">{request.owner_name}</Detail>
        <Detail label={isCuit ? 'CUIT/CUIL' : 'DNI'}>
          <span className="font-mono">{formatTaxId(request.tax_id)}</span>
          {isCuit && !isValidCuit(request.tax_id) && <span className="block text-xs text-red-400">Dígito verificador inválido</span>}
        </Detail>
        <Detail label="Email">{request.email}</Detail>
        <Detail label="Teléfono">{request.phone}</Detail>
        <Detail label="Redes / web">
          {request.social_url && (
            <a href={/^https?:\/\//.test(request.social_url) ? request.social_url : `https://${request.social_url}`} target="_blank" rel="noopener noreferrer" className="text-indigo-300 hover:text-indigo-200">{request.social_url}</a>
          )}
        </Detail>
        <Detail label="Dominio">{request.has_domain ? request.domain || 'Tiene (sin indicar)' : 'No tiene'}</Detail>
        <Detail label="Mensaje">{request.message}</Detail>
        <Detail label="Consentimiento">
          <span className="text-xs text-zinc-400">Términos {request.terms_version} · {formatDate(request.accepted_at)}{request.ip ? ` · IP ${request.ip}` : ''}</span>
        </Detail>
      </dl>

      <label className="block">
        <span className="block text-[10px] font-bold uppercase tracking-widest text-zinc-500 mb-1.5">Notas internas</span>
        <div className="flex gap-2">
          <input
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Presupuesto enviado, pagó la seña, etc."
            className="flex-1 min-w-0 bg-black border border-white/10 rounded-xl px-3.5 py-2.5 text-sm text-white placeholder:text-zinc-600 focus:outline-none focus:border-indigo-500"
          />
          <button type="button" onClick={() => save({ adminNotes: notes })} disabled={isSaving || notes === (request.admin_notes || '')} aria-label="Guardar notas" className="px-3 rounded-xl bg-white/5 hover:bg-white/10 text-white disabled:opacity-40 transition">
            {isSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
          </button>
        </div>
      </label>

      <div className="flex flex-wrap gap-2 pt-1">
        <a href={whatsappLink(request.phone, request.owner_name)} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg bg-emerald-500/10 hover:bg-emerald-500/20 text-xs font-bold text-emerald-300 transition">
          <MessageCircle className="w-3.5 h-3.5" /> WhatsApp
        </a>
        <a href={`mailto:${request.email}`} className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg bg-white/5 hover:bg-white/10 text-xs font-bold text-white transition">
          <Mail className="w-3.5 h-3.5" /> Email
        </a>
        {isCuit && (
          <a href="https://seti.afip.gob.ar/padron-puc-constancia-internet/ConsultaConstanciaAction.do" target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg bg-white/5 hover:bg-white/10 text-xs font-bold text-white transition" title="Constancia de inscripción en ARCA (ex AFIP): pegá el CUIT">
            <ShieldCheck className="w-3.5 h-3.5" /> Verificar CUIT en ARCA <ExternalLink className="w-3 h-3" />
          </a>
        )}
        {request.store_id ? (
          <span className="inline-flex items-center px-3 py-2 text-xs font-bold text-emerald-300">Tienda creada</span>
        ) : (
          <button type="button" onClick={onCreateStore} className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-xs font-bold text-white transition">
            <Plus className="w-3.5 h-3.5" /> Crear su tienda
          </button>
        )}
      </div>
    </li>
  );
}

export default function RequestsList({ requests, onUpdate, onCreateStore }) {
  if (requests === null) {
    return (
      <div className="p-10 text-center bg-black border border-white/10 rounded-2xl text-sm text-zinc-300">
        Para recibir solicitudes, corré <code className="text-indigo-300">supabase/005_solicitudes.sql</code> en Supabase.
      </div>
    );
  }
  if (requests.length === 0) {
    return (
      <div className="p-12 text-center bg-black border border-white/10 rounded-2xl">
        <Inbox className="w-10 h-10 text-zinc-600 mx-auto mb-3" />
        <p className="text-sm text-zinc-400">Todavía no llegaron solicitudes. Llegan desde el formulario de la página oficial.</p>
      </div>
    );
  }
  return (
    <ul className="space-y-4">
      {requests.map(request => (
        <RequestCard
          key={request.id}
          request={request}
          onUpdate={(changes) => onUpdate(request.id, changes)}
          onCreateStore={() => onCreateStore(request)}
        />
      ))}
    </ul>
  );
}
