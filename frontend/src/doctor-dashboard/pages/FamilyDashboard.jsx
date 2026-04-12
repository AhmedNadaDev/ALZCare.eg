import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { medicationsAPI, moodsAPI, notificationsAPI, familyMedicationsAPI, faceRecognitionAPI } from '../api';

// ===== ICONS =====
const BrainIcon = () => (
  <svg className="h-8 w-8" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M9.5 2A2.5 2.5 0 0 1 12 4.5v15a2.5 2.5 0 0 1-4.96.44 2.5 2.5 0 0 1-2.96-3.08 3 3 0 0 1-.34-5.58 2.5 2.5 0 0 1 1.32-4.24 2.5 2.5 0 0 1 4.44-2.54"/>
    <path d="M14.5 2A2.5 2.5 0 0 0 12 4.5v15a2.5 2.5 0 0 0 4.96.44 2.5 2.5 0 0 0 2.96-3.08 3 3 0 0 0 .34-5.58 2.5 2.5 0 0 0-1.32-4.24 2.5 2.5 0 0 0-4.44-2.54"/>
  </svg>
);

const BellIcon = () => (
  <svg className="h-6 w-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9"/>
    <path d="M10.3 21a1.94 1.94 0 0 0 3.4 0"/>
  </svg>
);

const LogOutIcon = () => (
  <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/>
    <polyline points="16 17 21 12 16 7"/>
    <line x1="21" x2="9" y1="12" y2="12"/>
  </svg>
);

const PillIcon = () => (
  <svg className="h-6 w-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="m10.5 20.5 10-10a4.95 4.95 0 1 0-7-7l-10 10a4.95 4.95 0 1 0 7 7Z"/>
    <path d="m8.5 8.5 7 7"/>
  </svg>
);

const HeartIcon = () => (
  <svg className="h-6 w-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4.05 3 5.5l7 7Z"/>
  </svg>
);

const CheckCircleIcon = () => (
  <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/>
    <polyline points="22 4 12 14.01 9 11.01"/>
  </svg>
);

const ClockIcon = () => (
  <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="10"/>
    <polyline points="12 6 12 12 16 14"/>
  </svg>
);

const XCircleIcon = () => (
  <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="10"/>
    <path d="m15 9-6 6"/>
    <path d="m9 9 6 6"/>
  </svg>
);

const SmileIcon = () => (
  <svg className="h-6 w-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="10"/>
    <path d="M8 14s1.5 2 4 2 4-2 4-2"/>
    <line x1="9" x2="9.01" y1="9" y2="9"/>
    <line x1="15" x2="15.01" y1="9" y2="9"/>
  </svg>
);

const LoadingSpinner = () => (
  <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24" fill="none">
    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"/>
  </svg>
);

