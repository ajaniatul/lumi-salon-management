"use client";
import { useEffect, useRef, useState } from "react";
import { X, Camera, AlertCircle } from "lucide-react";

interface Props {
  onDetect: (code: string) => void;
  onClose: () => void;
}

export default function BarcodeScanner({ onDetect, onClose }: Props) {
  const videoRef    = useRef<HTMLVideoElement>(null);
  const streamRef   = useRef<MediaStream | null>(null);
  const animRef     = useRef<number | null>(null);
  const detectedRef = useRef(false);

  const [error,    setError]    = useState<string | null>(null);
  const [scanning, setScanning] = useState(false);

  useEffect(() => {
    startCamera();
    return cleanup;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const cleanup = () => {
    if (animRef.current)  cancelAnimationFrame(animRef.current);
    if (streamRef.current) streamRef.current.getTracks().forEach(t => t.stop());
  };

  const startCamera = async () => {
    if (typeof window === "undefined" || !("BarcodeDetector" in window)) {
      setError("Barcode scanning requires Chrome or Edge (v83+). Please open the app in a supported browser.");
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: { ideal: "environment" }, width: { ideal: 1280 }, height: { ideal: 720 } },
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
        setScanning(true);
        scanLoop();
      }
    } catch {
      setError("Camera access denied. Please allow camera permission and try again.");
    }
  };

  const scanLoop = () => {
    const detector = new (window as any).BarcodeDetector({
      formats: ["qr_code", "ean_13", "ean_8", "code_128", "code_39", "upc_a", "upc_e", "data_matrix"],
    });
    const frame = async () => {
      if (detectedRef.current || !videoRef.current) return;
      try {
        const hits = await detector.detect(videoRef.current);
        if (hits.length > 0) {
          detectedRef.current = true;
          cleanup();
          onDetect(hits[0].rawValue as string);
          return;
        }
      } catch { /* video not ready yet */ }
      animRef.current = requestAnimationFrame(frame);
    };
    animRef.current = requestAnimationFrame(frame);
  };

  const close = () => { cleanup(); onClose(); };

  return (
    <>
      <style>{`
        @keyframes scanline {
          0%   { top: 12%; }
          50%  { top: 78%; }
          100% { top: 12%; }
        }
        .barcode-scan-line {
          position: absolute;
          left: 0;
          right: 0;
          height: 2px;
          background: rgba(167, 139, 250, 0.9);
          box-shadow: 0 0 6px rgba(167, 139, 250, 0.8);
          animation: scanline 2s ease-in-out infinite;
        }
      `}</style>

      <div
        className="fixed inset-0 z-[60] flex items-center justify-center p-4"
        style={{ background: "rgba(0,0,0,0.90)", backdropFilter: "blur(4px)" }}
      >
        <div className="w-full max-w-sm bg-white rounded-3xl overflow-hidden shadow-2xl">
          {/* Header */}
          <div className="flex items-center justify-between px-5 py-4 border-b border-ivory-200">
            <div className="flex items-center gap-2">
              <Camera className="w-4 h-4 text-primary-500" />
              <h3 className="text-sm font-bold text-foreground">Scan Barcode / QR Code</h3>
            </div>
            <button
              onClick={close}
              className="w-7 h-7 rounded-full bg-ivory-100 flex items-center justify-center hover:bg-ivory-200"
            >
              <X className="w-4 h-4 text-muted-foreground" />
            </button>
          </div>

          {/* Camera view */}
          <div className="relative bg-black" style={{ aspectRatio: "4/3" }}>
            {error ? (
              <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 p-6">
                <AlertCircle className="w-10 h-10 text-red-400" />
                <p className="text-white text-sm text-center leading-relaxed">{error}</p>
              </div>
            ) : (
              <>
                <video ref={videoRef} className="w-full h-full object-cover" muted playsInline />

                {/* Targeting overlay */}
                <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                  <div className="relative" style={{ width: 220, height: 150 }}>
                    {/* Corner brackets */}
                    {([
                      { top: 0,    left: 0,    borderTop:    "2px solid #a78bfa", borderLeft:   "2px solid #a78bfa" },
                      { top: 0,    right: 0,   borderTop:    "2px solid #a78bfa", borderRight:  "2px solid #a78bfa" },
                      { bottom: 0, left: 0,    borderBottom: "2px solid #a78bfa", borderLeft:   "2px solid #a78bfa" },
                      { bottom: 0, right: 0,   borderBottom: "2px solid #a78bfa", borderRight:  "2px solid #a78bfa" },
                    ] as React.CSSProperties[]).map((s, i) => (
                      <div key={i} style={{ position: "absolute", width: 28, height: 28, ...s }} />
                    ))}
                    {scanning && <div className="barcode-scan-line" />}
                  </div>
                </div>

                {!error && (
                  <p className="absolute bottom-3 left-0 right-0 text-center text-xs" style={{ color: "rgba(255,255,255,0.75)" }}>
                    {scanning ? "Point camera at barcode or QR code" : "Starting camera…"}
                  </p>
                )}
              </>
            )}
          </div>

          {/* Footer */}
          <div className="px-5 py-3">
            <button onClick={close} className="w-full btn-outline text-sm py-2">
              Cancel
            </button>
          </div>
        </div>
      </div>
    </>
  );
}
