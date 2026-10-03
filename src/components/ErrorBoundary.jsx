import React from 'react';

class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  componentDidCatch(error, errorInfo) {
    // El detalle técnico queda en la consola; al cliente se le muestra un mensaje simple
    console.error("ErrorBoundary caught an error", error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-[#FAFAFA] dark:bg-[#121212] flex flex-col items-center justify-center text-center px-6">
          <div className="w-12 h-12 bg-black dark:bg-white rounded-full flex items-center justify-center text-white dark:text-black font-serif font-bold italic mb-6">M</div>
          <h1 className="text-2xl font-black text-zinc-900 dark:text-white tracking-tight mb-2">Algo salió mal</h1>
          <p className="text-zinc-500 dark:text-zinc-400 text-sm mb-8 max-w-sm">Tuvimos un problema al mostrar esta página. Probá recargarla; tu carrito queda guardado.</p>
          <button
            onClick={() => window.location.reload()}
            className="bg-black dark:bg-white text-white dark:text-black font-bold py-3.5 px-8 rounded-full hover:opacity-80 transition"
          >
            Recargar la página
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}

export default ErrorBoundary;
