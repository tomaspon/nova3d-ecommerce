import React from 'react';

export default function AboutPage() {
  return (
    <div className="bg-white dark:bg-zinc-950 min-h-[calc(100vh-6rem)]">
      {/* Hero Section */}
      <div className="bg-[#f4f4f5] dark:bg-zinc-900 py-24 px-8">
        <div className="max-w-4xl mx-auto text-center">
          <h1 className="text-5xl md:text-7xl font-black text-zinc-900 dark:text-white mb-6 tracking-tighter">
            Diseño que respira.
          </h1>
          <p className="text-xl text-zinc-500 font-medium max-w-2xl mx-auto leading-relaxed">
            Nacimos con una idea simple: los espacios que habitamos moldean cómo nos sentimos. Creamos muebles minimalistas, atemporales y funcionales para la vida moderna.
          </p>
        </div>
      </div>

      {/* Content Section */}
      <div className="max-w-4xl mx-auto px-8 py-24 space-y-24">
        
        <div className="grid md:grid-cols-2 gap-12 items-center">
          <div className="aspect-square bg-zinc-100 dark:bg-zinc-900/50 rounded-3xl border border-zinc-200 dark:border-white/5"></div>
          <div>
            <div className="text-xs font-bold text-zinc-400 uppercase tracking-widest mb-3">Nuestra Filosofía</div>
            <h2 className="text-3xl font-black text-zinc-900 dark:text-white mb-4 tracking-tight">Menos ruido, más esencia.</h2>
            <p className="text-zinc-500 leading-relaxed">
              [Texto de relleno] Lorem ipsum dolor sit amet, consectetur adipiscing elit. Sed do eiusmod tempor incididunt ut labore et dolore magna aliqua. Ut enim ad minim veniam, quis nostrud exercitation ullamco laboris nisi ut aliquip ex ea commodo consequat.
            </p>
          </div>
        </div>

        <div className="grid md:grid-cols-2 gap-12 items-center md:flex-row-reverse">
          <div className="order-2 md:order-1">
            <div className="text-xs font-bold text-zinc-400 uppercase tracking-widest mb-3">Calidad Argentina</div>
            <h2 className="text-3xl font-black text-zinc-900 dark:text-white mb-4 tracking-tight">Materiales honestos.</h2>
            <p className="text-zinc-500 leading-relaxed">
              [Texto de relleno] Duis aute irure dolor in reprehenderit in voluptate velit esse cillum dolore eu fugiat nulla pariatur. Excepteur sint occaecat cupidatat non proident, sunt in culpa qui officia deserunt mollit anim id est laborum.
            </p>
          </div>
          <div className="order-1 md:order-2 aspect-square bg-zinc-100 dark:bg-zinc-900/50 rounded-3xl border border-zinc-200 dark:border-white/5"></div>
        </div>

      </div>
    </div>
  );
}
