import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../../../modules/shared/auth/AuthContext';
import { medicationsAPI, moodsAPI, notificationsAPI } from '../../../../modules/shared/api/api';
import {
  PillIconLg as PillIcon,
  HeartIconLg as HeartIcon,
  CheckCircleIcon,
  LoadingSpinner,
  ClockIcon,
  BellIcon,
} from '../../../shared/icons';
import DonutChart from '../../../../components/ui/DonutChart';
import SparklineChart from '../../../../components/ui/SparklineChart';

// ===== Local Icons =====
const XCircleIcon = () => (
  <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="10" />
    <path d="m15 9-6 6" />
    <path d="m9 9 6 6" />
  </svg>
);

const SmileIcon = () => (
  <svg className="h-6 w-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="10" />
    <path d="M8 14s1.5 2 4 2 4-2 4-2" />
    <line x1="9" x2="9.01" y1="9" y2="9" />
    <line x1="15" x2="15.01" y1="9" y2="9" />
  </svg>
);

const getLevelColor = (level) => {
  switch (level) {
    case 'early':
      return 'text-green-400 bg-green-500/20 border-green-500/30';
    case 'middle':
      return 'text-yellow-400 bg-yellow-500/20 border-yellow-500/30';
    case 'late':
      return 'text-red-400 bg-red-500/20 border-red-500/30';
    default:
      return 'text-gray-400 bg-gray-500/20 border-gray-500/30';
  }
};

