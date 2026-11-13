// Dominios propios de las tiendas en el proyecto de Vercel.
// Opcional: funciona si están cargadas VERCEL_TOKEN y VERCEL_PROJECT_ID (y VERCEL_TEAM_ID
// si el proyecto es de un equipo). Sin ellas, el dominio se guarda igual y se agrega a mano.

const API = 'https://api.vercel.com';

export const isVercelConfigured = () => Boolean(process.env.VERCEL_TOKEN && process.env.VERCEL_PROJECT_ID);

async function vercel(path, options = {}) {
  const url = new URL(API + path);
  if (process.env.VERCEL_TEAM_ID) url.searchParams.set('teamId', process.env.VERCEL_TEAM_ID);
  const response = await fetch(url, {
    ...options,
    headers: { Authorization: `Bearer ${process.env.VERCEL_TOKEN}`, 'Content-Type': 'application/json' }
  });
  const body = await response.json().catch(() => ({}));
  return { ok: response.ok, status: response.status, body };
}

const projectPath = () => `/v10/projects/${encodeURIComponent(process.env.VERCEL_PROJECT_ID)}/domains`;

export async function addDomain(domain) {
  if (!isVercelConfigured()) return { skipped: true };
  const { ok, status, body } = await vercel(projectPath(), { method: 'POST', body: JSON.stringify({ name: domain }) });
  // 409: ya estaba agregado a este proyecto
  if (!ok && status !== 409) throw new Error(body?.error?.message || 'Vercel rechazó el dominio.');
  return { skipped: false };
}

export async function removeDomain(domain) {
  if (!isVercelConfigured() || !domain) return;
  await vercel(`${projectPath()}/${encodeURIComponent(domain)}`, { method: 'DELETE' });
}

// Estado para mostrar en el panel:
// 'active' (listo), 'dns' (falta apuntar el dominio), 'verify' (falta verificar que es tuyo),
// 'missing' (no está en Vercel), 'unknown' (sin conexión a Vercel)
export async function domainStatus(domain) {
  if (!isVercelConfigured()) return { status: 'unknown' };
  const project = await vercel(`${projectPath()}/${encodeURIComponent(domain)}`);
  if (project.status === 404) return { status: 'missing' };
  if (!project.ok) return { status: 'unknown' };
  if (project.body.verified === false) {
    return { status: 'verify', verification: project.body.verification || [] };
  }
  const config = await vercel(`/v6/domains/${encodeURIComponent(domain)}/config`);
  if (config.ok && config.body.misconfigured) return { status: 'dns' };
  return { status: 'active' };
}
