import React, { useState } from 'react';
import { useAuth } from '../../../../modules/shared/auth/AuthContext';
import { useCognitiveData } from '../../../cognitive/hooks/useCognitiveData';
import { Spinner } from '../../../cognitive/constants.jsx';
import AlbumsManager from '../../../cognitive/components/AlbumsManager';
import ExercisesManager from '../../../cognitive/components/ExercisesManager';
import ScheduleManager from '../../../cognitive/components/ScheduleManager';
import CognitiveInsights from '../../../cognitive/components/CognitiveInsights';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faImages, faBrain, faCalendarDays, faChartColumn, faPuzzlePiece } from '@fortawesome/free-solid-svg-icons';

const TABS = [
  { key: 'albums',    label: 'Albums',     icon: faImages },
  { key: 'exercises', label: 'Activities', icon: faBrain },
  { key: 'schedule',  label: 'Schedule',   icon: faCalendarDays },
  { key: 'insights',  label: 'Insights',   icon: faChartColumn },
];

/**
 * MemoryHub — the family's control center for the Memory Assistant System.
 * Manages albums, exercises/assignments, schedules and analytics for the
 * family's linked patient.
 */
const MemoryHub = () => {
  const { user } = useAuth();
  const patientId = user?.patient?._id || user?.patient;
  const [tab, setTab] = useState('albums');
  const [range, setRange] = useState(30);

  const cog = useCognitiveData(patientId);
  const [analyticsLoading, setAnalyticsLoading] = useState(false);

  if (!patientId) {
    return (
      <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-8 text-center text-gray-400">
        No patient is linked to your account yet.
      </div>
    );
  }

  const onRange = async (days) => {
    setRange(days);
    setAnalyticsLoading(true);
    try {
      await cog.refetchAnalytics(days);
    } finally {
      setAnalyticsLoading(false);
    }
  };

  return (
    <div className="max-w-6xl mx-auto">
      <header className="mb-6">
        <h1 className="text-2xl font-bold text-white flex items-center gap-2">
          <FontAwesomeIcon icon={faPuzzlePiece} className="text-purple-400" aria-hidden="true" />
          Memory Assistant
        </h1>
        <p className="text-gray-400 text-sm mt-1">
          Build memory albums, set cognitive activities, schedule sessions and track {user?.patient?.firstName || 'your patient'}'s progress.
        </p>
      </header>

      <div role="tablist" aria-label="Memory Assistant sections" className="flex gap-1 p-1 rounded-xl bg-white/[0.04] border border-white/10 mb-6 overflow-x-auto">
        {TABS.map((t) => (
          <button
            key={t.key}
            role="tab"
            aria-selected={tab === t.key}
            aria-controls={`tabpanel-${t.key}`}
            id={`tab-${t.key}`}
            onClick={() => setTab(t.key)}
            className={`flex-1 min-w-fit px-4 py-2.5 rounded-lg text-sm font-medium whitespace-nowrap transition flex items-center justify-center gap-2 ${
              tab === t.key ? 'bg-gradient-to-r from-purple-600 to-violet-600 text-white' : 'text-gray-400 hover:text-white'
            }`}
          >
            <FontAwesomeIcon icon={t.icon} aria-hidden="true" />
            {t.label}
          </button>
        ))}
      </div>

      {cog.error && (
        <div className="mb-4 px-4 py-3 rounded-xl bg-red-500/10 border border-red-500/30 text-red-300 text-sm">{cog.error}</div>
      )}

      {cog.loading ? (
        <div className="flex justify-center py-16"><Spinner className="w-10 h-10" /></div>
      ) : (
        <>
          <div role="tabpanel" id="tabpanel-albums" aria-labelledby="tab-albums" hidden={tab !== 'albums'}>
            {tab === 'albums' && <AlbumsManager patientId={patientId} albums={cog.albums} refetchAlbums={cog.refetchAlbums} />}
          </div>
          <div role="tabpanel" id="tabpanel-exercises" aria-labelledby="tab-exercises" hidden={tab !== 'exercises'}>
            {tab === 'exercises' && (
              <ExercisesManager
                patientId={patientId}
                templates={cog.templates}
                assignments={cog.assignments}
                albums={cog.albums}
                refetchAssignments={cog.refetchAssignments}
              />
            )}
          </div>
          <div role="tabpanel" id="tabpanel-schedule" aria-labelledby="tab-schedule" hidden={tab !== 'schedule'}>
            {tab === 'schedule' && (
              <ScheduleManager
                patientId={patientId}
                schedules={cog.schedules}
                assignments={cog.assignments}
                refetchSchedules={cog.refetchSchedules}
              />
            )}
          </div>
          <div role="tabpanel" id="tabpanel-insights" aria-labelledby="tab-insights" hidden={tab !== 'insights'}>
            {tab === 'insights' && (
              <CognitiveInsights analytics={cog.analytics} loading={analyticsLoading} onRangeChange={onRange} range={range} />
            )}
          </div>
        </>
      )}
    </div>
  );
};

export default MemoryHub;
