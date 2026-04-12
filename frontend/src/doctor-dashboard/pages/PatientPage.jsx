import React, { useState, useEffect, useRef } from 'react';
import { faceRecognitionAPI } from '../api';

// ===== ICONS =====
const BrainIcon = () => (
  <svg className="h-8 w-8" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M9.5 2A2.5 2.5 0 0 1 12 4.5v15a2.5 2.5 0 0 1-4.96.44 2.5 2.5 0 0 1-2.96-3.08 3 3 0 0 1-.34-5.58 2.5 2.5 0 0 1 1.32-4.24 2.5 2.5 0 0 1 4.44-2.54"/>
    <path d="M14.5 2A2.5 2.5 0 0 0 12 4.5v15a2.5 2.5 0 0 0 4.96.44 2.5 2.5 0 0 0 2.96-3.08 3 3 0 0 0 .34-5.58 2.5 2.5 0 0 0-1.32-4.24 2.5 2.5 0 0 0-4.44-2.54"/>
  </svg>
);

const MicIcon = () => (
  <svg className="h-6 w-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"/>
    <path d="M19 10v2a7 7 0 0 1-14 0v-2"/>
    <line x1="12" y1="19" x2="12" y2="23"/>
    <line x1="8" y1="23" x2="16" y2="23"/>
  </svg>
);

const CameraIcon = () => (
  <svg className="h-16 w-16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M14.5 4h-5L7 7H4a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2h-3l-2.5-3z"/>
    <circle cx="12" cy="13" r="3"/>
  </svg>
);

const LoadingSpinner = () => (
  <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24" fill="none">
    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"/>
  </svg>
);

