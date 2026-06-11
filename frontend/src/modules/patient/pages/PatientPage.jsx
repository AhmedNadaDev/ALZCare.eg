import React, { useEffect } from 'react';
import { useAuth } from '../../shared/auth/AuthContext';
import LocationTracker from '../../../features/patient/components/LocationTracker';
import MoodCheckinModal from '../../../features/patient/components/MoodCheckinModal';
import CheckinPrimer from '../../../features/patient/components/CheckinPrimer';
import VoiceInteractionModal from '../../../features/patient/components/VoiceInteractionModal';
import { useMoodCheckin } from '../../../features/patient/hooks/useMoodCheckin';
import { useVoiceEngine } from '../../../features/patient/hooks/useVoiceEngine';
import CognitiveSessions from '../../../features/patient/cognitive/components/CognitiveSessions';

// ── Event-type metadata (mirrors the DailyPlan family component) ──────────────
const EVENT_TYPE_CFG = {
  wake_up:     { emoji: '🌅', label: 'Wake Up',     gradient: 'from-amber-500/20 to-yellow-500/20',  border: 'border-amber-500/30',  text: 'text-amber-400'   },
  medication:  { emoji: '💊', label: 'Medication',  gradient: 'from-blue-500/20 to-cyan-500/20',     border: 'border-blue-500/30',   text: 'text-blue-400'    },
  appointment: { emoji: '🏥', label: 'Appointment', gradient: 'from-purple-500/20 to-violet-500/20', border: 'border-purple-500/30', text: 'text-purple-400'  },
  custom:      { emoji: '📌', label: 'Activity',    gradient: 'from-green-500/20 to-emerald-500/20', border: 'border-green-500/30',  text: 'text-green-400'   },
};

const STATUS_CFG = {
  completed: { label: 'Done',    cls: 'bg-green-500/20 text-green-400 border-green-500/30' },
  missed:    { label: 'Missed',  cls: 'bg-red-500/20   text-red-400   border-red-500/30'   },
  pending:   { label: 'Pending', cls: 'bg-gray-500/20  text-gray-400  border-gray-500/30'  },
};

// ── Icons ─────────────────────────────────────────────────────────────────────
const BrainIcon = () => (
  <svg className="h-8 w-8" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M9.5 2A2.5 2.5 0 0 1 12 4.5v15a2.5 2.5 0 0 1-4.96.44 2.5 2.5 0 0 1-2.96-3.08 3 3 0 0 1-.34-5.58 2.5 2.5 0 0 1 1.32-4.24 2.5 2.5 0 0 1 4.44-2.54"/>
    <path d="M14.5 2A2.5 2.5 0 0 0 12 4.5v15a2.5 2.5 0 0 0 4.96.44 2.5 2.5 0 0 0 2.96-3.08 3 3 0 0 0 .34-5.58 2.5 2.5 0 0 0-1.32-4.24 2.5 2.5 0 0 0-4.44-2.54"/>
  </svg>
);

const CalendarIcon = () => (
  <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/>
  </svg>
);

