import React, { useEffect, useRef } from 'react';
import { Html5QrcodeScanner, Html5QrcodeSupportedFormats } from 'html5-qrcode';
import { X } from 'lucide-react';

export default function BarcodeScanner({ onScan, onClose }) {
  const scannerRef = useRef(null);

  useEffect(() => {
    // Configurar escáner
    const scanner = new Html5QrcodeScanner("reader", { 
      fps: 10, 
      qrbox: { width: 250, height: 150 },
      formatsToSupport: [ 
        Html5QrcodeSupportedFormats.EAN_13,
        Html5QrcodeSupportedFormats.EAN_8,
        Html5QrcodeSupportedFormats.UPC_A,
        Html5QrcodeSupportedFormats.UPC_E,
        Html5QrcodeSupportedFormats.CODE_128,
        Html5QrcodeSupportedFormats.CODE_39
      ],
      supportedScanTypes: [0] // Camera only
    }, false);

    scanner.render((decodedText) => {
      // Éxito
      scanner.clear();
      onScan(decodedText);
    }, (errorMessage) => {
      // Se ignora el error de cada frame que no lee nada
    });

    return () => {
      scanner.clear().catch(e => console.error("Error clearing scanner", e));
    };
  }, [onScan]);

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-[100] flex items-center justify-center p-4 animate-in fade-in">
      <div className="bg-zinc-950 border border-white/10 p-6 rounded-3xl w-full max-w-md relative shadow-2xl">
        <button onClick={onClose} className="absolute top-4 right-4 text-zinc-500 hover:text-white transition">
          <X className="w-6 h-6" />
        </button>
        <h2 className="text-xl font-bold text-white mb-6">Escanear Código de Barras</h2>
        <div className="bg-black rounded-2xl overflow-hidden border border-white/5">
          <div id="reader" className="w-full"></div>
        </div>
        <p className="text-zinc-500 text-xs text-center mt-4">Apunta la cámara al código de barras del producto (EAN/UPC).</p>
      </div>
    </div>
  );
}
