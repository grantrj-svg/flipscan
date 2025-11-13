// src/app/page.tsx
'use client';
import { useState, useRef } from 'react';
import Quagga from '@ericblade/quagga2';

export default function Home() {
  const [scanning, setScanning] = useState(false);
  const [result, setResult] = useState<any>(null);
  const videoRef = useRef<HTMLDivElement>(null);

  const startScan = () => {
    setScanning(true);
    setResult(null);

    Quagga.init({
      inputStream: {
        name: "Live",
        type: "LiveStream",
        target: videoRef.current!,
        constraints: { facingMode: "environment" }
      },
      decoder: { readers: ["ean_reader", "upc_reader"] }
    }, (err) => {
      if (err) { console.error(err); return; }
      Quagga.start();
    });

    Quagga.onDetected((data) => {
      const code = data.codeResult.code;
      if (code) {
        setResult({ barcode: code });
        Quagga.stop();
        setScanning(false);
        lookupEbay(code);
      }
    });
  };

const lookupEbay = async (barcode: string) => {
  // FAKE DATA — REMOVE WHEN eBay KEY ARRIVES
  await new Promise(r => setTimeout(r, 1000)); // Fake delay

  const fakeData = [
    { avgPrice: '89.50', soldCount: 12 },
    { avgPrice: '22.00', soldCount: 3 },
    { avgPrice: '5.99', soldCount: 1 },
    { avgPrice: '199.99', soldCount: 8 },
    { avgPrice: '0.00', soldCount: 0 }
  ];

  const random = fakeData[Math.floor(Math.random() * fakeData.length)];
  setResult({ ...random, barcode });
};

  const getCard = (data: any) => {
    const avg = parseFloat(data.avgPrice);
    const count = data.soldCount;
    if (count >= 5 && avg >= 150) return { color: 'bg-gradient-to-r from-yellow-200 to-yellow-400', text: 'Premium Gem!' };
    if (count >= 3 && avg >= 50) return { color: 'bg-green-100', text: 'Buy – Good Flip' };
    if (count >= 1 && avg >= 20) return { color: 'bg-yellow-100', text: 'Maybe' };
    return { color: 'bg-red-100', text: "Don't Bother" };
  };

  return (
    <main className="min-h-screen bg-gray-50 p-4">
      <div className="max-w-md mx-auto">
        <h1 className="text-3xl font-bold text-center mb-8 text-emerald-700">FlipScan</h1>

        <button
          onClick={startScan}
          disabled={scanning}
          className="w-full bg-emerald-600 hover:bg-emerald-700 text-white py-4 rounded-lg text-lg font-semibold mb-6 disabled:opacity-70"
        >
          {scanning ? "Scanning..." : "Scan DVD or PS Game"}
        </button>

        {scanning && <div ref={videoRef} className="bg-black rounded-lg overflow-hidden h-64 mb-6" />}

        {result && !result.error && (
          <div className={`p-6 rounded-lg shadow-lg border ${getCard(result).color}`}>
            <p className="text-3xl font-bold">${result.avgPrice} AUD</p>
            <p className="text-lg">{result.soldCount} sold (6 mo)</p>
            <p className="text-xl font-semibold mt-2">{getCard(result).text}</p>
            <p className="text-sm text-gray-600 mt-2">Barcode: {result.barcode}</p>
          </div>
        )}

        {result?.error && <div className="bg-red-100 p-6 rounded-lg text-red-700">{result.error}</div>}
      </div>
    </main>
  );
}