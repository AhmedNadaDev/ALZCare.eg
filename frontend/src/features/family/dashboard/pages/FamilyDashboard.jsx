import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../../../modules/shared/auth/AuthContext';
import { medicationsAPI, aiMoodAPI, notificationsAPI } from '../../../../modules/shared/api/api';
import {
  PillIconLg as PillIcon,
  CheckCircleIcon,
  BellIcon,
} from '../../../shared/icons';
import DonutChart from '../../../../components/ui/DonutChart';
import { LatestMoodCard, MoodStatsPanel } from '../../../shared/mood/MoodViews';
import { moodCfg } from '../../../shared/mood/moodConfig';

// ===== Local Icons =====
const XCircleIcon = () => (
  <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="10" />
    <path d="m15 9-6 6" />
    <path d="m9 9 6 6" />
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

const FamilyDashboard = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [todaySchedule, setTodaySchedule] = useState([]);
  const [moodStats, setMoodStats] = useState(null);
  const [latestMood, setLatestMood] = useState(null);
  const [adherence, setAdherence] = useState(null);
  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [currentLocation] = useState(null);

  const patient = user?.patient;

  useEffect(() => {
    if (patient?._id) fetchData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [patient]);

  const fetchData = async () => {
    try {
      setLoading(true);
      const [scheduleRes, moodRes, latestRes, notifRes, adherenceRes, unreadRes] = await Promise.all([
        medicationsAPI.getTodaySchedule(patient._id),
        aiMoodAPI.getStats(patient._id, 30),
        aiMoodAPI.getLatest(patient._id),
        notificationsAPI.getRecent(10),
        medicationsAPI.getAdherence(patient._id, 7).catch(() => null),
        notificationsAPI.getUnreadCount().catch(() => ({ data: { count: 0 } })),
      ]);

      setTodaySchedule(scheduleRes.data || []);
      setMoodStats(moodRes.data || null);
      setLatestMood(latestRes.data || null);
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
      const adherenceRes = await medicationsAPI.getAdherence(patient._id, 7).catch(() => null);
      setAdherence(adherenceRes?.data || null);
    } catch (error) {
      console.error('Failed to log medication:', error);
      alert('Failed to log medication: ' + (error.message || 'Unknown error'));
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

  // Today's schedule stats
  const todayTaken = todaySchedule.filter((m) => m.status === 'taken').length;
  const todayTotal = todaySchedule.length;
  const todayProgress = todayTotal > 0 ? Math.round((todayTaken / todayTotal) * 100) : 0;

  const latestCfg = latestMood ? moodCfg(latestMood.mood) : null;

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
                src={`${import.meta.env.VITE_API_URL || 'http://localhost:5001'}${patient.profileImage}`}
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
              <p className={`text-lg font-bold ${latestCfg ? latestCfg.color : 'text-white'}`}>
                {latestCfg ? `${latestCfg.emoji} ${latestCfg.label}` : '—'}
              </p>
              <p className="text-xs text-gray-400">Latest Mood</p>
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

      {/* ===== Section 3: AI Mood Monitoring ===== */}
      <section className="grid grid-cols-1 lg:grid-cols-12 gap-6 mb-8">
        <div className="lg:col-span-5 space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-bold text-white">AI Mood</h2>
            <button
              onClick={() => navigate(`/family/patients/${patient?._id}`)}
              className="text-sm text-purple-300 hover:text-purple-200 transition-colors"
            >
              Manage check-ins →
            </button>
          </div>
          <LatestMoodCard mood={latestMood} />
        </div>
        <div className="lg:col-span-7">
          {moodStats?.breakdown?.length ? (
            <MoodStatsPanel stats={moodStats} />
          ) : (
            <div className="h-full rounded-2xl border border-white/[0.08] bg-white/[0.03] p-6 flex flex-col items-center justify-center text-center">
              <div className="text-4xl mb-2">🎙️</div>
              <p className="text-gray-400">No AI mood check-ins yet</p>
              <p className="text-sm text-gray-600 mt-1">Schedule voice check-ins from the patient details page.</p>
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
    </>
  );
};

export default FamilyDashboard;
