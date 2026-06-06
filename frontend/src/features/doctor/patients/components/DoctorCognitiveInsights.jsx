import React, { useState, useEffect, useCallback } from 'react';
import { cognitiveAPI } from '../../../../modules/shared/api/api';
import CognitiveInsights from '../../../cognitive/components/CognitiveInsights';

/**
 * DoctorCognitiveInsights — read-only cognitive analytics for a patient,
 * embedded in the doctor's patient detail view. Reuses the shared
 * CognitiveInsights dashboard with a self-managed data range.
 */
const DoctorCognitiveInsights = ({ patientId }) => {
  const [analytics, setAnalytics] = useState(null);
  const [loading, setLoading] = useState(true);
  const [range, setRange] = useState(30);
  const [error, setError] = useState(null);

  const load = useCallback(async (days) => {
    if (!patientId) return;
    setLoading(true);
    setError(null);
    try {
      const res = await cognitiveAPI.getAnalytics(patientId, days);
      setAnalytics(res.data || null);
    } catch (e) {
      setError(e.message || 'Failed to load cognitive analytics');
    } finally {
      setLoading(false);
    }
  }, [patientId]);

  useEffect(() => { load(range); }, [load, range]);

  if (error) {
    return <div className="px-4 py-3 rounded-xl bg-red-500/10 border border-red-500/30 text-red-300 text-sm">{error}</div>;
  }

  return (
    <CognitiveInsights
      analytics={analytics}
      loading={loading}
      range={range}
      onRangeChange={setRange}
    />
  );
};

export default DoctorCognitiveInsights;
