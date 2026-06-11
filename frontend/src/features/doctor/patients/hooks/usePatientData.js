import { useState, useEffect, useCallback } from 'react';
import { patientsAPI, medicationsAPI, aiMoodAPI } from '../services/patientService';
import { getSocket, joinPatientRoom } from '../../../../modules/shared/socket/socketClient';

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
        aiMoodAPI.getHistory(id, { days: 30, limit: 30 }),
        aiMoodAPI.getStats(id, 30),
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

  // Real-time AI mood updates: join the patient room and refresh on new check-ins.
  useEffect(() => {
    if (!id) return;
    const socket = getSocket();
    joinPatientRoom(id);

    const onMoodUpdated = ({ mood } = {}) => {
      if (!mood) return;
      console.log('[usePatientData] mood:updated received:', mood.mood, mood.arousal);
      setMoodHistory((prev) => [mood, ...prev.filter((m) => m._id !== mood._id).slice(0, 49)]);
      // Refresh the aggregated breakdown so stats stay in sync.
      aiMoodAPI.getStats(id, 30).then((r) => setMoodStats(r.data || null)).catch(() => {});
    };

    socket.on('mood:updated', onMoodUpdated);
    return () => socket.off('mood:updated', onMoodUpdated);
  }, [id]);

  return { patient, medications, moodHistory, moodStats, loading, refetch: fetchData };
};

export default usePatientData;
