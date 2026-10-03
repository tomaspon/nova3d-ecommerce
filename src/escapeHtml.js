// Para armar HTML a mano (comprobantes que se imprimen en una ventana nueva).
// Todo dato que venga de un cliente o de la base pasa por acá antes de entrar al HTML.
const ENTITIES = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };

export function escapeHtml(value) {
  return String(value ?? '').replace(/[&<>"']/g, (char) => ENTITIES[char]);
}
