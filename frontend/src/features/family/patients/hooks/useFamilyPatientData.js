import { useState, useCallback } from 'react';
import { medicationsAPI, aiMoodAPI } from '../../../../modules/shared/api/api';

const useFamilyPatientData = () => {
  const [medications, setMedications]   = useState([]);
  const [aiMoodHistory, setAiMoodHistory] = useState([]);
  const [aiMoodStats, setAiMoodStats]     = useState(null);
  const [latestMood, setLatestMood]       = useState(null);
  const [moodSchedule, setMoodSchedule]   = useState(null);
  const [loading, setLoading] = useState(true);

  const fetchData = useCallback(async (patientId) => {
    if (!patientId) return;
    try {
      setLoading(true);
      const [medsRes, historyRes, statsRes, latestRes, scheduleRes] = await Promise.all([
        medicationsAPI.getByPatient(patientId),
        aiMoodAPI.getHistory(patientId, { days: 30, limit: 20 }),
        aiMoodAPI.getStats(patientId, 30),
        aiMoodAPI.getLatest(patientId),
        aiMoodAPI.getSchedule(patientId),
      ]);

      setMedications(medsRes.data || []);
      setAiMoodHistory(historyRes.data || []);
      setAiMoodStats(statsRes.data || null);
      setLatestMood(latestRes.data || null);
      setMoodSchedule(scheduleRes.data || null);
    } catch (error) {
      console.error('[useFamilyPatientData] fetch error:', error);
    } finally {
      setLoading(false);
    }
  }, []);

  return {
    medications,
    aiMoodHistory,
    aiMoodStats,
    latestMood,
    moodSchedule,
    loading,
    fetchData,
  };
};

export default useFamilyPatientData;
