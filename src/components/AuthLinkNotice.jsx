import { useState } from 'react';
import { X } from 'lucide-react';
import { AUTH_LINK_ERROR } from '../supabaseClient';

// Cuando un enlace del mail (confirmar cuenta, entrar, cambiar la clave) ya venció o ya se usó,
// Supabase vuelve con el error en la dirección. Se explica en palabras simples.
// (Pasa también cuando el programa de mail "abre" el enlace antes para revisarlo.)
export default function AuthLinkNotice() {
  const [open, setOpen] = useState(Boolean(AUTH_LINK_ERROR));
  if (!open) return null;
  const expired = /expired|invalid|otp/i.test(AUTH_LINK_ERROR);
  return (
    <div role="alert" className="fixed inset-x-3 bottom-3 sm:inset-x-auto sm:right-4 sm:bottom-4 sm:max-w-sm z-[100] rounded-2xl bg-zinc-900 text-white shadow-2xl p-4 pr-12">
      <p className="font-bold text-sm">{expired ? 'Ese enlace ya no sirve' : 'No pudimos completar el ingreso'}</p>
      <p className="mt-1 text-sm text-zinc-300">
        {expired
          ? 'Venció o ya se usó. Si tu cuenta ya está confirmada, iniciá sesión con tu email y contraseña; si no, registrate de nuevo y usá el último mail que te llegue.'
          : 'Probá iniciar sesión de nuevo.'}
      </p>
      <button type="button" onClick={() => setOpen(false)} aria-label="Cerrar aviso" className="absolute top-2 right-2 w-10 h-10 inline-flex items-center justify-center rounded-full hover:bg-white/10">
        <X className="w-4 h-4" />
      </button>
    </div>
  );
}
