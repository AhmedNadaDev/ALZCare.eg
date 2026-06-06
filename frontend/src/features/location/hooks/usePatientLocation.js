import { useState, useEffect, useCallback, useRef } from 'react';
import { fetchPatientLocation } from '../api/locationApi';

const POLL_INTERVAL_MS = 8_000; // refresh every 8 seconds

/**
 * Polls the backend for the linked patient's latest location and safety zone.
 * Used exclusively in the Family Dashboard.
 *
 * @param {string|null} patientId - MongoDB ObjectId of the patient
 */
const usePatientLocation = (patientId) => {
  const [location, setLocation]   = useState(null); // PatientLocation doc
  const [zone, setZone]           = useState(null);  // SafetyZone doc
  const [loading, setLoading]     = useState(true);
  const [error, setError]         = useState(null);
  const [lastUpdated, setLastUpdated] = useState(null);

  const isMounted = useRef(true);

  const fetchData = useCallback(async () => {
    if (!patientId) return;
    try {
      const data = await fetchPatientLocation(patientId);
      if (!isMounted.current) return;
      setLocation(data?.location ?? null);
      setZone(data?.zone ?? null);
      setLastUpdated(new Date());
      setError(null);
    } catch (err) {
      if (!isMounted.current) return;
      setError(err.message);
    } finally {
      if (isMounted.current) setLoading(false);
    }
  }, [patientId]);

  useEffect(() => {
    isMounted.current = true;
    setLoading(true);
    fetchData();

    const interval = setInterval(fetchData, POLL_INTERVAL_MS);
    return () => {
      isMounted.current = false;
      clearInterval(interval);
    };
  }, [fetchData]);

  return { location, zone, loading, error, lastUpdated, refresh: fetchData };
};

export default usePatientLocation;
