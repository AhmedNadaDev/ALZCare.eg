/**
 * PatientMood.jsx — AI Voice Mood Monitoring (Doctor Dashboard, read-only).
 *
 * The doctor sees the same WavLM AI mood data as the family (latest mood + arousal,
 * 30-day breakdown, timeline) but cannot edit the check-in schedule — scheduling is
 * a family/caregiver responsibility. Data is supplied by usePatientData (aiMoodAPI).
 */

import React from 'react';
import { LatestMoodCard, MoodStatsPanel, MoodTimeline } from '../../../shared/mood/MoodViews';

const BrainIcon   = () => <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M9.5 2A2.5 2.5 0 0 1 12 4.5v15a2.5 2.5 0 0 1-4.96.44 2.5 2.5 0 0 1-2.96-3.08 3 3 0 0 1-.34-5.58 2.5 2.5 0 0 1 1.32-4.24 2.5 2.5 0 0 1 4.44-2.54"/><path d="M14.5 2A2.5 2.5 0 0 0 12 4.5v15a2.5 2.5 0 0 0 4.96.44 2.5 2.5 0 0 0 2.96-3.08 3 3 0 0 0 .34-5.58 2.5 2.5 0 0 0-1.32-4.24 2.5 2.5 0 0 0-4.44-2.54"/></svg>;
const RefreshIcon = () => <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="23 4 23 10 17 10"/><path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"/></svg>;

const PatientMood = ({ moodHistory = [], moodStats = null, onRefresh }) => {
  const latest = moodHistory[0] || null;
  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-xl bg-purple-500/20 flex items-center justify-center text-purple-400"><BrainIcon /></div>
          <div>
            <h2 className="text-lg font-bold text-white">AI Mood Monitoring</h2>
            <p className="text-xs text-gray-500">Voice-based mood + arousal · acoustic estimate, not a diagnosis</p>
          </div>
        </div>
        {onRefresh && (
          <button onClick={onRefresh} className="p-2 text-gray-400 hover:text-white hover:bg-white/[0.05] rounded-xl transition-colors" title="Refresh"><RefreshIcon /></button>
        )}
      </div>

      <LatestMoodCard mood={latest} />
      <MoodStatsPanel stats={moodStats} />

      <div>
        <p className="text-sm font-bold text-white mb-3">Check-in Timeline</p>
        <MoodTimeline history={moodHistory} />
      </div>
    </div>
  );
};

export default PatientMood;
