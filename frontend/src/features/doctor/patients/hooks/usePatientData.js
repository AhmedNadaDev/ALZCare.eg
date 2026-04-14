import { useState, useEffect, useCallback } from 'react';
import { patientsAPI, medicationsAPI, moodsAPI } from '../services/patientService';

const usePatientData = (id) => {
  const [patient, setPatient] = useState(null);
  const [medications, setMedications] = useState([]);
  const [moodHistory, setMoodHistory] = useState([]);
  const [moodStats, setMoodStats] = useState(null);
  const [loading, setLoading] = useState(true);

  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      const [patientRes, medsRes, moodsRes, statsRes] = await Promise.all([
        patientsAPI.getById(id),
        medicationsAPI.getByPatient(id),
        moodsAPI.getByPatient(id, { days: 30, limit: 10 }),
        moodsAPI.getStats(id, 30),
      ]);

      setPatient(patientRes.data);
      setMedications(medsRes.data || []);
      setMoodHistory(moodsRes.data || []);
      setMoodStats(statsRes.data || null);
    } catch (error) {
      console.error('Failed to fetch data:', error);
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  return { patient, medications, moodHistory, moodStats, loading, refetch: fetchData };
};

export default usePatientData;