const getRelativeTime = (dateStr) => {
  const diff = Date.now() - new Date(dateStr).getTime();
  const minutes = Math.floor(diff / 60000);
  if (minutes < 1) return 'Just now';
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d ago`;
  return new Date(dateStr).toLocaleDateString();
};

const getPriorityColor = (priority) => {
  switch (priority) {
    case 'urgent':
    case 'high':
      return 'border-l-red-500';
    case 'medium':
      return 'border-l-amber-500';
    default:
      return 'border-l-gray-500';
  }
};

const getMoodScoreColor = (score) => {
  if (score >= 7) return 'text-green-400';
  if (score >= 4) return 'text-yellow-400';
  return 'text-red-400';
};

const FamilyDashboard = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [todaySchedule, setTodaySchedule] = useState([]);
  const [moodStats, setMoodStats] = useState(null);
  const [adherence, setAdherence] = useState(null);
  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [showMoodModal, setShowMoodModal] = useState(false);
  const [moodData, setMoodData] = useState({
    mood: '',
    moodScore: 5,
    notes: '',
    location: { address: '', city: '' },
  });
  const [submitting, setSubmitting] = useState(false);
  const [currentLocation, setCurrentLocation] = useState(null);

  const patient = user?.patient;

  useEffect(() => {
    if (patient?._id) fetchData();
  }, [patient]);

  const fetchData = async () => {
    try {
      setLoading(true);
      const [scheduleRes, moodRes, notifRes, adherenceRes, unreadRes] = await Promise.all([
        medicationsAPI.getTodaySchedule(patient._id),
        moodsAPI.getStats(patient._id, 7),
        notificationsAPI.getRecent(10),
        medicationsAPI.getAdherence(patient._id, 7).catch(() => null),
        notificationsAPI.getUnreadCount().catch(() => ({ data: { count: 0 } })),
      ]);

      setTodaySchedule(scheduleRes.data || []);
      setMoodStats(moodRes.data || null);
      setNotifications(notifRes.data || []);
      setAdherence(adherenceRes?.data || null);
      setUnreadCount(unreadRes.data?.count || unreadRes.data?.unreadCount || 0);
    } catch (error) {
      console.error('Failed to fetch data:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleMedicationLog = async (medicationId, scheduledTime, status) => {
    try {
      const locationData = currentLocation
        ? { address: '', city: '', coordinates: currentLocation }
        : null;
      await medicationsAPI.log(medicationId, { scheduledTime, status, location: locationData });
      const scheduleRes = await medicationsAPI.getTodaySchedule(patient._id);
      setTodaySchedule(scheduleRes.data || []);
      // Refresh adherence
      const adherenceRes = await medicationsAPI.getAdherence(patient._id, 7).catch(() => null);
      setAdherence(adherenceRes?.data || null);
    } catch (error) {
      console.error('Failed to log medication:', error);
      alert('Failed to log medication: ' + (error.message || 'Unknown error'));
    }
  };

  const handleMoodSubmit = async (e) => {
    e.preventDefault();
    if (!moodData.mood) return;

    setSubmitting(true);
    try {
      const locationData = currentLocation
        ? { ...moodData.location, coordinates: currentLocation }
        : null;
      await moodsAPI.create({
        patientId: patient._id,
        mood: moodData.mood,
        moodScore: moodData.moodScore,
        notes: moodData.notes,
        location: locationData,
      });
      setShowMoodModal(false);
      setMoodData({ mood: '', moodScore: 5, notes: '', location: { address: '', city: '' } });
      const moodRes = await moodsAPI.getStats(patient._id, 7);
      setMoodStats(moodRes.data || null);
    } catch (error) {
      console.error('Failed to submit mood:', error);
      alert('Failed to submit mood entry: ' + (error.message || 'Unknown error'));
    } finally {
      setSubmitting(false);
    }
  };

  const handleMarkAllRead = async () => {
    try {
      await notificationsAPI.markAllAsRead();
      setNotifications((prev) => prev.map((n) => ({ ...n, isRead: true })));
      setUnreadCount(0);
    } catch (error) {
      console.error('Failed to mark notifications as read:', error);
    }
  };

  const moodOptions = [
    { value: 'very_happy', label: 'Very Happy', emoji: '\u{1F604}' },
    { value: 'happy', label: 'Happy', emoji: '\u{1F642}' },
    { value: 'neutral', label: 'Neutral', emoji: '\u{1F610}' },
    { value: 'sad', label: 'Sad', emoji: '\u{1F622}' },
    { value: 'very_sad', label: 'Very Sad', emoji: '\u{1F62D}' },
    { value: 'anxious', label: 'Anxious', emoji: '\u{1F630}' },
    { value: 'confused', label: 'Confused', emoji: '\u{1F615}' },
    { value: 'calm', label: 'Calm', emoji: '\u{1F60C}' },
  ];

  // Adherence donut data
  const adherenceSegments = adherence
    ? [
        { value: adherence.totalTaken || 0, color: '#22c55e', label: 'Taken' },
        { value: adherence.totalMissed || 0, color: '#ef4444', label: 'Missed' },
        {
          value: Math.max(0, (adherence.totalScheduled || 0) - (adherence.totalTaken || 0) - (adherence.totalMissed || 0)),
          color: '#eab308',
          label: 'Pending',
        },
      ]
    : [];

  const adherenceRate = adherence?.adherenceRate ?? 0;

  // Sparkline data from mood stats trend
  const moodTrendData = (moodStats?.trend || []).map((item) => ({
    x: new Date(item.date).toLocaleDateString('en-US', { weekday: 'short' }),
    y: item.averageScore || 0,
  }));

  // Today's schedule stats
  const todayTaken = todaySchedule.filter((m) => m.status === 'taken').length;
  const todayTotal = todaySchedule.length;
  const todayProgress = todayTotal > 0 ? Math.round((todayTaken / todayTotal) * 100) : 0;

  if (loading) {
    return (
      <div className="min-h-screen bg-[#0a0118] flex items-center justify-center">
        <div className="w-16 h-16 border-4 border-purple-500/30 border-t-purple-500 rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <>
      {/* ===== Section 1: Patient Hero Card ===== */}
      <section className="bg-gradient-to-br from-purple-600/20 to-violet-600/20 rounded-2xl p-6 border border-purple-500/30 mb-8">
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-5">
          <div className="flex items-center gap-4">
            {patient?.profileImage ? (
              <img
                src={`http://localhost:5001${patient.profileImage}`}
                alt={patient.fullName}
                className="h-20 w-20 rounded-full object-cover ring-2 ring-purple-500/30 flex-shrink-0"
              />
            ) : (
              <div className="h-20 w-20 rounded-full bg-gradient-to-br from-purple-500 to-violet-500 flex items-center justify-center text-white text-2xl font-bold ring-2 ring-purple-500/30 flex-shrink-0">
                {patient?.firstName?.[0]}
                {patient?.lastName?.[0]}
              </div>
            )}
            <div>
              <h1 className="text-xl sm:text-2xl font-bold text-white">
                {patient?.firstName} {patient?.lastName}
              </h1>
              <p className="text-gray-400 text-sm mt-0.5">Patient #{patient?.patientNumber}</p>
              <span
                className={`inline-block mt-2 px-3 py-1 rounded-full text-sm font-medium border ${getLevelColor(patient?.alzheimerLevel)}`}
              >
                {patient?.alzheimerLevel?.charAt(0).toUpperCase() + patient?.alzheimerLevel?.slice(1)} Stage
              </span>
            </div>
          </div>

          {/* Mini stats pills */}
          <div className="flex flex-wrap gap-3">
            <div className="bg-white/[0.08] rounded-xl px-4 py-3 text-center min-w-[100px]">
              <p className="text-lg font-bold text-white">{Math.round(adherenceRate)}%</p>
              <p className="text-xs text-gray-400">Adherence</p>
            </div>
            <div className="bg-white/[0.08] rounded-xl px-4 py-3 text-center min-w-[100px]">
              <p className={`text-lg font-bold ${getMoodScoreColor(moodStats?.averageScore || 0)}`}>
                {moodStats?.averageScore || '—'}
              </p>
              <p className="text-xs text-gray-400">Mood Avg</p>
            </div>
            <div className="bg-white/[0.08] rounded-xl px-4 py-3 text-center min-w-[100px]">
              <p className="text-lg font-bold text-white">
                {todayTaken}/{todayTotal}
              </p>
              <p className="text-xs text-gray-400">Meds Today</p>
            </div>
            <button
              onClick={() => navigate(`/family/patients/${patient?._id}`)}
              className="px-4 py-3 bg-purple-500/20 text-purple-300 rounded-xl hover:bg-purple-500/30 transition-colors text-sm font-medium self-center"
            >
              View Details
            </button>
          </div>
        </div>
      </section>

      {/* ===== Section 2: Adherence Ring + Today's Schedule ===== */}
      <section className="grid grid-cols-1 md:grid-cols-12 gap-6 mb-8">
        {/* Adherence Ring */}
        <div className="md:col-span-4 rounded-2xl border border-white/[0.08] bg-white/[0.03] p-6">
          <h2 className="text-lg font-bold text-white mb-4">Medication Adherence</h2>
          <p className="text-xs text-gray-500 mb-4">Last 7 days</p>
          {adherence ? (
            <DonutChart
              segments={adherenceSegments}
              size={160}
              thickness={20}
              centerValue={`${Math.round(adherenceRate)}%`}
              centerLabel="Adherence"
            />
          ) : (
            <div className="flex flex-col items-center justify-center py-8">
              <div className="h-10 w-10 text-gray-600 mb-2">
                <PillIcon />
              </div>
              <p className="text-gray-500 text-sm">No adherence data yet</p>
            </div>
          )}
        </div>

        {/* Today's Schedule */}
        <div className="md:col-span-8 rounded-2xl border border-white/[0.08] bg-white/[0.03] p-6">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-xl bg-blue-500/20 flex items-center justify-center text-blue-400">
                <PillIcon />
              </div>
              <div>
                <h2 className="text-lg font-bold text-white">Today's Medications</h2>
                <p className="text-xs text-gray-500">
                  {todayTaken} of {todayTotal} completed
                </p>
              </div>
            </div>
          </div>

          {/* Progress bar */}
          {todayTotal > 0 && (
            <div className="mb-4">
              <div className="w-full h-2 bg-white/[0.06] rounded-full overflow-hidden">
                <div
                  className="h-full bg-gradient-to-r from-green-500 to-green-400 rounded-full transition-all duration-700"
                  style={{ width: `${todayProgress}%` }}
                />
              </div>
              <p className="text-xs text-gray-500 mt-1">{todayProgress}% complete</p>
            </div>
          )}

          {todaySchedule.length === 0 ? (
            <p className="text-gray-500 text-center py-8 text-sm">No medications scheduled for today</p>
          ) : (
            <div className="space-y-2.5 max-h-[380px] overflow-y-auto pr-1">
              {todaySchedule.map((med, index) => (
                <div
                  key={index}
                  className={`p-3.5 rounded-xl border ${
                    med.status === 'taken'
                      ? 'bg-green-500/10 border-green-500/30'
                      : med.status === 'missed'
                      ? 'bg-red-500/10 border-red-500/30'
                      : 'bg-white/[0.02] border-white/[0.05]'
                  }`}
                >
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex items-center gap-3 min-w-0">
                      <span className="px-2.5 py-1 bg-white/[0.06] rounded-lg text-xs font-mono text-gray-300 flex-shrink-0">
                        {med.time}
                      </span>
                      <div className="min-w-0">
                        <p className="font-medium text-white text-sm truncate">{med.medicationName}</p>
                        <p className="text-xs text-gray-500">{med.dosage}</p>
                      </div>
                    </div>
                    {med.status === 'pending' ? (
                      <div className="flex gap-2 flex-shrink-0">
                        <button
                          onClick={() => handleMedicationLog(med.medicationId, med.time, 'taken')}
                          className="p-2 bg-green-500/20 text-green-400 rounded-lg hover:bg-green-500/30 transition-colors"
                          title="Mark as taken"
                        >
                          <CheckCircleIcon />
                        </button>
                        <button
                          onClick={() => handleMedicationLog(med.medicationId, med.time, 'missed')}
                          className="p-2 bg-red-500/20 text-red-400 rounded-lg hover:bg-red-500/30 transition-colors"
                          title="Mark as missed"
                        >
                          <XCircleIcon />
                        </button>
                      </div>
                    ) : (
                      <span
                        className={`px-2.5 py-1 rounded-full text-xs font-medium flex-shrink-0 ${
                          med.status === 'taken' ? 'bg-green-500/20 text-green-400' : 'bg-red-500/20 text-red-400'
                        }`}
                      >
                        {med.status.charAt(0).toUpperCase() + med.status.slice(1)}
                      </span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </section>

      {/* ===== Section 3: Mood Tracking Enhanced ===== */}
      <section className="grid grid-cols-1 lg:grid-cols-12 gap-6 mb-8">
        {/* Mood Trend Chart */}
        <div className="lg:col-span-7 rounded-2xl border border-white/[0.08] bg-white/[0.03] p-6">
          <h2 className="text-lg font-bold text-white mb-1">Mood Trend</h2>
          <p className="text-xs text-gray-500 mb-5">7-day mood score overview</p>

          {moodTrendData.length >= 2 ? (
            <SparklineChart
              data={moodTrendData}
              width={500}
              height={180}
              color="#a855f7"
              fillOpacity={0.15}
              showDots={true}
              showLabels={true}
              yMin={0}
              yMax={10}
            />
          ) : (
            <div className="flex flex-col items-center justify-center py-12">
              <SmileIcon className="h-10 w-10 text-gray-600 mb-2" />
              <p className="text-gray-500 text-sm">Not enough mood data for trends</p>
              <p className="text-xs text-gray-600">Add mood entries to see the chart</p>
            </div>
          )}

          {/* Mood distribution badges */}
          {moodStats?.moodDistribution && Object.keys(moodStats.moodDistribution).length > 0 && (
            <div className="mt-4 pt-4 border-t border-white/[0.06]">
              <p className="text-xs text-gray-500 mb-2">Mood Distribution</p>
              <div className="flex flex-wrap gap-2">
                {Object.entries(moodStats.moodDistribution)
                  .sort((a, b) => b[1] - a[1])
                  .slice(0, 5)
                  .map(([mood, count]) => (
                    <span
                      key={mood}
                      className="px-2.5 py-1 bg-purple-500/15 text-purple-300 rounded-full text-xs font-medium"
                    >
                      {mood.replace(/_/g, ' ')} ({count})
                    </span>
                  ))}
              </div>
            </div>
          )}
        </div>

        {/* Mood Stats + Quick Entry */}
        <div className="lg:col-span-5 rounded-2xl border border-white/[0.08] bg-white/[0.03] p-6">
          <div className="flex items-center justify-between mb-5">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-xl bg-pink-500/20 flex items-center justify-center text-pink-400">
                <HeartIcon />
              </div>
              <h2 className="text-lg font-bold text-white">Mood Stats</h2>
            </div>
            <button
              onClick={() => setShowMoodModal(true)}
              className="px-4 py-2 bg-purple-500/20 text-purple-300 rounded-lg hover:bg-purple-500/30 transition-colors text-sm font-medium"
            >
              Add Entry
            </button>
          </div>

          {moodStats ? (
            <div className="space-y-4">
              {/* Average Score - large display */}
              <div className="bg-white/[0.03] rounded-xl p-5 text-center">
                <p className={`text-4xl font-bold ${getMoodScoreColor(moodStats.averageScore || 0)}`}>
                  {moodStats.averageScore || '—'}
                </p>
                <p className="text-sm text-gray-400 mt-1">Average Score (7 days)</p>
              </div>

              {/* Stats grid */}
              <div className="grid grid-cols-2 gap-3">
                <div className="bg-white/[0.02] rounded-xl p-3.5 text-center">
                  <p className="text-xl font-bold text-white">{moodStats.totalEntries || 0}</p>
                  <p className="text-xs text-gray-500 mt-0.5">Total Entries</p>
                </div>
                <div className="bg-white/[0.02] rounded-xl p-3.5 text-center">
                  <p className={`text-xl font-bold ${(moodStats.abnormalPercentage || 0) > 20 ? 'text-red-400' : 'text-white'}`}>
                    {moodStats.abnormalCount || 0}
                  </p>
                  <p className="text-xs text-gray-500 mt-0.5">Abnormal</p>
                </div>
              </div>

              {/* Recent behaviors */}
              {moodStats.recentBehaviors && moodStats.recentBehaviors.length > 0 && (
                <div>
                  <p className="text-xs text-gray-500 mb-2">Recent Behaviors</p>
                  <div className="flex flex-wrap gap-1.5">
                    {moodStats.recentBehaviors.slice(0, 4).map((behavior, i) => (
                      <span key={i} className="px-2 py-1 bg-white/[0.05] text-gray-400 rounded-lg text-xs">
                        {behavior}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div className="text-center py-8">
              <SmileIcon className="h-12 w-12 text-gray-600 mx-auto mb-2" />
              <p className="text-gray-500">No mood data yet</p>
              <p className="text-sm text-gray-600">Add your first mood entry</p>
            </div>
          )}
        </div>
      </section>

      {/* ===== Section 4: Notifications ===== */}
      <section className="rounded-2xl border border-white/[0.08] bg-white/[0.03] p-5">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <h2 className="text-lg font-bold text-white">Notifications</h2>
            {unreadCount > 0 && (
              <span className="px-2 py-0.5 bg-purple-500/20 text-purple-400 text-xs font-medium rounded-full">
                {unreadCount} new
              </span>
            )}
          </div>
          {unreadCount > 0 && (
            <button
              onClick={handleMarkAllRead}
              className="text-sm text-gray-400 hover:text-purple-400 transition-colors"
            >
              Mark all read
            </button>
          )}
        </div>

        {notifications.length === 0 ? (
          <div className="py-8 text-center">
            <div className="h-10 w-10 text-gray-600 mx-auto mb-2">
              <BellIcon />
            </div>
            <p className="text-gray-500 text-sm">No notifications yet</p>
          </div>
        ) : (
          <div className="space-y-2 max-h-[350px] overflow-y-auto pr-1">
            {notifications.map((notification) => (
              <div
                key={notification._id}
                className={`p-3.5 rounded-xl border-l-[3px] ${getPriorityColor(notification.priority)} ${
                  notification.isRead
                    ? 'bg-white/[0.02] border border-l-[3px] border-white/[0.05]'
                    : 'bg-purple-500/[0.07] border border-l-[3px] border-purple-500/20'
                }`}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="font-medium text-white text-sm truncate">{notification.title}</p>
                    <p className="text-xs text-gray-400 mt-0.5 line-clamp-2">{notification.message}</p>
                  </div>
                  <span className="text-xs text-gray-500 whitespace-nowrap flex-shrink-0">
                    {getRelativeTime(notification.createdAt)}
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* ===== Mood Modal ===== */}
      {showMoodModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70">
          <div className="bg-[#1a0a2e] rounded-2xl border border-white/10 p-6 w-full max-w-md">
            <h3 className="text-xl font-bold text-white mb-4">Add Mood Entry</h3>

            <form onSubmit={handleMoodSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  How is {patient?.firstName} feeling?
                </label>
                <div className="grid grid-cols-4 gap-2">
                  {moodOptions.map((option) => (
                    <button
                      key={option.value}
                      type="button"
                      onClick={() => setMoodData((prev) => ({ ...prev, mood: option.value }))}
                      className={`p-3 rounded-xl text-center transition-all ${
                        moodData.mood === option.value
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

              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Mood Score: {moodData.moodScore}/10
                </label>
                <input
                  type="range"
                  min="1"
                  max="10"
                  value={moodData.moodScore}
                  onChange={(e) => setMoodData((prev) => ({ ...prev, moodScore: parseInt(e.target.value) }))}
                  className="w-full accent-purple-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">Notes (Optional)</label>
                <textarea
                  value={moodData.notes}
                  onChange={(e) => setMoodData((prev) => ({ ...prev, notes: e.target.value }))}
                  rows={3}
                  className="w-full px-4 py-3 bg-white/[0.05] border-2 border-white/10 rounded-xl text-white placeholder-gray-500 focus:border-purple-500 outline-none transition-all resize-none"
                  placeholder="Any observations about their mood..."
                />
              </div>

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
                  disabled={!moodData.mood || submitting}
                  className="flex-1 px-4 py-3 bg-gradient-to-r from-purple-600 to-violet-600 text-white font-semibold rounded-xl disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                >
                  {submitting ? <LoadingSpinner /> : 'Save Entry'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
};

export default FamilyDashboard;
