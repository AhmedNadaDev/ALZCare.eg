import React from 'react';
import { HeartIcon, TrashIcon } from '../../../shared/icons';
import { moodsAPI } from '../services/patientService';

const getMoodEmoji = (mood) => {
  const emojis = {
    very_happy: '😄',
    happy: '🙂',
    neutral: '😐',
    sad: '😢',
    very_sad: '😭',
    anxious: '😰',
    confused: '😕',
    agitated: '😤',
    calm: '😌',
    sleepy: '😴',
  };
  return emojis[mood] || '😐';
};

const PatientMood = ({ moodHistory, moodStats, onRefresh }) => {
  const handleDeleteMood = async (moodId) => {
    if (window.confirm('Are you sure you want to delete this mood entry?')) {
      try {
        await moodsAPI.delete(moodId);
        onRefresh();
      } catch (error) {
        console.error('Failed to delete mood entry:', error);
        alert('Failed to delete mood entry');
      }
    }
  };

  return (
    <div className="bg-white/[0.03] rounded-2xl border border-white/[0.08] p-6">
      <div className="flex items-center gap-3 mb-6">
        <div className="h-10 w-10 rounded-xl bg-pink-500/20 flex items-center justify-center text-pink-400">
          <HeartIcon />
        </div>
        <h2 className="text-lg font-bold text-white">Mood History</h2>
      </div>

      {/* Mood Stats */}
      {moodStats && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
          <div className="bg-white/[0.02] rounded-xl p-4 text-center">
            <p className="text-2xl font-bold text-white">{moodStats.totalEntries}</p>
            <p className="text-xs text-gray-500">Total Entries</p>
          </div>
          <div className="bg-white/[0.02] rounded-xl p-4 text-center">
            <p className="text-2xl font-bold text-white">{moodStats.averageScore}</p>
            <p className="text-xs text-gray-500">Average Score</p>
          </div>
          <div className="bg-white/[0.02] rounded-xl p-4 text-center">
            <p className="text-2xl font-bold text-white">{moodStats.abnormalCount}</p>
            <p className="text-xs text-gray-500">Abnormal</p>
          </div>
          <div className="bg-white/[0.02] rounded-xl p-4 text-center">
            <p className="text-2xl font-bold text-white">{moodStats.abnormalPercentage}%</p>
            <p className="text-xs text-gray-500">Abnormal Rate</p>
          </div>
        </div>
      )}

      {/* Mood List */}
      {moodHistory.length === 0 ? (
        <div className="text-center py-12">
          <HeartIcon className="h-12 w-12 text-gray-600 mx-auto mb-4" />
          <p className="text-gray-400">No mood entries yet</p>
        </div>
      ) : (
        <div className="space-y-3">
          {moodHistory.map((entry) => (
            <div
              key={entry._id}
              className={`p-4 rounded-xl border ${
                entry.isAbnormal
                  ? 'bg-red-500/10 border-red-500/30'
                  : 'bg-white/[0.02] border-white/[0.05]'
              }`}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3 flex-1">
                  <span className="text-3xl">{getMoodEmoji(entry.mood)}</span>
                  <div className="flex-1">
                    <p className="font-medium text-white capitalize">{entry.mood.replace('_', ' ')}</p>
                    <p className="text-sm text-gray-400">Score: {entry.moodScore}/10</p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <div className="text-right">
                    <p className="text-sm text-gray-400">
                      {new Date(entry.recordedAt).toLocaleDateString()}
                    </p>
                    <p className="text-xs text-gray-500">
                      {new Date(entry.recordedAt).toLocaleTimeString()}
                    </p>
                  </div>
                  <button
                    onClick={() => handleDeleteMood(entry._id)}
                    className="p-1.5 text-red-400 hover:text-red-300 hover:bg-red-500/10 rounded-lg transition-colors"
                    title="Delete mood entry"
                  >
                    <TrashIcon />
                  </button>
                </div>
              </div>
              {entry.notes && (
                <p className="mt-2 text-sm text-gray-400">{entry.notes}</p>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default PatientMood;
