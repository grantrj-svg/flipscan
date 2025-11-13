// src/app/page.tsx
'use client';
import { useState, useRef, useEffect } from 'react';
import Quagga from '@ericblade/quagga2';

export default function Home() {
  const [scanning, setScanning] = useState(false);
  const [error, setError] = useState('');
  const [result, setResult] = useState<any>(null);
  const videoRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!navigator.mediaDevices?.getUserMedia) {
      setError('Camera not supported. Use Safari browser.');
    }
  }, []);

  const startScan = async () => {
    setScanning(true);
    setError('');
    setResult(null);

    try {
      await navigator.mediaDevices.getUserMedia({ video: true });
    } catch {
      setError('Camera blocked. Settings → Safari → Camera → Allow');
      setScanning(false);
      return;
    }

    Quagga.init({
      inputStream: {
        name: "Live",
        type: "LiveStream",
        target: videoRef.current!,
        constraints: { facingMode: "environment" }
      },
      decoder: { readers: ["ean_reader", "upc_reader"] }
    }, (err) => {
      if (err) {
        setError('Scanner failed: ' + err.message);
        setScanning(false);
        return;
      }
      Quagga.start();
    });

    Quagga.onDetected((data) => {
      const code = data.codeResult.code;
      if (!code) return; // ← THIS FIXES THE NULL ERROR
      Quagga.stop();
      setScanning(false);
      lookupEbay(code); // ← NOW SAFE
    });
  };

  const lookupEbay = async (barcode: string) => {
    try {
      const res = await fetch(`/api/ebay?barcode=${barcode}`);
      if (!res.ok) throw new Error('Failed');
      const data = await res.json();
      setResult({ ...data, barcode });
    } catch {
      setResult({ error: "eBay lookup failed" });
    }
  };

  return (
    <main className="min-h-screen bg-gradient-to-b from-emerald-50 to-white p-4">
      <div className="max-w-md mx-auto text-center">
        <h1 className="text-4xl font-bold mb-8 bg-gradient-to-r from-emerald-600 to-green-600 bg-clip-text text-transparent">
          FlipScan
        </h1>

        {error && (
          <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-6">
            {error}
            <br />
            <small>iPhone tip: Settings → Safari → Camera → Allow</small>
          </div>
        )}

        <button
          onClick={startScan}
          disabled={scanning}
          className="w-full bg-gradient-to-r from-emerald-500 to-green-600 hover:from-emerald-600 hover:to-green-700 text-white py-6 rounded-2xl text-xl font-bold mb-6 shadow-2xl disabled:opacity-50"
        >
          {scanning ? "Scanning..." : "Scan DVD or PS Game"}
        </button>

        {scanning && (
          <div className="bg-black rounded-2xl overflow-hidden mb-6 shadow-2xl">
            <div ref={videoRef} className="w-full h-80" />
          </div>
        )}

        {result && !result.error && (
          <div className="p-8 rounded-2xl shadow-2xl bg-white">
            <p className="text-5xl font-black mb-2">${result.avgPrice} AUD</p>
            <p className="text-2xl mb-4">{result.soldCount} sold (6 mo)</p>
            <p className="text-lg text-gray-700">Barcode: <code>{result.barcode}</code></p>
          </div>
        )}

        {result?.error && (
          <div className="bg-red-100 border-4 border-red-400 p-8 rounded-2xl text-red-700 text-center">
            {result.error}
          </div>
        )}
      </div>
    </main>
  );
}