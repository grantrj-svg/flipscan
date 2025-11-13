// src/app/page.tsx
'use client';
import { useState, useRef, useEffect } from 'react';
import Quagga from '@ericblade/quagga2';

interface ScanResult {
  barcode: string;
  avgPrice: string;
  soldCount: number;
  timestamp: string;
}

export default function Home() {
  const [scanning, setScanning] = useState(false);
  const [buttonState, setButtonState] = useState<'idle' | 'scanning' | 'success'>('idle');
  const [flash, setFlash] = useState(false);
  const [result, setResult] = useState<ScanResult | null>(null);
  const [history, setHistory] = useState<ScanResult[]>([]);
  const [error, setError] = useState('');
  const videoRef = useRef<HTMLDivElement>(null);

  // Load history from localStorage
  useEffect(() => {
    const saved = localStorage.getItem('flipscan-history');
    if (saved) setHistory(JSON.parse(saved));
  }, []);

  // Eruda debug console (for iPhone)
  useEffect(() => {
    if (typeof window !== 'undefined' && !(window as any).eruda) {
      const script = document.createElement('script');
      script.src = 'https://cdn.jsdelivr.net/npm/eruda';
      script.onload = () => (window as any).eruda.init();
      document.body.appendChild(script);
    }
  }, []);

  // Save to history
  const saveToHistory = (data: ScanResult) => {
    const newEntry = { ...data, timestamp: new Date().toLocaleString('en-AU') };
    const updated = [newEntry, ...history].slice(0, 50);
    setHistory(updated);
    localStorage.setItem('flipscan-history', JSON.stringify(updated));
  };

  const startScan = async () => {
    setScanning(true);
    setButtonState('scanning');
    setError('');
    setResult(null);

    try {
      await navigator.mediaDevices.getUserMedia({ video: true });
    } catch {
      setError('Camera blocked. Settings → Safari → Camera → Allow');
      setScanning(false);
      setButtonState('idle');
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
      height: { ideal: 720 }
    },
    area: { top: "20%", right: "20%", left: "20%", bottom: "20%" }
  },
  decoder: {
    readers: [
      "ean_reader",
      "ean_8_reader",
      "upc_reader",
      "upc_e_reader",
      "code_128_reader"
    ],
    multiple: false
  },
  locate: true,
  numOfWorkers: 2,
  locator: {
    patchSize: "medium",
    halfSample: true
  },
  frequency: 10
}, (err) => {
  if (err) {
    console.error('Quagga init error:', err);
    setError('Scanner failed: ' + err.message);
    setScanning(false);
    setButtonState('idle');
    return;
  }
  console.log('Quagga started successfully');
  Quagga.start();
});
      if (err) {
        setError('Scanner failed: ' + err.message);
        setScanning(false);
        setButtonState('idle');
        return;
      }
      Quagga.start();
    });

    Quagga.onDetected(async (data) => {
  console.log('RAW DETECTION:', data);
  const code = data.codeResult?.code;
  if (!code) {
    console.log('No valid code');
    return;
  }

  console.log('BARCODE FOUND:', code);
  Quagga.stop();
  setScanning(false);
  setButtonState('success');

  setFlash(true);
  setTimeout(() => setFlash(false), 1000);

  // Test with known barcode
  const testCode = '5027035015140'; // The Godfather
  const finalCode = code.length >= 12 ? code : testCode;

  try {
    const res = await fetch(`/api/ebay?barcode=${finalCode}`);
    console.log('eBay status:', res.status);
    if (!res.ok) throw new Error();
    const ebayData = await res.json();
    console.log('eBay result:', ebayData);
    const resultData = { barcode: finalCode, ...ebayData };
    setResult(resultData);
    saveToHistory(resultData);
  } catch (err) {
    console.error('eBay failed');
    setResult({ barcode: finalCode, avgPrice: 'N/A', soldCount: 0, timestamp: '' });
  }

  setTimeout(() => setButtonState('idle'), 1500);
});
  };

  // Button styles
  const buttonClass = {
    idle: 'bg-red-600 hover:bg-red-700 text-white',
    scanning: 'bg-yellow-500 hover:bg-yellow-600 text-black',
    success: 'bg-green-600 hover:bg-green-700 text-white'
  }[buttonState];

  return (
    <main className="min-h-screen bg-gradient-to-b from-emerald-50 to-white p-4">
      <div className="max-w-md mx-auto text-center">
        <h1 className="text-4xl font-bold mb-8 bg-gradient-to-r from-emerald-600 to-green-600 bg-clip-text text-transparent">
          FlipScan
        </h1>

        {error && (
          <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-6">
            {error}
          </div>
        )}

        {/* SCAN BUTTON */}
        <button
          onClick={startScan}
          disabled={scanning}
          className={`w-full ${buttonClass} py-8 rounded-3xl text-3xl font-bold mb-6 shadow-2xl transition-all duration-300 disabled:opacity-50`}
        >
          {buttonState === 'idle' && 'SCAN'}
          {buttonState === 'scanning' && 'SCANNING...'}
          {buttonState === 'success' && 'SCANNED!'}
        </button>

        {/* DEBUG BUTTON - REMOVE LATER */}
        <button
          onClick={() => (window as any).eruda?.show()}
          className="w-full bg-gray-700 hover:bg-gray-800 text-white py-3 rounded-xl text-lg font-semibold mb-6"
        >
          Open Debug Console
        </button>

        {/* TEST SCAN BUTTON */}
<button
  onClick={() => {
    const fakeCode = '5027035015140';
    console.log('TEST SCAN:', fakeCode);
    setButtonState('success');
    setFlash(true);
    setTimeout(() => {
      setFlash(false);
      setButtonState('idle');
      setResult({ barcode: fakeCode, avgPrice: '89.50', soldCount: 12, timestamp: new Date().toLocaleString('en-AU') });
      saveToHistory({ barcode: fakeCode, avgPrice: '89.50', soldCount: 12, timestamp: new Date().toLocaleString('en-AU') });
    }, 1500);
  }}
  className="w-full bg-purple-600 hover:bg-purple-700 text-white py-3 rounded-xl text-lg font-semibold mb-6"
>
  TEST SCAN (Godfather)
</button>

        {/* FLASH TEXT */}
        {flash && (
          <div className="text-4xl font-black text-green-600 animate-pulse mb-6">
            SCANNED
          </div>
        )}

        {/* CAMERA */}
        {scanning && (
          <div className="bg-black rounded-3xl overflow-hidden mb-6 shadow-2xl">
            <div ref={videoRef} className="w-full h-80" />
          </div>
        )}

        {/* RESULT */}
        {result && (
          <div className="p-8 rounded-3xl shadow-2xl bg-white mb-6">
            <p className="text-5xl font-black mb-2">${result.avgPrice} AUD</p>
            <p className="text-2xl mb-4">{result.soldCount} sold (6 mo)</p>
            <p className="text-lg text-gray-700">Barcode: <code>{result.barcode}</code></p>
          </div>
        )}

        {/* HISTORY */}
        {history.length > 0 && (
          <div className="mt-8">
            <h2 className="text-2xl font-bold mb-4">Recent Scans</h2>
            <div className="space-y-2 max-h-64 overflow-y-auto">
              {history.map((item, i) => (
                <div key={i} className="bg-gray-100 p-3 rounded-lg text-left text-sm">
                  <div className="font-mono">{item.barcode}</div>
                  <div>${item.avgPrice} • {item.soldCount} sold • {item.timestamp}</div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </main>
  );
}