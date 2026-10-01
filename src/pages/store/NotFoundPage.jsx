import React from 'react';
import { Link } from 'react-router-dom';

export default function NotFoundPage() {
  return (
    <div className="min-h-[calc(100vh-16rem)] bg-[#FAFAFA] dark:bg-[#121212] flex flex-col items-center justify-center text-center px-6 py-16">
      <div className="text-7xl md:text-9xl font-black tracking-tighter text-zinc-200 dark:text-zinc-800">404</div>
      <h1 className="text-2xl md:text-3xl font-black text-zinc-900 dark:text-white tracking-tight mt-2 mb-2">No encontramos esta página</h1>
      <p className="text-zinc-500 dark:text-zinc-400 text-sm mb-8 max-w-sm">El enlace puede estar mal escrito o la página ya no existe.</p>
      <Link to="/" className="bg-black dark:bg-white text-white dark:text-black font-bold py-3.5 px-8 rounded-full hover:opacity-80 transition">
        Volver al catálogo
      </Link>
    </div>
  );
}
