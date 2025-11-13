// src/app/page.tsx
'use client';
import { useState, useRef, useEffect } from 'react';
import Quagga from '@ericblade/quagga2';
import { supabase } from '@/lib/supabase';

interface ScanResult {
  barcode: string;
  avgPrice: string;
  soldCount: number;
  timestamp: string;
}

const UPLOAD_BATCH_SIZE = 100;

export default function Home() {
  const [scanning, setScanning] = useState(false);
  const [flash, setFlash] = useState(false);
  const [result, setResult] = useState<ScanResult | null>(null);
  const [localScans, setLocalScans] = useState<ScanResult[]>([]);
  const [uploading, setUploading] = useState(false);
  const videoRef = useRef<HTMLDivElement>(null);
  const quaggaRef = useRef<any>(null);

  // Load local scans
  useEffect(() => {
    const saved = localStorage.getItem('flipscan-local');
    if (saved) {
      const parsed = JSON.parse(saved);
      setLocalScans(parsed);
      if (parsed.length > 0) setResult(parsed[0]);
    }
  }, []);

  // Upload when 100 reached
  useEffect(() => {
    if (localScans.length >= UPLOAD_BATCH_SIZE && !uploading) {
      uploadToCloud();
    }
  }, [localScans.length, uploading]);

  const saveLocally = (data: ScanResult) => {
    const newEntry = { ...data, timestamp: new Date().toLocaleString('en-AU') };
    const updated = [newEntry, ...localScans.filter(s => s.barcode !== data.barcode)].slice(0, UPLOAD_BATCH_SIZE);
    setLocalScans(updated);
    localStorage.setItem('flipscan-local', JSON.stringify(updated));
    setResult(newEntry);
  };

  const uploadToCloud = async () => {
    if (uploading || localScans.length === 0) return;
    setUploading(true);

    const dataToUpload = localScans.map(s => ({
      barcode: s.barcode,
      avg_price: s.avgPrice,
      sold_count: s.soldCount,
      timestamp: s.timestamp
    }));

    const { error } = await supabase.from('scans').insert(dataToUpload);

    if (!error) {
      localStorage.removeItem('flipscan-local');
      setLocalScans([]);
    }

    setUploading(false);
  };

  const startScan = async () => {
    if (scanning) {
      // STOP SCANNING
      if (quaggaRef.current) {
        quaggaRef.current.stop();
        quaggaRef.current = null;
      }
      setScanning(false);
      return;
    }

    // START SCANNING
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

        Quagga.stop();
        setScanning(false);

        setFlash(true);
        setTimeout(() => setFlash(false), 800);

        try {
          const res = await fetch(`/api/ebay?barcode=${code}`);
          if (!res.ok) throw new Error();
          const ebayData = await res.json();
          const resultData = { barcode: code, ...ebayData };
          saveLocally(resultData);
        } catch {
          const fallback = { barcode: code, avgPrice: 'N/A', soldCount: 0, timestamp: '' };
          saveLocally(fallback);
        }
      });
    };

    // Small delay to ensure video element is ready
    setTimeout(initQuagga, 100);
  };

  const isPremium = result && parseFloat(result.avgPrice) >= 150;

  return (
    <main className="min-h-screen bg-gradient-to-b from-emerald-50 to-white p-4">
      <div className="max-w-md mx-auto">

        <h1 className="text-5xl font-black text-center mb-6 bg-gradient-to-r from-emerald-600 to-green-600 bg-clip-text text-transparent">
          FlipScan
        </h1>

        {/* TOGGLE BUTTON */}
        <button
          onClick={startScan}
          className={`w-full py-6 rounded-3xl text-3xl font-bold mb-6 shadow-xl transition-all ${
            scanning
              ? 'bg-red-600 hover:bg-red-700 text-white'
              : 'bg-yellow-500 hover:bg-yellow-600 text-black'
          }`}
        >
          {scanning ? 'STOP SCAN' : 'START SCAN'}
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

        <div className="text-center text-sm text-gray-600">
          {localScans.length > 0 && (
            <p>{localScans.length}/100 scans (auto-upload at 100)</p>
          )}
          {uploading && <p className="text-blue-600">Uploading to cloud...</p>}
        </div>
      </div>
    </main>
  );
}