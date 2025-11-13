'use client';
import { useState, useRef, useEffect } from 'react';
import Quagga from '@ericblade/quagga2';

export default function Home() {
  const [scanning, setScanning] = useState(false);
  const [error, setError] = useState('');
  const [result, setResult] = useState<any>(null);
  const videoRef = useRef<HTMLDivElement>(null);

  // iPhone Safari fix: Check camera support
  useEffect(() => {
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      setError('Camera not supported. Use Safari browser.');
    }
  }, []);

  const startScan = async () => {
    setScanning(true);
    setError('');
    setResult(null);

    try {
      // Test camera access first
      await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } });
    } catch (err) {
      setError('Camera access denied. Go to Settings > Safari > Camera > Allow');
      setScanning(false);
      return;
    }

    Quagga.init({
      inputStream: {
        name: "Live",
        type: "LiveStream",
        target: videoRef.current!,
        constraints: {
          facingMode: "environment",
          width: { ideal: 1280 },
          height: { ideal: 720 },
          // iPhone fixes
          aspectRatio: { min: 1, max: 2 }
        },
        area: { top: '10%', right: '10%', left: '10%', bottom: '10%' }
      },
      decoder: {
        readers: ["ean_reader", "upc_reader", "ean_8_reader"],
        multiple: false
      },
      locate: true,
      numOfWorkers: 2 // Faster on mobile
    }, (err) => {
      if (err) {
        setError('Scanner init failed: ' + err);
        setScanning(false);
        return;
      }
      Quagga.start();
    });

    Quagga.onDetected((data) => {
      const code = data.codeResult.code;
      Quagga.stop();
      setScanning(false);
      lookupEbay(code);
    });
  };

  const lookupEbay = async (barcode: string) => {
    try {
      const res = await fetch(`/api/ebay?barcode=${barcode}`);
      const data = await res.json();
      setResult({ ...data, barcode });
    } catch {
      setResult({ error: "eBay lookup failed" });
    }
  };

  const getCard = (data: any) => {
    const avg = parseFloat(data.avgPrice || 0);
    const count = data.soldCount || 0;
    if (count >= 5 && avg >= 150) return { color: 'bg-gradient-to-r from-yellow-200 to-yellow-400 border-4 border-yellow-600', text: '⭐ PREMIUM GEM!' };
    if (count >= 3 && avg >= 50) return { color: 'bg-green-100 border-4 border-green-600', text: '✅ BUY – Good Flip' };
    if (count >= 1 && avg >= 20) return { color: 'bg-yellow-100 border-4 border-yellow-600', text: '❓ Maybe' };
    return { color: 'bg-red-100 border-4 border-red-600', text: "❌ Don't Bother" };
  };

  return (
    <main className="min-h-screen bg-gradient-to-b from-emerald-50 to-white p-4">
      <div className="max-w-md mx-auto">
        <h1 className="text-4xl font-bold text-center mb-8 bg-gradient-to-r from-emerald-600 to-green-600 bg-clip-text text-transparent">
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
          className="w-full bg-gradient-to-r from-emerald-500 to-green-600 hover:from-emerald-600 hover:to-green-700 text-white py-6 rounded-2xl text-xl font-bold mb-6 shadow-2xl disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {scanning ? "🔦 Scanning..." : "📱 Scan DVD or PS Game"}
        </button>

        {scanning && (
          <div className="bg-black rounded-2xl overflow-hidden mb-6 shadow-2xl">
            <div ref={videoRef} className="w-full h-80 relative">
              <div className="absolute inset-0 flex items-center justify-center bg-black bg-opacity-20">
                <div className="scanner-frame w-48 h-24 border-4 border-green-400 rounded-lg animate-pulse"></div>
              </div>
            </div>
          </div>
        )}

        {result && !result.error && (
          <div className={`p-8 rounded-2xl shadow-2xl ${getCard(result).color}`}>
            <p className="text-5xl font-black mb-2">${result.avgPrice} AUD</p>
            <p className="text-2xl mb-4">{result.soldCount} sold (6 mo)</p>
            <p className="text-3xl font-bold mb-4">{getCard(result).text}</p>
            <p className="text-lg text-gray-700">Barcode: <code>{result.barcode}</code></p>
          </div>
        )}

        {result?.error && (
          <div className="bg-red-100 border-4 border-red-400 p-8 rounded-2xl text-red-700 text-center">
            {result.error}
          </div>
        )}

        {/* Manual entry fallback */}
        <div className="mt-8 p-4 bg-blue-50 rounded-xl">
          <input
            type="text"
            placeholder="Or type barcode manually..."
            className="w-full p-4 border-2 border-blue-300 rounded-xl text-lg"
            onKeyDown={(e) => {
              if (e.key === 'Enter') lookupEbay(e.currentTarget.value);
            }}
          />
        </div>
      </div>
    </main>
  );
}