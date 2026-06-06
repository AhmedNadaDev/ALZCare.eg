import React, { useEffect, useRef, useState } from 'react';
import { sendLocation } from '../../location/api/locationApi';

const STATUS = {
  idle:        { label: 'Location Tracking',            color: 'bg-gray-500' },
  requesting:  { label: 'Requesting GPS…',              color: 'bg-yellow-400 animate-pulse' },
  active:      { label: 'Tracking active',              color: 'bg-emerald-400 animate-pulse' },
  denied:      { label: 'Location denied',              color: 'bg-red-500' },
  unsupported: { label: 'GPS unavailable',              color: 'bg-gray-500' },
  error:       { label: 'GPS error',                    color: 'bg-orange-400' },
};

const THROTTLE_MS = 12_000;

/**
 * LocationTracker — background GPS tracker with responsive status pill.
 *
 * Responsive behaviour:
 *   watch (< 480px) → dot only, no text label (saves horizontal nav space)
 *   xs+ (≥ 480px)   → dot + short label
 */
const LocationTracker = () => {
  const [status, setStatus] = useState('idle');
  const lastSentRef = useRef(0);
  const watchIdRef  = useRef(null);

  useEffect(() => {
    if (!navigator.geolocation) {
      setStatus('unsupported');
      return;
    }

    setStatus('requesting');

    const handlePosition = async (position) => {
      setStatus('active');

      const now = Date.now();
      if (now - lastSentRef.current < THROTTLE_MS) return;
      lastSentRef.current = now;

      try {
        await sendLocation({
          lat: position.coords.latitude,
          lng: position.coords.longitude,
          accuracy: position.coords.accuracy,
        });
      } catch (err) {
        console.warn('[LocationTracker] Upload failed:', err.message);
      }
    };

    const handleError = (err) => {
      setStatus(err.code === err.PERMISSION_DENIED ? 'denied' : 'error');
      console.warn('[LocationTracker] Geolocation error:', err.message);
    };

    watchIdRef.current = navigator.geolocation.watchPosition(
      handlePosition,
      handleError,
      { enableHighAccuracy: true, maximumAge: 10_000, timeout: 15_000 }
    );

    return () => {
      if (watchIdRef.current !== null) {
        navigator.geolocation.clearWatch(watchIdRef.current);
      }
    };
  }, []);

  const { label, color } = STATUS[status] ?? STATUS.idle;

  return (
    <div className="flex items-center gap-1.5 xs:gap-2 px-2 xs:px-3 py-1.5 bg-white/[0.04] rounded-full border border-white/10">
      <span className={`h-2 w-2 rounded-full flex-shrink-0 ${color}`} />
      {/* Label: hidden on watch-sized screens, visible on xs+ */}
      <span className="text-[10px] xs:text-xs text-gray-400 hidden xs:block leading-none">{label}</span>
    </div>
  );
};

export default LocationTracker;
