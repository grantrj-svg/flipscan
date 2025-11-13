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
  const [scanning, setScanning] = useState(true);
  const [flash, setFlash] = useState(false);
  const [result, setResult] = useState<ScanResult | null>(null);
  const videoRef = useRef<HTMLDivElement>(null);
  const quaggaRef = useRef<any>(null);

  // Auto-start camera
  useEffect(() => {
    startScan();
  }, []);

  const toggleScan = async () => {
    if (scanning) {
      // STOP
      if (quaggaRef.current) {
        quaggaRef.current.stop();
        quaggaRef.current = null;
      }
      setScanning(false);
    } else {
      // START
      setScanning(true);
      setResult(null);

      try {
        await navigator.mediaDevices.getUserMedia({ video: true });
      } catch {
        alert('Camera blocked. Settings → Safari → Camera → Allow');
        setScanning(false);
        return;
      }

      const initQuagga = () => {
        Quagga.init({
          inputStream: {
            name: "Live",
            type: "LiveStream",
            target: videoRef.current!,
            constraints: { facingMode: "environment", width: { ideal: 1280 }, height: { ideal: 720 } },
            area: { top: "15%", right: "15%", left: "15%", bottom: "15%" }
          },
          decoder: {
            readers: ["ean_reader", "ean_8_reader", "upc_reader", "upc_e_reader", "code_128_reader"]
          },
          locate: true,
          numOfWorkers: 2,
          locator: { patchSize: "medium", halfSample: true },
          frequency: 10
        }, (err) => {
          if (err) {
            console.error('Quagga init error:', err);
            setScanning(false);
            return;
          }
          quaggaRef.current = Quagga;
          Quagga.start();
        });

        Quagga.onDetected(async (data) => {
          const code = data.codeResult?.code;
          if (!code) return;

          // Flash + result
          setFlash(true);
          setTimeout(() => setFlash(false), 800);

          try {
            const res = await fetch(`/api/ebay?barcode=${code}`);
            if (!res.ok) throw new Error();
            const ebayData = await res.json();
            const resultData = { barcode: code, ...ebayData, timestamp: new Date().toLocaleString('en-AU') };
            setResult(resultData);
          } catch {
            setResult({ barcode: code, avgPrice: 'N/A', soldCount: 0, timestamp: '' });
          }

          // AUTO-RESUME after 1.5s
          setTimeout(() => {
            if (scanning) {
              Quagga.start();
            }
          }, 1500);
        });
      };

      setTimeout(initQuagga, 100);
    }
  };

  const isPremium = result && parseFloat(result.avgPrice) >= 150;

  return (
    <main className="min-h-screen bg-gradient-to-b from-emerald-50 to-white p-4">
      <div className="max-w-md mx-auto">

        <h1 className="text-5xl font-black text-center mb-6 bg-gradient-to-r from-emerald-600 to-green-600 bg-clip-text text-transparent">
          FlipScan
        </h1>

        {/* STOP BUTTON */}
        <button
          onClick={toggleScan}
          className={`w-full py-6 rounded-3xl text-3xl font-bold mb-6 shadow-xl transition-all ${
            scanning
              ? 'bg-red-600 hover:bg-red-700 text-white'
              : 'bg-yellow-500 hover:bg-yellow-600 text-black'
          }`}
        >
          {scanning ? 'STOP SCAN' : 'RESUME SCAN'}
        </button>

        {flash && (
          <div className="text-5xl font-black text-green-600 text-center animate-pulse mb-4">
            SCANNED
          </div>
        )}

        {scanning && (
          <div className="bg-black rounded-3xl overflow-hidden mb-6 shadow-2xl">
            <div ref={videoRef} className="w-full h-80" />
          </div>
        )}

        {result && (
          <div className={`p-8 rounded-3xl shadow-2xl mb-6 ${isPremium ? 'bg-gradient-to-r from-yellow-200 to-yellow-400 border-4 border-yellow-600' : 'bg-white'}`}>
            <div className="flex items-center justify-center gap-2 mb-3">
              <p className="text-6xl font-black">${result.avgPrice} AUD</p>
              {isPremium && <span className="text-5xl">GOLD STAR</span>}
            </div>
            <p className="text-3xl font-bold mb-2">{result.soldCount} sold (6 mo)</p>
            <p className="text-lg text-gray-700 font-mono break-all">Barcode: {result.barcode}</p>
          </div>
        )}

      </div>
    </main>
  );
}