const FamilyDashboard = () => {
  const navigate = useNavigate();
  const { user, logout } = useAuth();
  const [todaySchedule, setTodaySchedule] = useState([]);
  const [moodStats, setMoodStats] = useState(null);
  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showMoodModal, setShowMoodModal] = useState(false);
  const [moodData, setMoodData] = useState({
    mood: '',
    moodScore: 5,
    notes: '',
    location: { address: '', city: '' }
  });
  const [submitting, setSubmitting] = useState(false);
  const [currentLocation, setCurrentLocation] = useState(null);
  const [activeTab, setActiveTab] = useState('dashboard'); // 'dashboard' or 'register'
  
  // Register Person State
  const registerVideoRef = useRef(null);
  const registerCanvasRef = useRef(null);
  const [registerUseCamera, setRegisterUseCamera] = useState(false);
  const [registerLoading, setRegisterLoading] = useState(false);
  const [registerMessage, setRegisterMessage] = useState('');
  const [registerName, setRegisterName] = useState('');
  const [registerAge, setRegisterAge] = useState('');
  const [registerRelation, setRegisterRelation] = useState('');
  const [registerFiles, setRegisterFiles] = useState([]);
  const [registeredPersons, setRegisteredPersons] = useState([]);

  const patient = user?.patient;

  useEffect(() => {
    if (patient?._id) {
      fetchData();
      fetchRegisteredPersons();
    }
  }, [patient]);

  useEffect(() => {
    if (!registerUseCamera) return;

    const startCamera = async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ video: true });
        if (registerVideoRef.current) {
          registerVideoRef.current.srcObject = stream;
        }
      } catch (err) {
        setRegisterMessage(`Camera error: ${err.message}`);
      }
    };

    startCamera();

    return () => {
      if (registerVideoRef.current && registerVideoRef.current.srcObject) {
        registerVideoRef.current.srcObject.getTracks().forEach((t) => t.stop());
      }
    };
  }, [registerUseCamera]);

  const fetchData = async () => {
    try {
      setLoading(true);
      const [scheduleRes, moodRes, notifRes] = await Promise.all([
        medicationsAPI.getTodaySchedule(patient._id),
        moodsAPI.getStats(patient._id, 7),
        notificationsAPI.getRecent(5)
      ]);
      
      setTodaySchedule(scheduleRes.data || []);
      setMoodStats(moodRes.data || null);
      setNotifications(notifRes.data || []);
    } catch (error) {
      console.error('Failed to fetch data:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = () => {
    logout();
    navigate('/family/login');
  };

  const handleMedicationLog = async (medicationId, scheduledTime, status) => {
    try {
      const locationData = currentLocation ? {
        address: '',
        city: '',
        coordinates: currentLocation
      } : null;

      await medicationsAPI.log(medicationId, {
        scheduledTime,
        status,
        location: locationData
      });
      // Refresh schedule
      const scheduleRes = await medicationsAPI.getTodaySchedule(patient._id);
      setTodaySchedule(scheduleRes.data || []);
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
      const locationData = currentLocation ? {
        ...moodData.location,
        coordinates: currentLocation
      } : null;

      await moodsAPI.create({
        patientId: patient._id,
        mood: moodData.mood,
        moodScore: moodData.moodScore,
        notes: moodData.notes,
        location: locationData
      });
      setShowMoodModal(false);
      setMoodData({ mood: '', moodScore: 5, notes: '', location: { address: '', city: '' } });
      // Refresh mood stats
      const moodRes = await moodsAPI.getStats(patient._id, 7);
      setMoodStats(moodRes.data || null);
    } catch (error) {
      console.error('Failed to submit mood:', error);
      alert('Failed to submit mood entry: ' + (error.message || 'Unknown error'));
    } finally {
      setSubmitting(false);
    }
  };

  const getLevelColor = (level) => {
    switch (level) {
      case 'early': return 'text-green-400 bg-green-500/20';
      case 'middle': return 'text-yellow-400 bg-yellow-500/20';
      case 'late': return 'text-red-400 bg-red-500/20';
      default: return 'text-gray-400 bg-gray-500/20';
    }
  };

  const fetchRegisteredPersons = async () => {
    try {
      const res = await faceRecognitionAPI.getPersons();
      setRegisteredPersons(res.data || []);
    } catch (error) {
      console.error('Failed to fetch registered persons:', error);
    }
  };

  const handleRegisterFileChange = (e) => {
    setRegisterFiles(Array.from(e.target.files || []));
  };

  const captureRegisterFrame = () => {
    const video = registerVideoRef.current;
    const canvas = registerCanvasRef.current;
    if (!video || !canvas || !video.videoWidth) return;
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const ctx = canvas.getContext('2d');
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    canvas.toBlob((blob) => {
      if (blob) {
        const file = new File([blob], `capture-${Date.now()}.jpg`, { type: 'image/jpeg' });
        setRegisterFiles((prev) => [...prev, file]);
      }
    }, 'image/jpeg', 0.85);
  };

  const handleRegisterSubmit = async (e) => {
    e.preventDefault();
    setRegisterMessage('');

    if (!registerName || !registerAge || !registerRelation) {
      setRegisterMessage('Please fill name, age, and relation.');
      return;
    }

    if (!registerFiles.length) {
      setRegisterMessage('Please upload or capture at least one image.');
      return;
    }

    const formData = new FormData();
    formData.append('name', registerName);
    formData.append('age', registerAge);
    formData.append('relation', registerRelation);
    registerFiles.forEach((file) => formData.append('images', file));

    setRegisterLoading(true);
    try {
      const res = await faceRecognitionAPI.register(formData);
      const counts = res.counts || {};
      const countsText = Object.entries(counts)
        .map(([model, count]) => `${model}: ${count}`)
        .join(' • ');
      setRegisterMessage(`Success: ${res.message || 'Registered'} (${countsText})`);
      setRegisterName('');
      setRegisterAge('');
      setRegisterRelation('');
      setRegisterFiles([]);
      fetchRegisteredPersons();
    } catch (err) {
      const detail = err.message || 'Unknown error';
      setRegisterMessage(`Error: ${detail}`);
    } finally {
      setRegisterLoading(false);
    }
  };

  const moodOptions = [
    { value: 'very_happy', label: 'Very Happy', emoji: '😄' },
    { value: 'happy', label: 'Happy', emoji: '🙂' },
    { value: 'neutral', label: 'Neutral', emoji: '😐' },
    { value: 'sad', label: 'Sad', emoji: '😢' },
    { value: 'very_sad', label: 'Very Sad', emoji: '😭' },
    { value: 'anxious', label: 'Anxious', emoji: '😰' },
    { value: 'confused', label: 'Confused', emoji: '😕' },
    { value: 'calm', label: 'Calm', emoji: '😌' },
  ];

  if (loading) {
    return (
      <div className="min-h-screen bg-[#0a0118] flex items-center justify-center">
        <div className="w-16 h-16 border-4 border-purple-500/30 border-t-purple-500 rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0a0118]">
      {/* Top Navigation */}
      <nav className="fixed top-0 left-0 right-0 z-50 bg-[#0a0118]/80 backdrop-blur-xl border-b border-white/10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            {/* Logo */}
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-violet-600 to-purple-600 flex items-center justify-center text-white">
                <BrainIcon />
              </div>
              <div>
                <h1 className="text-lg font-bold text-white">ALZCare.eg</h1>
                <p className="text-xs text-gray-500">Family Dashboard</p>
              </div>
            </div>

            {/* Right Section */}
            <div className="flex items-center gap-4">
              {/* Notifications */}
              <button className="relative p-2 text-gray-400 hover:text-white transition-colors">
                <BellIcon />
                {notifications.filter(n => !n.isRead).length > 0 && (
                  <span className="absolute top-1 right-1 w-2 h-2 bg-red-500 rounded-full" />
                )}
              </button>

              {/* User Menu */}
              <div className="flex items-center gap-3">
                <div className="text-right hidden sm:block">
                  <p className="text-sm font-medium text-white">{user?.firstName} {user?.lastName}</p>
                  <p className="text-xs text-gray-500 capitalize">{user?.relationship}</p>
                </div>
                <div className="h-10 w-10 rounded-full bg-gradient-to-br from-violet-500 to-purple-500 flex items-center justify-center text-white font-semibold">
                  {user?.firstName?.[0]}{user?.lastName?.[0]}
                </div>
              </div>

              {/* Logout */}
              <button
                onClick={handleLogout}
                className="p-2 text-gray-400 hover:text-red-400 transition-colors"
                title="Logout"
              >
                <LogOutIcon />
              </button>
            </div>
          </div>
        </div>
      </nav>

      {/* Main Content */}
      <main className="pt-24 pb-12 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto">
        {/* Tabs Navigation */}
        <div className="mb-6 flex gap-2 border-b border-white/10">
          <button
            onClick={() => setActiveTab('dashboard')}
            className={`px-6 py-3 font-semibold transition-all border-b-2 ${
              activeTab === 'dashboard'
                ? 'text-purple-400 border-purple-500'
                : 'text-gray-400 border-transparent hover:text-white'
            }`}
          >
            Dashboard
          </button>
          <button
            onClick={() => setActiveTab('register')}
            className={`px-6 py-3 font-semibold transition-all border-b-2 ${
              activeTab === 'register'
                ? 'text-purple-400 border-purple-500'
                : 'text-gray-400 border-transparent hover:text-white'
            }`}
          >
            Register Person
          </button>
        </div>

        {activeTab === 'dashboard' ? (
          <>
            {/* Patient Info Card */}
        <div className="bg-gradient-to-br from-purple-600/20 to-violet-600/20 rounded-2xl p-6 border border-purple-500/30 mb-8">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              {patient?.profileImage ? (
                <img
                  src={`http://localhost:5001${patient.profileImage}`}
                  alt={patient.fullName}
                  className="h-20 w-20 rounded-full object-cover"
                />
              ) : (
                <div className="h-20 w-20 rounded-full bg-gradient-to-br from-purple-500 to-violet-500 flex items-center justify-center text-white text-2xl font-bold">
                  {patient?.firstName?.[0]}{patient?.lastName?.[0]}
                </div>
              )}
              <div>
                <h1 className="text-2xl font-bold text-white">
                  {patient?.firstName} {patient?.lastName}
                </h1>
                <p className="text-gray-400">Patient #{patient?.patientNumber}</p>
                <span className={`inline-block mt-2 px-3 py-1 rounded-full text-sm font-medium ${getLevelColor(patient?.alzheimerLevel)}`}>
                  {patient?.alzheimerLevel?.charAt(0).toUpperCase() + patient?.alzheimerLevel?.slice(1)} Stage Alzheimer's
                </span>
              </div>
            </div>
            <button
              onClick={() => navigate(`/family/patients/${patient?._id}`)}
              className="px-4 py-2 bg-purple-500/20 text-purple-400 rounded-xl hover:bg-purple-500/30 transition-colors text-sm font-medium"
            >
              View Details
            </button>
          </div>
        </div>

        {/* Quick Actions */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
          {/* Today's Medications */}
          <div className="bg-white/[0.03] rounded-2xl border border-white/[0.08] p-6">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-xl bg-blue-500/20 flex items-center justify-center text-blue-400">
                  <PillIcon />
                </div>
                <h2 className="text-lg font-bold text-white">Today's Medications</h2>
              </div>
            </div>
            
            {todaySchedule.length === 0 ? (
              <p className="text-gray-500 text-center py-8">No medications scheduled for today</p>
            ) : (
              <div className="space-y-3">
                {todaySchedule.map((med, index) => (
                  <div
                    key={index}
                    className={`p-4 rounded-xl border ${
                      med.status === 'taken' 
                        ? 'bg-green-500/10 border-green-500/30'
                        : med.status === 'missed'
                        ? 'bg-red-500/10 border-red-500/30'
                        : 'bg-white/[0.02] border-white/[0.05]'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="font-medium text-white">{med.medicationName}</p>
                        <p className="text-sm text-gray-500 flex items-center gap-1">
                          <ClockIcon className="h-4 w-4" />
                          {med.time} - {med.dosage}
                        </p>
                      </div>
                      {med.status === 'pending' ? (
                        <div className="flex gap-2">
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
                        <span className={`px-3 py-1 rounded-full text-xs font-medium ${
                          med.status === 'taken' 
                            ? 'bg-green-500/20 text-green-400'
                            : 'bg-red-500/20 text-red-400'
                        }`}>
                          {med.status.charAt(0).toUpperCase() + med.status.slice(1)}
                        </span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Mood Tracking */}
          <div className="bg-white/[0.03] rounded-2xl border border-white/[0.08] p-6">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-xl bg-pink-500/20 flex items-center justify-center text-pink-400">
                  <HeartIcon />
                </div>
                <h2 className="text-lg font-bold text-white">Mood Tracking</h2>
              </div>
              <button
                onClick={() => setShowMoodModal(true)}
                className="px-4 py-2 bg-purple-500/20 text-purple-400 rounded-lg hover:bg-purple-500/30 transition-colors text-sm font-medium"
              >
                Add Entry
              </button>
            </div>

            {moodStats ? (
              <div className="grid grid-cols-2 gap-4">
                <div className="bg-white/[0.02] rounded-xl p-4 text-center">
                  <p className="text-3xl font-bold text-white">{moodStats.averageScore}</p>
                  <p className="text-sm text-gray-500">Avg. Score (7 days)</p>
                </div>
                <div className="bg-white/[0.02] rounded-xl p-4 text-center">
                  <p className="text-3xl font-bold text-white">{moodStats.totalEntries}</p>
                  <p className="text-sm text-gray-500">Total Entries</p>
                </div>
              </div>
            ) : (
              <div className="text-center py-8">
                <SmileIcon className="h-12 w-12 text-gray-600 mx-auto mb-2" />
                <p className="text-gray-500">No mood data yet</p>
                <p className="text-sm text-gray-600">Add your first mood entry</p>
              </div>
            )}
          </div>
        </div>

        {/* Recent Notifications */}
        {notifications.length > 0 && (
          <div className="bg-white/[0.03] rounded-2xl border border-white/[0.08] p-6">
            <h2 className="text-lg font-bold text-white mb-4">Recent Notifications</h2>
            <div className="space-y-3">
              {notifications.map((notification) => (
                <div
                  key={notification._id}
                  className={`p-4 rounded-xl border ${
                    notification.isRead 
                      ? 'bg-white/[0.02] border-white/[0.05]' 
                      : 'bg-purple-500/10 border-purple-500/30'
                  }`}
                >
                  <div className="flex items-start justify-between">
                    <div>
                      <p className="font-medium text-white">{notification.title}</p>
                      <p className="text-sm text-gray-400 mt-1">{notification.message}</p>
                    </div>
                    <span className="text-xs text-gray-500">
                      {new Date(notification.createdAt).toLocaleDateString()}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
          </>
        ) : (
          /* Register Person Section */
          <div className="space-y-6">
            <div className="bg-gradient-to-br from-purple-600/20 to-violet-600/20 rounded-2xl p-6 border border-purple-500/30">
              <h2 className="text-2xl font-bold text-white mb-2">Register New Person</h2>
              <p className="text-gray-400">Add a person to the face recognition system. Upload multiple images for better accuracy.</p>
            </div>

            <div className="grid gap-6 lg:grid-cols-2">
              <form onSubmit={handleRegisterSubmit} className="space-y-4 bg-white/[0.03] rounded-2xl border border-white/[0.08] p-6">
                <div className="grid gap-3 sm:grid-cols-3">
                  <label className="flex flex-col text-sm font-semibold text-gray-300">
                    Name
                    <input
                      className="mt-1 rounded-lg bg-white/[0.05] border-2 border-white/10 px-3 py-2 text-white placeholder-gray-500 focus:border-purple-500 outline-none transition-all"
                      value={registerName}
                      onChange={(e) => setRegisterName(e.target.value)}
                      required
                      placeholder="Full name"
                    />
                  </label>
                  <label className="flex flex-col text-sm font-semibold text-gray-300">
                    Age
                    <input
                      type="number"
                      className="mt-1 rounded-lg bg-white/[0.05] border-2 border-white/10 px-3 py-2 text-white placeholder-gray-500 focus:border-purple-500 outline-none transition-all"
                      value={registerAge}
                      onChange={(e) => setRegisterAge(e.target.value)}
                      required
                      placeholder="Age"
                      min="0"
                    />
                  </label>
                  <label className="flex flex-col text-sm font-semibold text-gray-300">
                    Relation
                    <input
                      className="mt-1 rounded-lg bg-white/[0.05] border-2 border-white/10 px-3 py-2 text-white placeholder-gray-500 focus:border-purple-500 outline-none transition-all"
                      value={registerRelation}
                      onChange={(e) => setRegisterRelation(e.target.value)}
                      required
                      placeholder="e.g., Son, Daughter"
                    />
                  </label>
                </div>

                <div className="space-y-2">
                  <p className="font-semibold text-gray-300">Upload images</p>
                  <input 
                    type="file" 
                    accept="image/*" 
                    multiple 
                    onChange={handleRegisterFileChange}
                    className="w-full text-sm text-gray-400 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-semibold file:bg-purple-500/20 file:text-purple-400 hover:file:bg-purple-500/30"
                  />
                  <p className="text-xs text-gray-500">You can also capture from your webcam.</p>
                </div>

                <div className="flex items-center gap-3">
                  <button
                    type="button"
                    onClick={() => setRegisterUseCamera((p) => !p)}
                    className="px-4 py-2 bg-white/[0.05] text-white rounded-lg hover:bg-white/[0.08] transition-colors border border-white/10"
                  >
                    {registerUseCamera ? 'Stop Webcam' : 'Use Webcam'}
                  </button>
                  {registerUseCamera && (
                    <button
                      type="button"
                      onClick={captureRegisterFrame}
                      className="px-4 py-2 bg-purple-500/20 text-purple-400 rounded-lg hover:bg-purple-500/30 transition-colors"
                    >
                      Capture Snapshot
                    </button>
                  )}
                  <span className="text-sm text-gray-400">{registerFiles.length} image(s) selected</span>
                </div>

                <button
                  type="submit"
                  disabled={registerLoading}
                  className="w-full px-4 py-3 bg-gradient-to-r from-purple-600 to-violet-600 text-white font-semibold rounded-xl disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                >
                  {registerLoading ? (
                    <>
                      <LoadingSpinner />
                      Registering...
                    </>
                  ) : (
                    'Register Person'
                  )}
                </button>

                {registerMessage && (
                  <div className={`rounded-lg p-3 text-sm ${
                    registerMessage.startsWith('Success')
                      ? 'bg-green-500/10 text-green-400 border border-green-500/30'
                      : 'bg-red-500/10 text-red-400 border border-red-500/30'
                  }`}>
                    {registerMessage}
                  </div>
                )}
              </form>

              <div className="space-y-3">
                <div className="relative overflow-hidden rounded-lg bg-black aspect-video">
                  {registerUseCamera ? (
                    <video ref={registerVideoRef} autoPlay playsInline className="w-full h-full object-cover" />
                  ) : (
                    <div className="flex h-full items-center justify-center text-gray-500">Webcam disabled</div>
                  )}
                  <canvas ref={registerCanvasRef} className="hidden" />
                </div>

                {registerFiles.length > 0 && (
                  <div className="rounded-lg bg-white/[0.03] border border-white/[0.08] p-4">
                    <p className="mb-2 text-sm font-semibold text-gray-300">Selected images</p>
                    <div className="grid grid-cols-3 gap-2">
                      {registerFiles.map((file, idx) => (
                        <div key={file.name + idx} className="overflow-hidden rounded-lg border border-white/10">
                          <img
                            src={URL.createObjectURL(file)}
                            alt="preview"
                            className="h-24 w-full object-cover"
                          />
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Registered Persons List */}
            {registeredPersons.length > 0 && (
              <div className="bg-white/[0.03] rounded-2xl border border-white/[0.08] p-6">
                <h3 className="text-lg font-bold text-white mb-4">Registered Persons ({registeredPersons.length})</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {registeredPersons.map((person) => (
                    <div
                      key={person.id}
                      className="bg-white/[0.02] rounded-xl border border-white/[0.05] p-4"
                    >
                      <div className="flex items-center gap-3">
                        <div className="h-12 w-12 rounded-full bg-gradient-to-br from-purple-500 to-violet-500 flex items-center justify-center text-white font-bold">
                          {person.name[0]}
                        </div>
                        <div>
                          <p className="font-medium text-white">{person.name}</p>
                          <p className="text-sm text-gray-400">{person.relation} • Age {person.age}</p>
                        </div>
                      </div>
                      <div className="mt-3 flex flex-wrap gap-1">
                        {person.enrolledModels.map((model) => (
                          <span
                            key={model}
                            className="px-2 py-1 text-xs bg-purple-500/20 text-purple-400 rounded-full"
                          >
                            {model}
                          </span>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </main>

      {/* Mood Modal */}
      {showMoodModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70">
          <div className="bg-[#1a0a2e] rounded-2xl border border-white/10 p-6 w-full max-w-md">
            <h3 className="text-xl font-bold text-white mb-4">Add Mood Entry</h3>
            
            <form onSubmit={handleMoodSubmit} className="space-y-4">
              {/* Mood Selection */}
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">How is {patient?.firstName} feeling?</label>
                <div className="grid grid-cols-4 gap-2">
                  {moodOptions.map((option) => (
                    <button
                      key={option.value}
                      type="button"
                      onClick={() => setMoodData(prev => ({ ...prev, mood: option.value }))}
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

              {/* Mood Score */}
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Mood Score: {moodData.moodScore}/10
                </label>
                <input
                  type="range"
                  min="1"
                  max="10"
                  value={moodData.moodScore}
                  onChange={(e) => setMoodData(prev => ({ ...prev, moodScore: parseInt(e.target.value) }))}
                  className="w-full accent-purple-500"
                />
              </div>

              {/* Notes */}
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">Notes (Optional)</label>
                <textarea
                  value={moodData.notes}
                  onChange={(e) => setMoodData(prev => ({ ...prev, notes: e.target.value }))}
                  rows={3}
                  className="w-full px-4 py-3 bg-white/[0.05] border-2 border-white/10 rounded-xl text-white placeholder-gray-500 focus:border-purple-500 outline-none transition-all resize-none"
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
    </div>
  );
};

export default FamilyDashboard;
