/**
 * Location & Safety-Zone API
 *
 * Thin re-exports from the shared api.js locationAPI object so that
 * ALL requests go through the same apiRequest function — which now uses
 * the explicit USER_ROLE_KEY to always pick the correct token.
 *
 * This eliminates the previous bug where a hand-rolled fetch call could
 * read a stale/wrong token from localStorage.
 */
import { locationAPI } from '../../../modules/shared/api/api.js';

/** Patient: send current GPS coordinates to the backend. */
export const sendLocation = ({ lat, lng, accuracy }) =>
  locationAPI.sendPatientLocation({ lat, lng, accuracy: accuracy ?? null });

/**
 * Family: fetch the linked patient's latest location + safety zone.
 * Returns `{ location, zone }` (the `data` field from the JSON envelope).
 */
export const fetchPatientLocation = async (patientId) => {
  const json = await locationAPI.getPatientLocation(patientId);
  return json.data; // { location, zone }
};

/** Family: create or replace the safety zone for the linked patient. */
export const saveSafetyZone = async ({ centerLat, centerLng, radius }) => {
  const json = await locationAPI.saveSafetyZone({ centerLat, centerLng, radius });
  return json.data;
};

/** Family: get the current safety zone for a patient. */
export const fetchSafetyZone = async (patientId) => {
  const json = await locationAPI.getSafetyZone(patientId);
  return json.data;
};
