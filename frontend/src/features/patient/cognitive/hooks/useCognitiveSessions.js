import { useState, useEffect, useCallback } from 'react';
import { cognitiveAPI } from '../../../../modules/shared/api/api';
import { getSocket, joinPatientRoom } from '../../../../modules/shared/socket/socketClient';

/**
 * Patient-side cognitive session state. Loads today's due sessions and
 * available activities, and listens for real-time `cognitive:session-due`
 * triggers from the scheduler (joining the shared patient room).
 */
export const useCognitiveSessions = (patientId) => {
  const [due, setDue] = useState([]);
  const [activities, setActivities] = useState([]);
  const [loading, setLoading] = useState(true);
  const [autoStartId, setAutoStartId] = useState(null);

  const refresh = useCallback(async () => {
    if (!patientId) return;
    try {
      const [dueRes, actRes] = await Promise.all([
        cognitiveAPI.getDueSessions(patientId),
        cognitiveAPI.getActivities(patientId),
      ]);
      setDue(dueRes.data || []);
      setActivities((actRes.data || []).filter((a) => a.enabled));
    } catch {
      /* keep last good state */
    } finally {
      setLoading(false);
    }
  }, [patientId]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  useEffect(() => {
    if (!patientId) return;
    const socket = getSocket();
    joinPatientRoom(patientId);

    const onDue = (payload) => {
      refresh();
      if (payload?.autoStart && payload?.session?._id) setAutoStartId(payload.session._id);
    };
    const onChange = () => refresh();

    socket.on('cognitive:session-due', onDue);
    socket.on('cognitive:session-completed', onChange);
    return () => {
      socket.off('cognitive:session-due', onDue);
      socket.off('cognitive:session-completed', onChange);
    };
  }, [patientId, refresh]);

  return { due, activities, loading, refresh, autoStartId, clearAutoStart: () => setAutoStartId(null) };
};
