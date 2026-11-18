// Después de compilar: dist/index.html pasa a dist/app.html.
// Vercel sirve los archivos antes que las reglas de vercel.json: con un index.html, la portada (/)
// nunca pasaría por la regla que les da la vista previa a WhatsApp, Instagram, etc.
// Con app.html, todas las páginas (incluida /) llegan a la app por la regla de vercel.json.
import { renameSync, existsSync } from 'node:fs';

const from = new URL('../dist/index.html', import.meta.url);
const to = new URL('../dist/app.html', import.meta.url);
if (existsSync(from)) renameSync(from, to);
console.log('dist/app.html listo');
