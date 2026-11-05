import { useCallback, useEffect, useState } from 'react';
import { Search, Users, ChevronDown, ChevronUp, KeyRound, Ban, RotateCcw, ShieldCheck, Loader2, X, AlertTriangle, CheckCircle2, RefreshCw } from 'lucide-react';
import { supabase } from '../../supabaseClient';
import { formatMoney } from '../../pricing';
import { matchesUserQuery } from '../../adminUsers';

const FILTERS = [
  { id: 'all', label: 'Todos', test: () => true },
  { id: 'active', label: 'Activos', test: u => !u.isDisabled },
  { id: 'disabled', label: 'Desactivados', test: u => u.isDisabled },
  { id: 'buyers', label: 'Con compras', test: u => u.paidOrderCount > 0 },
  { id: 'admins', label: 'Admins', test: u => u.isAdmin }
];

const formatDate = (value) => value
  ? new Date(value).toLocaleDateString('es-AR', { day: '2-digit', month: 'short', year: 'numeric' })
  : '—';

async function callUsersApi(options = {}) {
  const { data } = await supabase.auth.getSession();
  const response = await fetch('/api/admin-users', {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${data.session?.access_token || ''}`
    }
  });
  const body = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(response.status === 404
      ? 'La gestión de usuarios funciona en la versión publicada (necesita las funciones de Vercel).'
      : body.message || 'No se pudo completar la acción.');
  }
  return body;
}

// Qué se le pide confirmar al admin antes de cada acción
const CONFIRM_TEXT = {
  reset: (u) => ({
    title: 'Enviar mail para restablecer la contraseña',
    text: `Le va a llegar a ${u.email} un enlace para elegir una contraseña nueva. Su contraseña actual sigue funcionando hasta que la cambie.`,
    cta: 'Enviar mail'
  }),
  disable: (u) => ({
    title: 'Desactivar cuenta',
    text: `${u.name || u.email} no va a poder iniciar sesión hasta que la reactives. Sus pedidos y datos se conservan.`,
    cta: 'Desactivar',
    danger: true
  }),
  enable: (u) => ({
    title: 'Reactivar cuenta',
    text: `${u.name || u.email} va a poder volver a iniciar sesión.`,
    cta: 'Reactivar'
  })
};

export default function UsersPage() {
  const [users, setUsers] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState('all');
  const [expandedId, setExpandedId] = useState(null);
  const [pending, setPending] = useState(null); // { action, user }
  const [isWorking, setIsWorking] = useState(false);
  const [notice, setNotice] = useState(null); // { type: 'ok' | 'error', text }

  const loadUsers = useCallback(async () => {
    setIsLoading(true);
    setLoadError('');
    try {
      const body = await callUsersApi();
      setUsers(body.users || []);
    } catch (error) {
      setLoadError(error.message);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => { loadUsers(); }, [loadUsers]);

  useEffect(() => {
    if (!notice) return;
    const timer = setTimeout(() => setNotice(null), 5000);
    return () => clearTimeout(timer);
  }, [notice]);

  const runAction = async () => {
    if (!pending) return;
    setIsWorking(true);
    try {
      const body = await callUsersApi({
        method: 'POST',
        body: JSON.stringify({ action: pending.action, userId: pending.user.id })
      });
      setNotice({ type: 'ok', text: body.message });
      if (pending.action !== 'reset') {
        const disabled = pending.action === 'disable';
        setUsers(list => list.map(u => u.id === pending.user.id ? { ...u, isDisabled: disabled } : u));
      }
    } catch (error) {
      setNotice({ type: 'error', text: error.message });
    } finally {
      setIsWorking(false);
      setPending(null);
    }
  };

  const activeFilter = FILTERS.find(f => f.id === filter);
  const visibleUsers = users.filter(u => activeFilter.test(u) && matchesUserQuery(u, query));

  const stats = [
    { label: 'Cuentas', value: users.length },
    { label: 'Activas', value: users.filter(u => !u.isDisabled).length },
    { label: 'Desactivadas', value: users.filter(u => u.isDisabled).length },
    { label: 'Con compras', value: users.filter(u => u.paidOrderCount > 0).length }
  ];

  const confirm = pending ? CONFIRM_TEXT[pending.action](pending.user) : null;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-3xl sm:text-4xl font-black text-white mb-1 tracking-tight">Usuarios</h1>
          <p className="text-zinc-400 text-sm">Buscá cuentas, revisá sus datos y compras, y gestioná el acceso.</p>
        </div>
        <button
          type="button"
          onClick={loadUsers}
          disabled={isLoading}
          className="inline-flex items-center gap-2 bg-white/5 border border-white/10 hover:bg-white/10 rounded-lg px-4 py-2 text-sm font-bold text-white transition disabled:opacity-50"
        >
          <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} /> Actualizar
        </button>
      </div>

      {/* Resumen */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {stats.map(s => (
          <div key={s.label} className="bg-black border border-white/10 rounded-2xl p-4 sm:p-5">
            <p className="text-[10px] font-bold uppercase tracking-widest text-zinc-500">{s.label}</p>
            <p className="mt-1 text-2xl font-black text-white tabular-nums">{isLoading ? '–' : s.value}</p>
          </div>
        ))}
      </div>

      {/* Buscador y filtros */}
      <div className="bg-black border border-white/10 rounded-2xl p-3 sm:p-4 space-y-3">
        <div className="relative">
          <Search className="w-4 h-4 text-zinc-500 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Buscar por nombre, email, teléfono, DNI o ciudad..."
            aria-label="Buscar usuarios"
            className="w-full bg-white/5 border border-white/10 text-white rounded-xl py-2.5 pl-10 pr-3 focus:outline-none focus:border-indigo-500 transition-colors text-sm"
          />
        </div>
        <div className="flex gap-2 overflow-x-auto hide-scrollbar" role="group" aria-label="Filtrar usuarios">
          {FILTERS.map(f => (
            <button
              key={f.id}
              type="button"
              onClick={() => setFilter(f.id)}
              aria-pressed={filter === f.id}
              className={`shrink-0 px-3.5 py-1.5 rounded-full text-xs font-bold border transition ${filter === f.id
                ? 'bg-indigo-500/15 border-indigo-500/30 text-indigo-300'
                : 'border-white/10 text-zinc-400 hover:text-white hover:border-white/20'}`}
            >
              {f.label}
            </button>
          ))}
        </div>
      </div>

      {/* Lista */}
      <div className="bg-black border border-white/10 rounded-2xl overflow-hidden">
        <div className="px-4 py-3.5 sm:px-6 sm:py-4 border-b border-white/10 flex items-center justify-between">
          <h2 className="font-bold text-white flex items-center gap-2">
            <Users className="w-5 h-5 text-indigo-400" /> Cuentas registradas
          </h2>
          {!isLoading && !loadError && <span className="text-xs text-zinc-500">{visibleUsers.length} de {users.length}</span>}
        </div>

        {isLoading ? (
          <div className="p-12 flex items-center justify-center gap-3 text-zinc-500">
            <Loader2 className="w-5 h-5 animate-spin" /> Cargando usuarios...
          </div>
        ) : loadError ? (
          <div className="p-10 text-center">
            <AlertTriangle className="w-10 h-10 text-amber-400/70 mx-auto mb-3" />
            <p className="text-sm text-zinc-300 max-w-md mx-auto">{loadError}</p>
          </div>
        ) : visibleUsers.length === 0 ? (
          <div className="p-12 text-center text-zinc-500 text-sm">No hay usuarios que coincidan.</div>
        ) : (
          <ul className="p-3 sm:p-5 space-y-3">
            {visibleUsers.map(user => (
              <UserRow
                key={user.id}
                user={user}
                isExpanded={expandedId === user.id}
                onToggle={() => setExpandedId(expandedId === user.id ? null : user.id)}
                onAction={(action) => setPending({ action, user })}
              />
            ))}
          </ul>
        )}
      </div>

      {/* Confirmación */}
      {confirm && (
        <div className="fixed inset-0 z-[60] bg-black/70 backdrop-blur-sm flex items-end sm:items-center justify-center p-4" onClick={() => !isWorking && setPending(null)}>
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="confirm-title"
            className="w-full max-w-md bg-[#0a0a0a] border border-white/10 rounded-2xl p-6 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-4">
              <h3 id="confirm-title" className="text-lg font-bold text-white">{confirm.title}</h3>
              <button type="button" onClick={() => setPending(null)} disabled={isWorking} aria-label="Cerrar" className="p-1 -m-1 text-zinc-500 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>
            <p className="mt-2 text-sm text-zinc-400 leading-relaxed">{confirm.text}</p>
            <div className="mt-6 flex flex-col-reverse sm:flex-row sm:justify-end gap-2">
              <button type="button" onClick={() => setPending(null)} disabled={isWorking} className="px-4 py-2.5 rounded-xl text-sm font-bold text-zinc-300 hover:bg-white/5 transition">
                Cancelar
              </button>
              <button
                type="button"
                onClick={runAction}
                disabled={isWorking}
                autoFocus
                className={`inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-sm font-bold text-white transition disabled:opacity-60 ${confirm.danger ? 'bg-red-600 hover:bg-red-500' : 'bg-indigo-600 hover:bg-indigo-500'}`}
              >
                {isWorking && <Loader2 className="w-4 h-4 animate-spin" />}
                {confirm.cta}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Aviso del resultado */}
      {notice && (
        <div role="status" className={`fixed bottom-24 md:bottom-6 right-4 left-4 sm:left-auto sm:max-w-sm z-[70] flex items-start gap-3 rounded-xl border px-4 py-3 text-sm shadow-2xl ${notice.type === 'ok'
          ? 'bg-emerald-950 border-emerald-500/30 text-emerald-200'
          : 'bg-red-950 border-red-500/30 text-red-200'}`}>
          {notice.type === 'ok' ? <CheckCircle2 className="w-5 h-5 shrink-0" /> : <AlertTriangle className="w-5 h-5 shrink-0" />}
          <span className="flex-1">{notice.text}</span>
          <button type="button" onClick={() => setNotice(null)} aria-label="Cerrar aviso" className="opacity-70 hover:opacity-100"><X className="w-4 h-4" /></button>
        </div>
      )}
    </div>
  );
}

function Badge({ tone, children }) {
  const tones = {
    indigo: 'bg-indigo-500/15 text-indigo-300',
    red: 'bg-red-500/15 text-red-300',
    amber: 'bg-amber-500/15 text-amber-300',
    zinc: 'bg-white/10 text-zinc-300'
  };
  return <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider ${tones[tone]}`}>{children}</span>;
}

function Detail({ label, value, mono }) {
  return (
    <div className="min-w-0">
      <dt className="text-[10px] font-bold uppercase tracking-widest text-zinc-500">{label}</dt>
      <dd className={`mt-0.5 text-sm text-zinc-200 break-words ${mono ? 'font-mono text-xs' : ''}`}>{value || '—'}</dd>
    </div>
  );
}

function UserRow({ user, isExpanded, onToggle, onAction }) {
  const initial = (user.name || user.email || '?').charAt(0).toUpperCase();
  const canDisable = !user.isAdmin;

  return (
    <li className={`bg-[#0a0a0a] border rounded-2xl transition-colors ${user.isDisabled ? 'border-red-500/20' : 'border-white/10 hover:border-white/15'}`}>
      <button type="button" onClick={onToggle} aria-expanded={isExpanded} className="w-full text-left p-4 sm:p-5 flex items-center gap-3 sm:gap-4">
        <span className={`w-10 h-10 rounded-full flex items-center justify-center shrink-0 font-black ${user.isDisabled ? 'bg-red-500/10 text-red-400' : 'bg-indigo-500/10 text-indigo-300'}`}>
          {initial}
        </span>
        <div className="flex-1 min-w-0">
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
            <span className={`font-bold truncate max-w-full ${user.name ? 'text-white' : 'text-zinc-500 italic'}`}>{user.name || 'Sin nombre'}</span>
            {user.isAdmin && <Badge tone="indigo">Admin</Badge>}
            {user.isDisabled && <Badge tone="red">Desactivada</Badge>}
            {!user.emailConfirmed && <Badge tone="amber">Email sin confirmar</Badge>}
            {user.provider === 'google' && <Badge tone="zinc">Google</Badge>}
          </div>
          <p className="text-xs text-zinc-400 truncate mt-0.5">{user.email}</p>
        </div>
        <div className="hidden sm:grid grid-cols-2 gap-6 text-right shrink-0">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-widest text-zinc-500">Pedidos</p>
            <p className="text-sm font-bold text-white tabular-nums">{user.paidOrderCount}<span className="text-zinc-500 font-medium"> / {user.orderCount}</span></p>
          </div>
          <div>
            <p className="text-[10px] font-bold uppercase tracking-widest text-zinc-500">Gastado</p>
            <p className="text-sm font-bold text-emerald-400 tabular-nums">{formatMoney(user.totalSpent)}</p>
          </div>
        </div>
        {isExpanded ? <ChevronUp className="w-5 h-5 text-zinc-500 shrink-0" /> : <ChevronDown className="w-5 h-5 text-zinc-500 shrink-0" />}
      </button>

      {isExpanded && (
        <div className="border-t border-white/5 p-4 sm:p-5 space-y-5">
          <dl className="grid grid-cols-2 md:grid-cols-4 gap-x-6 gap-y-4">
            <div className="sm:hidden col-span-2 grid grid-cols-2 gap-6">
              <Detail label="Pedidos pagados" value={`${user.paidOrderCount} de ${user.orderCount}`} />
              <Detail label="Gastado" value={formatMoney(user.totalSpent)} />
            </div>
            <Detail label="Teléfono" value={user.phone} />
            <Detail label="DNI" value={user.document} />
            <Detail label="Dirección" value={user.address} />
            <Detail label="Ciudad" value={user.city} />
            <Detail label="Alta" value={formatDate(user.createdAt)} />
            <Detail label="Último ingreso" value={formatDate(user.lastSignInAt)} />
            <Detail label="Ingreso con" value={user.provider === 'google' ? 'Google' : 'Email y contraseña'} />
            <Detail label="ID" value={user.id} mono />
          </dl>

          <div className="flex flex-col sm:flex-row gap-2 pt-4 border-t border-white/5">
            <button
              type="button"
              onClick={() => onAction('reset')}
              disabled={!user.email}
              className="inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-white/5 border border-white/10 hover:bg-white/10 text-sm font-bold text-white transition disabled:opacity-40"
            >
              <KeyRound className="w-4 h-4" /> Enviar mail para restablecer contraseña
            </button>
            {canDisable ? (
              user.isDisabled ? (
                <button type="button" onClick={() => onAction('enable')} className="inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-emerald-500/10 border border-emerald-500/25 hover:bg-emerald-500/20 text-sm font-bold text-emerald-300 transition">
                  <RotateCcw className="w-4 h-4" /> Reactivar cuenta
                </button>
              ) : (
                <button type="button" onClick={() => onAction('disable')} className="inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-red-500/10 border border-red-500/25 hover:bg-red-500/20 text-sm font-bold text-red-300 transition">
                  <Ban className="w-4 h-4" /> Desactivar cuenta
                </button>
              )
            ) : (
              <p className="inline-flex items-center gap-2 px-1 text-xs text-zinc-500">
                <ShieldCheck className="w-4 h-4" /> Las cuentas de administrador no se desactivan desde el panel.
              </p>
            )}
            {user.provider === 'google' && (
              <p className="sm:ml-auto self-center text-xs text-zinc-500">Entra con Google: el mail de contraseña le sirve solo si quiere usar también email y clave.</p>
            )}
          </div>
        </div>
      )}
    </li>
  );
}
