import React, { useEffect, useRef } from 'react';
import {
  MapContainer,
  TileLayer,
  Marker,
  Circle,
  Popup,
  useMapEvents,
  useMap,
} from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

// Fix Leaflet's default marker icon broken in bundlers
import markerIconPng from 'leaflet/dist/images/marker-icon.png';
import markerIconRetinaPng from 'leaflet/dist/images/marker-icon-2x.png';
import markerShadowPng from 'leaflet/dist/images/marker-shadow.png';

delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconUrl: markerIconPng,
  iconRetinaUrl: markerIconRetinaPng,
  shadowUrl: markerShadowPng,
});

// Custom purple marker icon for zone-center editing
const purpleIcon = new L.Icon({
  iconUrl:
    'data:image/svg+xml;base64,' +
    btoa(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 36" width="24" height="36">
      <path d="M12 0C5.373 0 0 5.373 0 12c0 9 12 24 12 24S24 21 24 12C24 5.373 18.627 0 12 0z" fill="#7c3aed"/>
      <circle cx="12" cy="12" r="5" fill="white"/>
    </svg>`),
  iconSize: [24, 36],
  iconAnchor: [12, 36],
  popupAnchor: [0, -36],
});

// Green marker icon for patient's live position
const greenIcon = new L.Icon({
  iconUrl:
    'data:image/svg+xml;base64,' +
    btoa(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 36" width="24" height="36">
      <path d="M12 0C5.373 0 0 5.373 0 12c0 9 12 24 12 24S24 21 24 12C24 5.373 18.627 0 12 0z" fill="#22c55e"/>
      <circle cx="12" cy="12" r="5" fill="white"/>
    </svg>`),
  iconSize: [24, 36],
  iconAnchor: [12, 36],
  popupAnchor: [0, -36],
});

/** Fires onMapClick with { lat, lng } when the user clicks the map in edit mode. */
const ClickHandler = ({ editMode, onMapClick }) => {
  useMapEvents({
    click(e) {
      if (editMode && onMapClick) {
        onMapClick({ lat: e.latlng.lat, lng: e.latlng.lng });
      }
    },
  });
  return null;
};

/** Smoothly re-centres the map when the target position changes. */
const FlyTo = ({ position }) => {
  const map = useMap();
  const prevPos = useRef(null);

  useEffect(() => {
    if (!position) return;
    const [lat, lng] = position;
    if (
      !prevPos.current ||
      Math.abs(prevPos.current[0] - lat) > 0.0001 ||
      Math.abs(prevPos.current[1] - lng) > 0.0001
    ) {
      map.flyTo([lat, lng], map.getZoom(), { animate: true, duration: 0.8 });
      prevPos.current = position;
    }
  }, [position, map]);

  return null;
};

/**
 * LiveMap — pure presentational map component.
 *
 * Props:
 *   patientLocation  {lat, lng}          – latest patient position (can be null)
 *   zone             {center:{lat,lng}, radius} – current safety zone (can be null)
 *   pendingZone      {lat, lng}          – draft zone centre being edited (can be null)
 *   pendingRadius    number              – draft radius in metres
 *   editMode         boolean             – if true, map clicks set pendingZone centre
 *   onMapClick       ({lat,lng}) => void
 *   flyToPatient     boolean             – whether to auto-pan to patient
 */
const LiveMap = ({
  patientLocation,
  zone,
  pendingZone,
  pendingRadius,
  editMode,
  onMapClick,
  flyToPatient,
}) => {
  // Choose an initial centre: patient → zone → Cairo (default)
  const DEFAULT_CENTER = [30.0444, 31.2357];
  const initialCenter = patientLocation
    ? [patientLocation.lat, patientLocation.lng]
    : zone
    ? [zone.center.lat, zone.center.lng]
    : DEFAULT_CENTER;

  const flyTarget =
    flyToPatient && patientLocation
      ? [patientLocation.lat, patientLocation.lng]
      : null;

  return (
    <MapContainer
      center={initialCenter}
      zoom={15}
      className="h-full w-full rounded-xl"
      style={{ cursor: editMode ? 'crosshair' : 'grab' }}
    >
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
      />

      <ClickHandler editMode={editMode} onMapClick={onMapClick} />
      {flyTarget && <FlyTo position={flyTarget} />}

      {/* Patient live position */}
      {patientLocation && (
        <Marker
          position={[patientLocation.lat, patientLocation.lng]}
          icon={greenIcon}
        >
          <Popup>Patient is here</Popup>
        </Marker>
      )}

      {/* Saved safety zone */}
      {zone && !editMode && (
        <Circle
          center={[zone.center.lat, zone.center.lng]}
          radius={zone.radius}
          pathOptions={{
            color: '#7c3aed',
            fillColor: '#7c3aed',
            fillOpacity: 0.12,
            weight: 2,
          }}
        />
      )}

      {/* Live preview while editing */}
      {editMode && pendingZone && (
        <>
          <Marker position={[pendingZone.lat, pendingZone.lng]} icon={purpleIcon}>
            <Popup>Zone centre</Popup>
          </Marker>
          <Circle
            center={[pendingZone.lat, pendingZone.lng]}
            radius={pendingRadius ?? 150}
            pathOptions={{
              color: '#a855f7',
              fillColor: '#a855f7',
              fillOpacity: 0.18,
              weight: 2,
              dashArray: '6 4',
            }}
          />
        </>
      )}
    </MapContainer>
  );
};

export default LiveMap;
