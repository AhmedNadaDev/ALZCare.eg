import { useState, useCallback } from 'react';
import { medicationsAPI, moodsAPI } from '../services/familyPatientService';

const useFamilyPatientData = () => {
  const [medications, setMedications] = useState([]);
  const [moodHistory, setMoodHistory] = useState([]);
  const [moodStats, setMoodStats] = useState(null);
  const [loading, setLoading] = useState(true);

  const fetchData = useCallback(async (patientId) => {
    if (!patientId) return;
    try {
      setLoading(true);
      const [medsRes, moodsRes, statsRes] = await Promise.all([
        medicationsAPI.getByPatient(patientId),
        moodsAPI.getByPatient(patientId, { days: 30, limit: 10 }),
        moodsAPI.getStats(patientId, 30),
      ]);

      setMedications(medsRes.data || []);
      setMoodHistory(moodsRes.data || []);
      setMoodStats(statsRes.data || null);
    } catch (error) {
      console.error('Failed to fetch data:', error);
    } finally {
      setLoading(false);
    }
  }, []);

  return { medications, moodHistory, moodStats, loading, fetchData };
};

export default useFamilyPatientData;
