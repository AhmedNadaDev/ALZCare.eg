import React, { useState, useEffect, useRef, useCallback } from 'react';
import { recognizeFromPatientPage } from '../../shared/Service-ai-models/face-recognition';

// ===== ICONS =====
const BrainIcon = () => (
  <svg className="h-8 w-8" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M9.5 2A2.5 2.5 0 0 1 12 4.5v15a2.5 2.5 0 0 1-4.96.44 2.5 2.5 0 0 1-2.96-3.08 3 3 0 0 1-.34-5.58 2.5 2.5 0 0 1 1.32-4.24 2.5 2.5 0 0 1 4.44-2.54"/>
    <path d="M14.5 2A2.5 2.5 0 0 0 12 4.5v15a2.5 2.5 0 0 0 4.96.44 2.5 2.5 0 0 0 2.96-3.08 3 3 0 0 0 .34-5.58 2.5 2.5 0 0 0-1.32-4.24 2.5 2.5 0 0 0-4.44-2.54"/>
  </svg>
);

const CameraIcon = () => (
  <svg className="h-6 w-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M14.5 4h-5L7 7H4a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2h-3l-2.5-3z"/>
    <circle cx="12" cy="13" r="3"/>
  </svg>
);

const CameraIconLg = () => (
  <svg className="h-16 w-16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M14.5 4h-5L7 7H4a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2h-3l-2.5-3z"/>
    <circle cx="12" cy="13" r="3"/>
  </svg>
);