const PatientPage = () => {
  const videoRef = useRef(null);
  const overlayRef = useRef(null);
  const captureCanvasRef = useRef(null);
  const recognitionRef = useRef(null);
  const recognitionInFlightRef = useRef(false);
  
  const [isListening, setIsListening] = useState(false);
  const [detections, setDetections] = useState([]);
  const [status, setStatus] = useState('Ready. Listening for voice commands...');
  const [instruction, setInstruction] = useState('');
  const [cameraActive, setCameraActive] = useState(false);
  const [running, setRunning] = useState(false);
  const [intervalMs] = useState(1200);

  // Auto-start voice recognition on mount
  useEffect(() => {
    if (typeof window === 'undefined') return;
    
    if (!('webkitSpeechRecognition' in window) && !('SpeechRecognition' in window)) {
      setStatus('Voice recognition not supported in this browser');
      return;
    }

    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    recognitionRef.current = new SpeechRecognition();
    recognitionRef.current.continuous = true;
    recognitionRef.current.interimResults = false;
    recognitionRef.current.lang = 'en-US';

    recognitionRef.current.onresult = (event) => {
      const transcript = event.results[event.results.length - 1][0].transcript.toLowerCase();

      // Check for activation phrases (English and Arabic)
      const activationPhrases = [
        'who are you',
        'who is this',
        'identify',
        'recognize',
        'who is that',
        'من انت',
        'من هذا',
        'تعرف'
      ];

      const isActivationPhrase = activationPhrases.some((phrase) => transcript.includes(phrase));

      if (isActivationPhrase) {
        handleVoiceActivation();
      }
    };

    recognitionRef.current.onerror = (event) => {
      // Ignore 'aborted' and 'no-speech' errors as they're not critical
      if (event.error === 'aborted' || event.error === 'no-speech') {
        // These are normal and can be ignored
        return;
      }
      
      console.error('Speech recognition error:', event.error);
      if (event.error === 'not-allowed') {
        setStatus('Microphone permission denied. Please allow microphone access.');
      } else if (event.error === 'network') {
        setStatus('Network error. Please check your connection.');
      } else if (event.error !== 'aborted' && event.error !== 'no-speech') {
        // Only show error for critical issues
        console.warn('Speech recognition error (non-critical):', event.error);
      }
    };

    recognitionRef.current.onend = () => {
      if (isListening) {
        // Restart if still listening
        try {
          recognitionRef.current.start();
        } catch (e) {
          console.error('Error restarting recognition:', e);
        }
      }
    };

    // Auto-start listening
    try {
      recognitionRef.current.start();
      setIsListening(true);
      setStatus('Ready. Listening for voice commands... Say "who are you" to start');
    } catch (e) {
      console.error('Error starting recognition:', e);
      setStatus('Error starting voice recognition. Please refresh the page.');
    }

    return () => {
      if (recognitionRef.current) {
        recognitionRef.current.stop();
      }
    };
  }, []); // Empty dependency array - only run once on mount

  const handleVoiceActivation = async () => {
    if (running) return;
    setStatus('Voice command detected! Starting face recognition...');
    setInstruction('Point the camera towards the person');

    // Start camera immediately
    await startCamera();

    // Wait a bit for camera to initialize, then start recognition
    setTimeout(() => {
      if (cameraActive || (videoRef.current && videoRef.current.videoWidth > 0)) {
        setRunning(true);
        setStatus('Face recognition active. Looking for faces...');
      } else {
        // Retry if camera not active yet
        setTimeout(() => {
          if (videoRef.current && videoRef.current.videoWidth > 0) {
            setRunning(true);
            setStatus('Face recognition active. Looking for faces...');
          } else {
            setStatus('Camera failed to activate. Please refresh the page.');
          }
        }, 2000);
      }
    }, 1500);
  };

  const startCamera = async () => {
    try {
      // Stop existing stream if any
      if (videoRef.current && videoRef.current.srcObject) {
        videoRef.current.srcObject.getTracks().forEach((t) => t.stop());
      }

      const stream = await navigator.mediaDevices.getUserMedia({ 
        video: { 
          width: { ideal: 1280 },
          height: { ideal: 720 },
          facingMode: 'user'
        } 
      });
      
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        
        // Wait for video to be ready
        videoRef.current.onloadedmetadata = () => {
          setCameraActive(true);
          setStatus('Camera activated. Face recognition starting...');
        };
        
        videoRef.current.oncanplay = () => {
          if (videoRef.current && videoRef.current.videoWidth > 0) {
            setCameraActive(true);
          }
        };
        
        // Also set after a short delay to ensure video is ready
        setTimeout(() => {
          if (videoRef.current && videoRef.current.videoWidth > 0) {
            setCameraActive(true);
            setStatus('Camera activated. Face recognition starting...');
          }
        }, 500);
      }
    } catch (err) {
      setStatus(`Camera error: ${err.message}`);
      setInstruction('Please allow camera access to continue');
      console.error('Camera error:', err);
      setCameraActive(false);
    }
  };

  const sendFrame = React.useCallback(async () => {
    const video = videoRef.current;
    const captureCanvas = captureCanvasRef.current;
    
    // Check if video is ready
    if (!video || !captureCanvas) return;
    if (!video.videoWidth || !video.videoHeight) return;
    if (!running || !cameraActive) return;
    if (recognitionInFlightRef.current) return;

    // Use full video size for better recognition (like Face_project)
    captureCanvas.width = video.videoWidth;
    captureCanvas.height = video.videoHeight;
    const ctx = captureCanvas.getContext('2d');
    ctx.drawImage(video, 0, 0, captureCanvas.width, captureCanvas.height);
    
    // Use same quality as Face_project
    const dataUrl = captureCanvas.toDataURL('image/jpeg', 0.85);

    recognitionInFlightRef.current = true;
    try {
      const res = await faceRecognitionAPI.recognizePublic(dataUrl);

      const detections = res.detections || [];
      setDetections(detections);
      drawDetections(detections);

      // Update status only once when recognition starts, then keep it as "Live"
      if (status !== 'Live' && status !== 'Face recognition active. Looking for faces...') {
        setStatus('Live');
      }

      if (detections.length > 0) {
        const matched = detections.find((d) => d.matched);
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
  }, [running, cameraActive]);

  useEffect(() => {
    if (!running || !cameraActive) return undefined;

    const timer = setInterval(() => {
      sendFrame();
    }, intervalMs);

    return () => {
      clearInterval(timer);
    };
  }, [running, intervalMs, sendFrame, cameraActive]);

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
      {/* Top Navigation */}
      <nav className="fixed top-0 left-0 right-0 z-50 bg-[#0a0118]/80 backdrop-blur-xl border-b border-white/10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            {/* Logo */}
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-violet-600 to-purple-600 flex items-center justify-center text-white">
                <BrainIcon />
              </div>
              <div>
                <h1 className="text-lg font-bold text-white">ALZCare.eg</h1>
                <p className="text-xs text-gray-500">Face Recognition System</p>
              </div>
            </div>
            {/* Microphone Status Indicator */}
            <div className="flex items-center gap-2">
              <div className={`h-2 w-2 rounded-full ${isListening ? 'bg-green-500 animate-pulse' : 'bg-gray-500'}`} />
              <span className="text-sm text-gray-400">{isListening ? 'Listening...' : 'Offline'}</span>
              {isListening && (
                <div className="flex gap-1">
                  <div className="h-1 w-1 bg-green-400 rounded-full animate-pulse" style={{ animationDelay: '0ms' }} />
                  <div className="h-1 w-1 bg-green-400 rounded-full animate-pulse" style={{ animationDelay: '150ms' }} />
                  <div className="h-1 w-1 bg-green-400 rounded-full animate-pulse" style={{ animationDelay: '300ms' }} />
                </div>
              )}
            </div>
          </div>
        </div>
      </nav>

      {/* Main Content */}
      <main className="pt-24 pb-12 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto">
        {/* Header */}
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-white mb-2">Face Recognition System</h1>
          <p className="text-gray-400">Voice-activated face recognition system</p>
        </div>

        {/* Status Card */}
        <div className="bg-gradient-to-br from-purple-600/20 to-violet-600/20 rounded-2xl p-6 border border-purple-500/30 mb-6">
          <div className="flex items-center gap-3 mb-4">
            <div className="h-10 w-10 rounded-xl bg-purple-500/20 flex items-center justify-center text-purple-400">
              <MicIcon />
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

        {/* Video Feed */}
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
                <CameraIcon />
                <p className="mt-4 text-gray-400">Camera will activate when voice command is detected</p>
              </div>
            </div>
          )}
          
        </div>

        {/* Detection Results */}
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

        {/* Instructions */}
        <div className="bg-white/[0.03] rounded-2xl border border-white/[0.08] p-6">
          <h3 className="text-lg font-bold text-white mb-4">How to Use</h3>
          <ul className="space-y-3 text-gray-400">
            <li className="flex items-start gap-3">
              <span className="text-purple-400 font-bold">1.</span>
              <span>The system is automatically listening for voice commands</span>
            </li>
            <li className="flex items-start gap-3">
              <span className="text-purple-400 font-bold">2.</span>
              <span>Say "who are you" or "who is this" to start face recognition</span>
            </li>
            <li className="flex items-start gap-3">
              <span className="text-purple-400 font-bold">3.</span>
              <span>Point the camera towards the person</span>
            </li>
            <li className="flex items-start gap-3">
              <span className="text-purple-400 font-bold">4.</span>
              <span>The system will automatically recognize registered faces</span>
            </li>
          </ul>
        </div>
      </main>
    </div>
  );
};

export default PatientPage;
