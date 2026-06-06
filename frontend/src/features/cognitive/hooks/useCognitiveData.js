import { useState, useEffect, useCallback } from 'react';
import { cognitiveAPI } from '../../../modules/shared/api/api';

/**
 * Loads and manages all cognitive management data for a patient:
 * exercise templates, memory albums, assignments, schedules and analytics.
 * Exposes granular refetchers so individual tabs refresh only what changed.
 */
export const useCognitiveData = (patientId) => {
  const [templates, setTemplates] = useState([]);
  const [albums, setAlbums] = useState([]);
  const [assignments, setAssignments] = useState([]);
  const [schedules, setSchedules] = useState([]);
  const [analytics, setAnalytics] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const refetchAlbums = useCallback(async () => {
    if (!patientId) return;
    const res = await cognitiveAPI.listAlbums(patientId, true);
    setAlbums(res.data || []);
  }, [patientId]);

  const refetchAssignments = useCallback(async () => {
    if (!patientId) return;
    const res = await cognitiveAPI.listAssignments(patientId);
    setAssignments(res.data || []);
  }, [patientId]);

  const refetchSchedules = useCallback(async () => {
    if (!patientId) return;
    const res = await cognitiveAPI.listSchedules(patientId);
    setSchedules(res.data || []);
  }, [patientId]);

  const refetchAnalytics = useCallback(async (days = 30) => {
    if (!patientId) return;
    const res = await cognitiveAPI.getAnalytics(patientId, days);
    setAnalytics(res.data || null);
  }, [patientId]);

  const loadAll = useCallback(async () => {
    if (!patientId) return;
    setLoading(true);
    setError(null);
    try {
      const [tpl] = await Promise.all([
        cognitiveAPI.getTemplates(),
        refetchAlbums(),
        refetchAssignments(),
        refetchSchedules(),
        refetchAnalytics(),
      ]);
      setTemplates(tpl.data || []);
    } catch (err) {
      setError(err.message || 'Failed to load cognitive data');
    } finally {
      setLoading(false);
    }
  }, [patientId, refetchAlbums, refetchAssignments, refetchSchedules, refetchAnalytics]);

  useEffect(() => {
    loadAll();
  }, [loadAll]);

  return {
    templates,
    albums,
    assignments,
    schedules,
    analytics,
    loading,
    error,
    refetchAlbums,
    refetchAssignments,
    refetchSchedules,
    refetchAnalytics,
    reload: loadAll,
  };
};