const PatientPage = () => {
  const videoRef = useRef(null);
  const overlayRef = useRef(null);
  const captureCanvasRef = useRef(null);
  const recognitionInFlightRef = useRef(false);

  const [detections, setDetections] = useState([]);
  const [status, setStatus] = useState('Starting camera...');
  const [instruction, setInstruction] = useState('');
  const [cameraActive, setCameraActive] = useState(false);
  const [intervalMs] = useState(1200);

  useEffect(() => {
    let cancelled = false;

    const startCamera = async () => {
      setStatus('Starting camera...');
      try {
        if (videoRef.current?.srcObject) {
          videoRef.current.srcObject.getTracks().forEach((t) => t.stop());
        }

        const stream = await navigator.mediaDevices.getUserMedia({
          video: {
            width: { ideal: 1280 },
            height: { ideal: 720 },
            facingMode: 'user',
          },
        });

        if (cancelled) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }

        const video = videoRef.current;
        if (!video) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }

        video.srcObject = stream;

        const onReady = () => {
          if (video.videoWidth > 0) {
            setCameraActive(true);
            setStatus('Face recognition active. Looking for faces...');
          }
        };

        video.onloadedmetadata = onReady;
        video.oncanplay = onReady;
        setTimeout(onReady, 300);
      } catch (err) {
        if (!cancelled) {
          setStatus(`Camera error: ${err.message}`);
          setInstruction('Please allow camera access to continue');
          setCameraActive(false);
        }
        console.error('Camera error:', err);
      }
    };

    startCamera();

    return () => {
      cancelled = true;
      const v = videoRef.current;
      if (v?.srcObject) {
        v.srcObject.getTracks().forEach((t) => t.stop());
        v.srcObject = null;
      }
    };
  }, []);

  const sendFrame = useCallback(async () => {
    const video = videoRef.current;
    const captureCanvas = captureCanvasRef.current;

    if (!video || !captureCanvas) return;
    if (!video.videoWidth || !video.videoHeight) return;
    if (!cameraActive) return;
    if (recognitionInFlightRef.current) return;

    captureCanvas.width = video.videoWidth;
    captureCanvas.height = video.videoHeight;
    const ctx = captureCanvas.getContext('2d');
    ctx.drawImage(video, 0, 0, captureCanvas.width, captureCanvas.height);

    const dataUrl = captureCanvas.toDataURL('image/jpeg', 0.85);

    recognitionInFlightRef.current = true;
    try {
      const res = await recognizeFromPatientPage(dataUrl);

      const nextDetections = res.detections || [];
      setDetections(nextDetections);
      drawDetections(nextDetections);

      setStatus('Live');

      if (nextDetections.length > 0) {
        const matched = nextDetections.find((d) => d.matched);
        if (matched) {
          setInstruction(`Recognized: ${matched.matched.name} (${matched.matched.relation}, Age ${matched.matched.age})`);
        } else {
          setInstruction('Face detected but not recognized');
        }
      } else {
        setInstruction('No face detected');
      }
    } catch (err) {
      console.error('Recognition error:', err);
      setStatus(`Error: ${err.message || 'Unknown error'}`);
    } finally {
      recognitionInFlightRef.current = false;
    }
  }, [cameraActive]);

  useEffect(() => {
    if (!cameraActive) return undefined;

    const timer = setInterval(() => {
      sendFrame();
    }, intervalMs);

    return () => clearInterval(timer);
  }, [cameraActive, intervalMs, sendFrame]);

  const drawDetections = (items = []) => {
    const canvas = overlayRef.current;
    const video = videoRef.current;
    if (!canvas || !video || !video.videoWidth) return;

    const displayW = video.clientWidth;
    const displayH = video.clientHeight;
    const srcW = video.videoWidth;
    const srcH = video.videoHeight;

    canvas.width = displayW;
    canvas.height = displayH;
    const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, displayW, displayH);

    const scale = Math.min(displayW / srcW, displayH / srcH);
    const offsetX = (displayW - srcW * scale) / 2;
    const offsetY = (displayH - srcH * scale) / 2;

    items.forEach((item) => {
      const [x1, y1, x2, y2] = item.bbox;
      const w = x2 - x1;
      const h = y2 - y1;

      const dx = x1 * scale + offsetX;
      const dy = y1 * scale + offsetY;
      const dw = w * scale;
      const dh = h * scale;

      ctx.strokeStyle = item.matched ? '#22c55e' : '#f97316';
      ctx.lineWidth = 3;
      ctx.strokeRect(dx, dy, dw, dh);

      const label = item.matched
        ? `${item.matched.name} • ${item.matched.age} • ${item.matched.relation}`
        : 'Unknown';
      ctx.font = '16px Inter, system-ui, sans-serif';
      const textWidth = ctx.measureText(label).width;
      const labelX = dx;
      const labelY = Math.max(16, dy - 8);

      ctx.fillStyle = 'rgba(0,0,0,0.65)';
      ctx.fillRect(labelX, labelY - 18, textWidth + 10, 22);
      ctx.fillStyle = '#fff';
      ctx.fillText(label, labelX + 5, labelY);
    });
  };

  return (
    <div className="min-h-screen bg-[#0a0118]">
      <nav className="fixed top-0 left-0 right-0 z-50 bg-[#0a0118]/80 backdrop-blur-xl border-b border-white/10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-violet-600 to-purple-600 flex items-center justify-center text-white">
                <BrainIcon />
              </div>
              <div>
                <h1 className="text-lg font-bold text-white">ALZCare.eg</h1>
                <p className="text-xs text-gray-500">Face Recognition System</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <div className={`h-2 w-2 rounded-full ${cameraActive ? 'bg-green-500 animate-pulse' : 'bg-amber-500'}`} />
              <span className="text-sm text-gray-400">{cameraActive ? 'Live' : 'Starting…'}</span>
            </div>
          </div>
        </div>
      </nav>

      <main className="pt-24 pb-12 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-white mb-2">Face Recognition System</h1>
          <p className="text-gray-400">Live face recognition</p>
        </div>

        <div className="bg-gradient-to-br from-purple-600/20 to-violet-600/20 rounded-2xl p-6 border border-purple-500/30 mb-6">
          <div className="flex items-center gap-3 mb-4">
            <div className="h-10 w-10 rounded-xl bg-purple-500/20 flex items-center justify-center text-purple-400">
              <CameraIcon />
            </div>
            <div className="flex-1">
              <h2 className="text-lg font-bold text-white mb-1">Status</h2>
              <p className="text-sm text-gray-400">{status}</p>
            </div>
          </div>

          {instruction && (
            <div className="mt-4 p-4 bg-white/[0.05] rounded-xl border border-white/10">
              <p className="text-white font-medium">{instruction}</p>
            </div>
          )}
        </div>

        <div className="relative aspect-video overflow-hidden rounded-2xl bg-black border border-white/10 mb-6">
          <video
            ref={videoRef}
            autoPlay
            playsInline
            muted
            className={`h-full w-full object-contain ${cameraActive ? 'block' : 'hidden'}`}
            onLoadedMetadata={() => {
              if (videoRef.current && videoRef.current.videoWidth > 0) {
                setCameraActive(true);
              }
            }}
          />
          <canvas ref={overlayRef} className={`absolute inset-0 pointer-events-none ${cameraActive ? 'block' : 'hidden'}`} />
          <canvas ref={captureCanvasRef} className="hidden" />

          {!cameraActive && (
            <div className="absolute inset-0 flex items-center justify-center text-gray-500">
              <div className="text-center">
                <CameraIconLg />
                <p className="mt-4 text-gray-400">Starting camera…</p>
              </div>
            </div>
          )}
        </div>

        {detections.length > 0 && (
          <div className="bg-white/[0.03] rounded-2xl border border-white/[0.08] p-6 mb-6">
            <h3 className="text-lg font-bold text-white mb-4">Recognition Results</h3>
            <div className="space-y-4">
              {detections.map((d, idx) => (
                <div
                  key={idx}
                  className={`p-4 rounded-xl border ${
                    d.matched
                      ? 'bg-green-500/10 border-green-500/30'
                      : 'bg-orange-500/10 border-orange-500/30'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-bold text-white text-lg">
                        {d.matched ? d.matched.name : 'Unknown Person'}
                      </p>
                      {d.matched && (
                        <p className="text-sm text-gray-400 mt-1">
                          {d.matched.relation} • Age {d.matched.age} • Score: {d.bestScore.toFixed(3)}
                        </p>
                      )}
                    </div>
                    <div className="text-right">
                      <p className="text-xs text-gray-500">Model: {d.bestModel}</p>
                      <p className="text-sm font-medium text-purple-400">Score: {d.bestScore.toFixed(3)}</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="bg-white/[0.03] rounded-2xl border border-white/[0.08] p-6">
          <h3 className="text-lg font-bold text-white mb-4">How to Use</h3>
          <ul className="space-y-3 text-gray-400">
            <li className="flex items-start gap-3">
              <span className="text-purple-400 font-bold">1.</span>
              <span>The camera and face recognition start automatically when you open this page.</span>
            </li>
            <li className="flex items-start gap-3">
              <span className="text-purple-400 font-bold">2.</span>
              <span>Registered faces are matched in real time on the live feed.</span>
            </li>
          </ul>
        </div>
      </main>
    </div>
  );
};

export default PatientPage;
