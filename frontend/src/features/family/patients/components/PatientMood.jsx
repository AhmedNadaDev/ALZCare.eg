import React, { useState } from 'react';
import { HeartIcon, PlusIcon, TrashIcon, LocationIcon, LoadingSpinner } from '../../../shared/icons';
import { moodsAPI } from '../services/familyPatientService';

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

const MOOD_OPTIONS = [
  { value: 'very_happy', label: 'Very Happy', emoji: '😄' },
  { value: 'happy', label: 'Happy', emoji: '🙂' },
  { value: 'neutral', label: 'Neutral', emoji: '😐' },
  { value: 'sad', label: 'Sad', emoji: '😢' },
  { value: 'very_sad', label: 'Very Sad', emoji: '😭' },
  { value: 'anxious', label: 'Anxious', emoji: '😰' },
  { value: 'confused', label: 'Confused', emoji: '😕' },
  { value: 'calm', label: 'Calm', emoji: '😌' },
];

const DEFAULT_MOOD_FORM = {
  mood: '',
  moodScore: 5,
  notes: '',
  location: { address: '', city: '' },
};

const PatientMood = ({ moodHistory, moodStats, patientId, currentLocation, onRefresh, patientFirstName }) => {
  const [showMoodModal, setShowMoodModal] = useState(false);
  const [moodForm, setMoodForm] = useState(DEFAULT_MOOD_FORM);
  const [submitting, setSubmitting] = useState(false);

  const handleAddMood = async (e) => {
    e.preventDefault();
    if (!moodForm.mood) return;
    setSubmitting(true);
    try {
      const locationData = currentLocation ? {
        ...moodForm.location,
        coordinates: currentLocation,
      } : null;

      await moodsAPI.create({
        patientId,
        mood: moodForm.mood,
        moodScore: moodForm.moodScore,
        notes: moodForm.notes,
        location: locationData,
      });
      setShowMoodModal(false);
      setMoodForm(DEFAULT_MOOD_FORM);
      onRefresh();
    } catch (error) {
      console.error('Failed to add mood:', error);
      alert('Failed to add mood entry: ' + (error.message || 'Unknown error'));
    } finally {
      setSubmitting(false);
    }
  };

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
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-xl bg-pink-500/20 flex items-center justify-center text-pink-400">
            <HeartIcon />
          </div>
          <h2 className="text-lg font-bold text-white">Mood History</h2>
        </div>
        <button
          onClick={() => setShowMoodModal(true)}
          className="flex items-center gap-2 px-4 py-2 bg-purple-500/20 text-purple-400 rounded-xl hover:bg-purple-500/30 transition-colors"
        >
          <PlusIcon />
          <span>Add Mood Entry</span>
        </button>
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
                    {entry.location?.address && (
                      <p className="text-xs text-gray-500 mt-1 flex items-center gap-1">
                        <LocationIcon />
                        {entry.location.address} {entry.location.city && `, ${entry.location.city}`}
                      </p>
                    )}
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

      {/* Add Mood Modal */}
      {showMoodModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70">
          <div className="bg-[#1a0a2e] rounded-2xl border border-white/10 p-6 w-full max-w-md max-h-[90vh] overflow-y-auto">
            <h3 className="text-xl font-bold text-white mb-4">Add Mood Entry</h3>

            <form onSubmit={handleAddMood} className="space-y-4">
              {/* Mood Selection */}
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  How is {patientFirstName} feeling? *
                </label>
                <div className="grid grid-cols-4 gap-2">
                  {MOOD_OPTIONS.map((option) => (
                    <button
                      key={option.value}
                      type="button"
                      onClick={() => setMoodForm(prev => ({ ...prev, mood: option.value }))}
                      className={`p-3 rounded-xl text-center transition-all ${
                        moodForm.mood === option.value
                          ? 'bg-purple-500/30 border-2 border-purple-500'
                          : 'bg-white/[0.05] border-2 border-transparent hover:bg-white/[0.08]'
                      }`}
                    >
                      <span className="text-2xl">{option.emoji}</span>
                      <p className="text-xs text-gray-400 mt-1">{option.label}</p>
                    </button>
                  ))}
                </div>
              </div>

              {/* Mood Score */}
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Mood Score: {moodForm.moodScore}/10
                </label>
                <input
                  type="range"
                  min="1"
                  max="10"
                  value={moodForm.moodScore}
                  onChange={(e) => setMoodForm(prev => ({ ...prev, moodScore: parseInt(e.target.value) }))}
                  className="w-full accent-purple-500"
                />
              </div>

              {/* Location */}
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">Location (Optional)</label>
                <input
                  type="text"
                  value={moodForm.location.address}
                  onChange={(e) => setMoodForm(prev => ({
                    ...prev,
                    location: { ...prev.location, address: e.target.value },
                  }))}
                  className="w-full px-4 py-3 bg-white/[0.05] border-2 border-white/10 rounded-xl text-white placeholder-gray-500 focus:border-purple-500 outline-none mb-2"
                  placeholder="e.g., Shampalion, محطه رمل"
                />
                <input
                  type="text"
                  value={moodForm.location.city}
                  onChange={(e) => setMoodForm(prev => ({
                    ...prev,
                    location: { ...prev.location, city: e.target.value },
                  }))}
                  className="w-full px-4 py-3 bg-white/[0.05] border-2 border-white/10 rounded-xl text-white placeholder-gray-500 focus:border-purple-500 outline-none"
                  placeholder="City"
                />
                {currentLocation && (
                  <p className="mt-1 text-xs text-gray-500 flex items-center gap-1">
                    <LocationIcon />
                    GPS coordinates will be included automatically
                  </p>
                )}
              </div>

              {/* Notes */}
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">Notes (Optional)</label>
                <textarea
                  value={moodForm.notes}
                  onChange={(e) => setMoodForm(prev => ({ ...prev, notes: e.target.value }))}
                  rows={3}
                  className="w-full px-4 py-3 bg-white/[0.05] border-2 border-white/10 rounded-xl text-white placeholder-gray-500 focus:border-purple-500 outline-none resize-none"
                  placeholder="Any observations about their mood..."
                />
              </div>

              {/* Buttons */}
              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setShowMoodModal(false)}
                  className="flex-1 px-4 py-3 text-gray-400 hover:text-white transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={!moodForm.mood || submitting}
                  className="flex-1 px-4 py-3 bg-gradient-to-r from-purple-600 to-violet-600 text-white font-semibold rounded-xl disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                >
                  {submitting ? <LoadingSpinner /> : 'Save Entry'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default PatientMood;
