import React, { useState, Suspense, lazy, useCallback } from 'react';
import usePatientLocation from '../hooks/usePatientLocation';
import StatusBadge from './StatusBadge';
import { saveSafetyZone } from '../api/locationApi';

// Lazy-load the map to avoid any SSR-style issues and keep initial bundle slim
const LiveMap = lazy(() => import('./LiveMap'));

const MapSpinner = () => (
  <div className="h-full w-full flex items-center justify-center bg-white/[0.02] rounded-xl">
    <div className="w-10 h-10 border-4 border-purple-500/30 border-t-purple-500 rounded-full animate-spin" />
  </div>
);

// Icon components to avoid external icon deps
const TargetIcon = () => (
  <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
    <circle cx="12" cy="12" r="10" /><circle cx="12" cy="12" r="6" /><circle cx="12" cy="12" r="2" />
  </svg>
);
const EditIcon = () => (
  <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
  </svg>
);
const SaveIcon = () => (
  <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
  </svg>
);
const CancelIcon = () => (
  <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
  </svg>
);

/**
 * LocationTab — full Location & Safety Zone panel displayed in the
 * Family Patient Details page.
 *
 * @param {string} patientId - MongoDB ObjectId of the linked patient
 * @param {string} patientName - First name for display purposes
 */
const LocationTab = ({ patientId, patientName }) => {
  const { location, zone, loading, error, lastUpdated, refresh } =
    usePatientLocation(patientId);

  // Zone editing state
  const [editMode, setEditMode]         = useState(false);
  const [pendingCenter, setPendingCenter] = useState(null); // { lat, lng }
  const [pendingRadius, setPendingRadius] = useState(150);   // metres
  const [saving, setSaving]             = useState(false);
  const [saveError, setSaveError]       = useState(null);
  const [flyToPatient, setFlyToPatient] = useState(false);

  const handleMapClick = useCallback(({ lat, lng }) => {
    setPendingCenter({ lat, lng });
  }, []);

  const handleEnterEditMode = () => {
    // Pre-populate from existing zone if available
    if (zone) {
      setPendingCenter({ lat: zone.center.lat, lng: zone.center.lng });
      setPendingRadius(zone.radius);
    } else {
      // Default to patient's current location or Cairo
      setPendingCenter(
        location
          ? { lat: location.lat, lng: location.lng }
          : { lat: 30.0444, lng: 31.2357 }
      );
    }
    setSaveError(null);
    setEditMode(true);
  };

  const handleCancelEdit = () => {
    setEditMode(false);
    setPendingCenter(null);
    setSaveError(null);
  };

  const handleSaveZone = async () => {
    if (!pendingCenter) {
      setSaveError('Please click on the map to set the zone centre.');
      return;
    }
    setSaving(true);
    setSaveError(null);
    try {
      await saveSafetyZone({
        centerLat: pendingCenter.lat,
        centerLng: pendingCenter.lng,
        radius: pendingRadius,
      });
      setEditMode(false);
      setPendingCenter(null);
      await refresh(); // pull fresh data immediately
    } catch (err) {
      setSaveError(err.message || 'Failed to save zone.');
    } finally {
      setSaving(false);
    }
  };

  const handleCenterOnPatient = () => {
    setFlyToPatient(true);
    setTimeout(() => setFlyToPatient(false), 1000);
  };

  // ── Render states ────────────────────────────────────────────────────────

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <div className="w-12 h-12 border-4 border-purple-500/30 border-t-purple-500 rounded-full animate-spin" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-6 text-center">
        <p className="text-red-400 font-medium">Failed to load location data</p>
        <p className="text-sm text-gray-500 mt-1">{error}</p>
        <button
          onClick={refresh}
          className="mt-4 px-4 py-2 text-sm bg-white/[0.05] hover:bg-white/[0.08] border border-white/10 text-gray-300 rounded-xl transition-all"
        >
          Retry
        </button>
      </div>
    );
  }

  const patientPos = location ? { lat: location.lat, lng: location.lng } : null;
  const hasZone = Boolean(zone);

  return (
    <div className="space-y-5">
      {/* ── Status row ────────────────────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 bg-white/[0.03] rounded-2xl p-4 border border-white/[0.08]">
        <div>
          <h3 className="text-sm font-semibold text-gray-400 mb-2">Current Status</h3>
          {!location ? (
            <span className="text-sm text-gray-500">
              No location received yet. Patient device may be offline.
            </span>
          ) : (
            <StatusBadge
              status={hasZone ? location.lastKnownStatus : 'unknown'}
              lastUpdated={lastUpdated}
            />
          )}
          {!hasZone && location && (
            <p className="text-xs text-yellow-400/80 mt-2">
              No safety zone defined. Set one below to enable zone alerts.
            </p>
          )}
        </div>
        {location && (
          <button
            onClick={handleCenterOnPatient}
            className="inline-flex items-center gap-2 px-3 py-2 text-sm bg-purple-500/20 hover:bg-purple-500/30 border border-purple-500/30 text-purple-300 rounded-xl transition-all"
          >
            <TargetIcon />
            Centre on {patientName || 'Patient'}
          </button>
        )}
      </div>

      {/* ── Live map ──────────────────────────────────────────────────── */}
      <div className="bg-white/[0.03] rounded-2xl border border-white/[0.08] overflow-hidden">
        <div style={{ height: '380px' }}>
          <Suspense fallback={<MapSpinner />}>
            <LiveMap
              patientLocation={patientPos}
              zone={zone}
              pendingZone={pendingCenter}
              pendingRadius={pendingRadius}
              editMode={editMode}
              onMapClick={handleMapClick}
              flyToPatient={flyToPatient}
            />
          </Suspense>
        </div>

        {editMode && (
          <div className="px-4 py-2 bg-purple-500/10 border-t border-purple-500/20 text-xs text-purple-300 text-center">
            Click anywhere on the map to set the zone centre
          </div>
        )}
      </div>

      {/* ── Zone editor controls ──────────────────────────────────────── */}
      <div className="bg-white/[0.03] rounded-2xl border border-white/[0.08] p-5">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="text-base font-semibold text-white">
              {hasZone ? 'Safety Zone' : 'Set Up Safety Zone'}
            </h3>
            {hasZone && !editMode && (
              <p className="text-xs text-gray-500 mt-0.5">
                Centre: {zone.center.lat.toFixed(5)}, {zone.center.lng.toFixed(5)} •{' '}
                Radius: {zone.radius}m
              </p>
            )}
          </div>

          {!editMode && (
            <button
              onClick={handleEnterEditMode}
              className="inline-flex items-center gap-2 px-3 py-2 text-sm bg-white/[0.05] hover:bg-white/[0.08] border border-white/10 text-gray-300 hover:text-white rounded-xl transition-all"
            >
              <EditIcon />
              {hasZone ? 'Edit Zone' : 'Define Zone'}
            </button>
          )}
        </div>

        {editMode && (
          <div className="space-y-4">
            {/* Radius slider */}
            <div>
              <div className="flex justify-between text-xs text-gray-400 mb-1">
                <span>Radius</span>
                <span className="font-semibold text-purple-300">{pendingRadius}m</span>
              </div>
              <input
                type="range"
                min={50}
                max={500}
                step={10}
                value={pendingRadius}
                onChange={(e) => setPendingRadius(Number(e.target.value))}
                className="w-full h-2 rounded-full appearance-none cursor-pointer bg-white/10 accent-purple-500"
              />
              <div className="flex justify-between text-xs text-gray-600 mt-0.5">
                <span>50m</span>
                <span>500m</span>
              </div>
            </div>

            {/* Selected centre info */}
            {pendingCenter && (
              <p className="text-xs text-gray-400">
                Centre set to{' '}
                <span className="text-purple-300 font-medium">
                  {pendingCenter.lat.toFixed(5)}, {pendingCenter.lng.toFixed(5)}
                </span>
              </p>
            )}

            {saveError && (
              <p className="text-sm text-red-400 bg-red-500/10 border border-red-500/20 rounded-xl px-4 py-2">
                {saveError}
              </p>
            )}

            <div className="flex gap-3">
              <button
                onClick={handleSaveZone}
                disabled={saving || !pendingCenter}
                className="flex-1 inline-flex items-center justify-center gap-2 px-4 py-2.5 bg-purple-600 hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed text-white font-medium rounded-xl transition-all text-sm"
              >
                {saving ? (
                  <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                ) : (
                  <SaveIcon />
                )}
                {saving ? 'Saving…' : 'Save Zone'}
              </button>
              <button
                onClick={handleCancelEdit}
                disabled={saving}
                className="inline-flex items-center gap-2 px-4 py-2.5 bg-white/[0.05] hover:bg-white/[0.08] border border-white/10 text-gray-400 hover:text-white rounded-xl transition-all text-sm"
              >
                <CancelIcon />
                Cancel
              </button>
            </div>
          </div>
        )}

        {!editMode && !hasZone && (
          <p className="text-sm text-gray-500">
            Define a safety zone to get real-time alerts when{' '}
            {patientName || 'the patient'} leaves the area.
          </p>
        )}
      </div>
    </div>
  );
};

export default LocationTab;