// ── Today's Events — shows daily plan events created by the family ─────────────
const TodayEvents = ({ plan }) => {
  if (!plan) return null;

  const sorted = [...(plan.events || [])].sort((a, b) =>
    a.scheduledTime.localeCompare(b.scheduledTime)
  );

  const completedCount = sorted.filter((e) => e.status === 'completed').length;
  const totalCount     = sorted.length;

  return (
    <div className="mb-8">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-xl bg-indigo-500/20 flex items-center justify-center text-indigo-400">
            <CalendarIcon />
          </div>
          <div>
            <h3 className="text-lg font-bold text-white">Today's Plan</h3>
            <p className="text-xs text-gray-500">
              {completedCount}/{totalCount} completed
            </p>
          </div>
        </div>
        {totalCount > 0 && (
          <div className="flex items-center gap-1.5 px-3 py-1.5 bg-white/[0.04] rounded-full border border-white/10">
            <div
              className="h-1.5 rounded-full bg-green-500 transition-all"
              style={{ width: `${Math.round((completedCount / totalCount) * 100)}%`, minWidth: '4px', maxWidth: '60px' }}
            />
            <span className="text-xs text-gray-500">{Math.round((completedCount / totalCount) * 100)}%</span>
          </div>
        )}
      </div>

      {sorted.length === 0 ? (
        <div className="text-center py-10 bg-white/[0.02] border border-white/[0.06] rounded-2xl">
          <div className="text-4xl mb-3">📅</div>
          <p className="text-gray-400">No events planned for today</p>
          <p className="text-gray-600 text-sm mt-1">Your family will add activities soon</p>
        </div>
      ) : (
        <div className="space-y-3">
          {sorted.map((event) => {
            const typeCfg   = EVENT_TYPE_CFG[event.type] || EVENT_TYPE_CFG.custom;
            const statusCfg = STATUS_CFG[event.status]   || STATUS_CFG.pending;
            return (
              <div
                key={event._id}
                className={`flex items-start gap-4 p-4 bg-gradient-to-br ${typeCfg.gradient} border ${typeCfg.border} rounded-2xl`}
              >
                <div className="flex-shrink-0 text-center min-w-[52px]">
                  <p className="text-sm font-mono font-bold text-white">{event.scheduledTime}</p>
                </div>
                <div className="flex-shrink-0 h-10 w-10 rounded-xl bg-black/20 flex items-center justify-center text-xl">
                  {typeCfg.emoji}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className={`font-semibold ${typeCfg.text} truncate`}>{event.title}</p>
                    <span className={`text-xs px-2 py-0.5 rounded-full border font-medium flex-shrink-0 ${statusCfg.cls}`}>
                      {statusCfg.label}
                    </span>
                  </div>
                  {event.voicePrompt?.text && (
                    <p className="text-gray-300 text-sm mt-1 leading-relaxed line-clamp-2">
                      {event.voicePrompt.text}
                    </p>
                  )}
                  {event.response?.text && (
                    <div className="mt-2 px-3 py-1.5 bg-black/20 rounded-lg">
                      <p className="text-xs text-gray-500">Your response</p>
                      <p className="text-sm text-gray-300 italic">"{event.response.text}"</p>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

// ── Main PatientPage ──────────────────────────────────────────────────────────
const PatientPage = () => {
  const { user, refreshUser } = useAuth();

  const patientId   = user?._id;
  const patientName = user?.fullName
    || `${user?.firstName || ''} ${user?.lastName || ''}`.trim()
    || 'Patient';

  const { activeCheckin, dismissCheckin, checkinDone } = useMoodCheckin(patientId);
  const { plan, activeEvent, connected, dismissEvent, completeEvent } = useVoiceEngine(patientId);

  useEffect(() => {
    refreshUser();
  }, [refreshUser]);

  // ===== Face Recognition — temporarily disabled =====
  // To re-enable, uncomment this block and restore the import:
  //   import { recognizeFromPatientPage } from '../../../features/shared/Service-ai-models/face-recognition';
  //
  // const videoRef = useRef(null);
  // const overlayRef = useRef(null);
  // const captureCanvasRef = useRef(null);
  // const recognitionInFlightRef = useRef(false);
  // const [detections, setDetections] = useState([]);
  // const [cameraActive, setCameraActive] = useState(false);
  // const [intervalMs] = useState(1200);
  //
  // useEffect(() => {
  //   let cancelled = false;
  //   const startCamera = async () => {
  //     try {
  //       if (videoRef.current?.srcObject)
  //         videoRef.current.srcObject.getTracks().forEach((t) => t.stop());
  //       const stream = await navigator.mediaDevices.getUserMedia({
  //         video: { width: { ideal: 1280 }, height: { ideal: 720 }, facingMode: 'user' },
  //       });
  //       if (cancelled) { stream.getTracks().forEach((t) => t.stop()); return; }
  //       const video = videoRef.current;
  //       if (!video) { stream.getTracks().forEach((t) => t.stop()); return; }
  //       video.srcObject = stream;
  //       const onReady = () => { if (video.videoWidth > 0) setCameraActive(true); };
  //       video.onloadedmetadata = onReady;
  //       video.oncanplay = onReady;
  //       setTimeout(onReady, 300);
  //     } catch (err) {
  //       if (!cancelled) setCameraActive(false);
  //     }
  //   };
  //   startCamera();
  //   return () => {
  //     cancelled = true;
  //     const v = videoRef.current;
  //     if (v?.srcObject) { v.srcObject.getTracks().forEach((t) => t.stop()); v.srcObject = null; }
  //   };
  // }, []);
  //
  // const sendFrame = useCallback(async () => {
  //   const video = videoRef.current;
  //   const captureCanvas = captureCanvasRef.current;
  //   if (!video || !captureCanvas || !video.videoWidth || !video.videoHeight) return;
  //   if (!cameraActive || recognitionInFlightRef.current) return;
  //   captureCanvas.width = video.videoWidth;
  //   captureCanvas.height = video.videoHeight;
  //   const ctx = captureCanvas.getContext('2d');
  //   ctx.drawImage(video, 0, 0, captureCanvas.width, captureCanvas.height);
  //   const dataUrl = captureCanvas.toDataURL('image/jpeg', 0.85);
  //   recognitionInFlightRef.current = true;
  //   try {
  //     const res = await recognizeFromPatientPage(dataUrl);
  //     const nextDetections = res.detections || [];
  //     setDetections(nextDetections);
  //     drawDetections(nextDetections);
  //   } catch (err) {
  //     console.error('Recognition error:', err);
  //   } finally {
  //     recognitionInFlightRef.current = false;
  //   }
  // }, [cameraActive]);
  //
  // useEffect(() => {
  //   if (!cameraActive) return undefined;
  //   const timer = setInterval(sendFrame, intervalMs);
  //   return () => clearInterval(timer);
  // }, [cameraActive, intervalMs, sendFrame]);

  return (
    <div className="min-h-screen bg-[#0a0118]">

      {/* ── Floating status strip (top-right) ─────────────────────────────
          Preserved: GPS status dots (LocationTracker) + Socket.IO live dot.
          Moved here after navbar removal so both dots remain visible. */}
      <div className="fixed top-4 right-4 z-50 flex items-center gap-2">
        <LocationTracker />
        <div className="flex items-center gap-1.5 px-2.5 py-1.5 bg-[#0a0118]/80 backdrop-blur-sm rounded-full border border-white/10">
          <span className={`h-2 w-2 rounded-full flex-shrink-0 ${connected ? 'bg-emerald-400 animate-pulse' : 'bg-gray-500'}`} />
          <span className="text-[10px] text-gray-400 leading-none">
            {connected ? 'Live' : 'Connecting…'}
          </span>
        </div>
      </div>

      {/* ── Main content ────────────────────────────────────────────────── */}
      <main className="pt-8 pb-16 px-4 sm:px-6 lg:px-8 max-w-5xl mx-auto">

        {patientId ? (
          <>
            {/* One-time mic/audio grant so scheduled check-ins run hands-free */}
            <CheckinPrimer />

            <TodayEvents plan={plan} />

            <div className="mt-2">
              <div className="flex items-center gap-3 mb-5">
                <div className="h-10 w-10 rounded-xl bg-purple-500/20 flex items-center justify-center text-purple-400">
                  <BrainIcon />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-white">Mind Activities</h3>
                  <p className="text-xs text-gray-500">Exercises and memory albums from your family</p>
                </div>
              </div>
              <CognitiveSessions patientId={patientId} />
            </div>
          </>
        ) : (
          <div className="flex justify-center py-32">
            <div className="w-12 h-12 border-4 border-purple-500/30 border-t-purple-500 rounded-full animate-spin" />
          </div>
        )}

      </main>

      {activeCheckin && (
        <MoodCheckinModal
          checkin={activeCheckin}
          patientId={patientId}
          onDone={checkinDone}
          onDismiss={dismissCheckin}
        />
      )}

      {activeEvent && (
        <VoiceInteractionModal
          event={activeEvent}
          patientName={patientName}
          planId={activeEvent.planId}
          onComplete={completeEvent}
          onDismiss={dismissEvent}
        />
      )}

    </div>
  );
};

export default PatientPage;
