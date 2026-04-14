import React, { useState, useEffect } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { patientsAPI, medicationsAPI, moodsAPI } from '../../shared/api/api';

// ===== ICONS =====
const ArrowLeftIcon = () => (
  <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="m12 19-7-7 7-7"/><path d="M19 12H5"/>
  </svg>
);

const PillIcon = () => (
  <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="m10.5 20.5 10-10a4.95 4.95 0 1 0-7-7l-10 10a4.95 4.95 0 1 0 7 7Z"/>
    <path d="m8.5 8.5 7 7"/>
  </svg>
);

const HeartIcon = () => (
  <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4.05 3 5.5l7 7Z"/>
  </svg>
);

const UserIcon = () => (
  <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/>
  </svg>
);

const PlusIcon = () => (
  <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M12 5v14"/><path d="M5 12h14"/>
  </svg>
);

const ClockIcon = () => (
  <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/>
  </svg>
);

const CheckCircleIcon = () => (
  <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/>
  </svg>
);

const TrashIcon = () => (
  <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M3 6h18"/><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"/><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"/>
  </svg>
);

const LoadingSpinner = () => (
  <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24" fill="none">
    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"/>
  </svg>
);

const PatientDetails = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const [patient, setPatient] = useState(null);
  const [medications, setMedications] = useState([]);
  const [moodHistory, setMoodHistory] = useState([]);
  const [moodStats, setMoodStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('overview');
  const [showMedModal, setShowMedModal] = useState(false);
  const [medForm, setMedForm] = useState({
    name: '',
    type: 'tablet',
    strength: '',
    instructions: '',
    schedule: [{ time: '08:00', days: ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'], dosage: '1 tablet' }]
  });
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    fetchData();
  }, [id]);

  const fetchData = async () => {
    try {
      setLoading(true);
      const [patientRes, medsRes, moodsRes, statsRes] = await Promise.all([
        patientsAPI.getById(id),
        medicationsAPI.getByPatient(id),
        moodsAPI.getByPatient(id, { days: 30, limit: 10 }),
        moodsAPI.getStats(id, 30)
      ]);
      
      setPatient(patientRes.data);
      setMedications(medsRes.data || []);
      setMoodHistory(moodsRes.data || []);
      setMoodStats(statsRes.data || null);
    } catch (error) {
      console.error('Failed to fetch data:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleAddMedication = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      await medicationsAPI.create({
        patientId: id,
        ...medForm
      });
      setShowMedModal(false);
      setMedForm({
        name: '',
        type: 'tablet',
        strength: '',
        instructions: '',
        schedule: [{ time: '08:00', days: ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'], dosage: '1 tablet' }]
      });
      // Refresh medications
      const medsRes = await medicationsAPI.getByPatient(id);
      setMedications(medsRes.data || []);
    } catch (error) {
      console.error('Failed to add medication:', error);
    } finally {
      setSubmitting(false);
    }
  };

  const getLevelColor = (level) => {
    switch (level) {
      case 'early': return 'bg-green-500/20 text-green-400 border-green-500/30';
      case 'middle': return 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30';
      case 'late': return 'bg-red-500/20 text-red-400 border-red-500/30';
      default: return 'bg-gray-500/20 text-gray-400 border-gray-500/30';
    }
  };

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
      sleepy: '😴'
    };
    return emojis[mood] || '😐';
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[#0a0118] flex items-center justify-center">
        <div className="w-16 h-16 border-4 border-purple-500/30 border-t-purple-500 rounded-full animate-spin" />
      </div>
    );
  }

  if (!patient) {
    return (
      <div className="min-h-screen bg-[#0a0118] flex items-center justify-center">
        <div className="text-center">
          <p className="text-gray-400 mb-4">Patient not found</p>
          <Link to="/doctor/dashboard" className="text-purple-400 hover:underline">
            Back to Dashboard
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0a0118] pt-8 pb-12 px-4">
      <div className="max-w-6xl mx-auto">
        {/* Back Button */}
        <button
          onClick={() => navigate('/doctor/dashboard')}
          className="inline-flex items-center gap-2 px-4 py-2 bg-white/[0.05] hover:bg-white/[0.08] border border-white/10 rounded-xl text-gray-300 hover:text-white transition-all mb-6"
        >
          <ArrowLeftIcon />
          <span>Back to Dashboard</span>
        </button>

        {/* Patient Header */}
        <div className="bg-gradient-to-br from-purple-600/20 to-violet-600/20 rounded-2xl p-6 border border-purple-500/30 mb-6">
          <div className="flex flex-col md:flex-row md:items-center gap-6">
            {patient.profileImage ? (
              <img
                src={`http://localhost:5001${patient.profileImage}`}
                alt={patient.fullName}
                className="h-24 w-24 rounded-full object-cover"
              />
            ) : (
              <div className="h-24 w-24 rounded-full bg-gradient-to-br from-purple-500 to-violet-500 flex items-center justify-center text-white text-3xl font-bold">
                {patient.firstName[0]}{patient.lastName[0]}
              </div>
            )}
            <div className="flex-1">
              <h1 className="text-3xl font-bold text-white mb-1">
                {patient.firstName} {patient.lastName}
              </h1>
              <p className="text-gray-400 mb-3">
                {patient.patientNumber} • Age {patient.age} • {patient.gender.charAt(0).toUpperCase() + patient.gender.slice(1)}
              </p>
              <span className={`inline-block px-3 py-1 rounded-full text-sm font-medium border ${getLevelColor(patient.alzheimerLevel)}`}>
                {patient.alzheimerLevel.charAt(0).toUpperCase() + patient.alzheimerLevel.slice(1)} Stage Alzheimer's
              </span>
            </div>
            {patient.family && (
              <div className="bg-white/[0.05] rounded-xl p-4 border border-white/10">
                <p className="text-xs text-gray-500 mb-1">Family Contact</p>
                <p className="text-white font-medium">{patient.family.firstName} {patient.family.lastName}</p>
                <p className="text-sm text-gray-400">{patient.family.email}</p>
                <p className="text-xs text-purple-400 capitalize">{patient.family.relationship}</p>
              </div>
            )}
          </div>
        </div>

        {/* Tabs */}
        <div className="flex gap-2 mb-6 overflow-x-auto pb-2">
          {['overview', 'medications', 'mood', 'notes'].map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`px-4 py-2 rounded-xl font-medium transition-all whitespace-nowrap ${
                activeTab === tab
                  ? 'bg-purple-500/20 text-purple-400 border border-purple-500/30'
                  : 'text-gray-400 hover:text-white hover:bg-white/[0.05]'
              }`}
            >
              {tab.charAt(0).toUpperCase() + tab.slice(1)}
            </button>
          ))}
        </div>

        {/* Tab Content */}
        {activeTab === 'overview' && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Patient Info */}
            <div className="bg-white/[0.03] rounded-2xl border border-white/[0.08] p-6">
              <div className="flex items-center gap-3 mb-4">
                <div className="h-10 w-10 rounded-xl bg-purple-500/20 flex items-center justify-center text-purple-400">
                  <UserIcon />
                </div>
                <h2 className="text-lg font-bold text-white">Patient Information</h2>
              </div>
              <div className="space-y-4">
                <div>
                  <p className="text-xs text-gray-500">Date of Birth</p>
                  <p className="text-white">{new Date(patient.dateOfBirth).toLocaleDateString()}</p>
                </div>
                <div>
                  <p className="text-xs text-gray-500">Diagnosis Date</p>
                  <p className="text-white">{new Date(patient.diagnosisDate).toLocaleDateString()}</p>
                </div>
                {patient.description && (
                  <div>
                    <p className="text-xs text-gray-500">Description</p>
                    <p className="text-white">{patient.description}</p>
                  </div>
                )}
              </div>
            </div>

            {/* Stats Summary */}
            <div className="bg-white/[0.03] rounded-2xl border border-white/[0.08] p-6">
              <div className="flex items-center gap-3 mb-4">
                <div className="h-10 w-10 rounded-xl bg-green-500/20 flex items-center justify-center text-green-400">
                  <CheckCircleIcon />
                </div>
                <h2 className="text-lg font-bold text-white">Quick Stats</h2>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="bg-white/[0.02] rounded-xl p-4 text-center">
                  <p className="text-2xl font-bold text-white">{medications.length}</p>
                  <p className="text-xs text-gray-500">Active Medications</p>
                </div>
                <div className="bg-white/[0.02] rounded-xl p-4 text-center">
                  <p className="text-2xl font-bold text-white">{moodStats?.averageScore || 0}</p>
                  <p className="text-xs text-gray-500">Avg Mood (30d)</p>
                </div>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'medications' && (
          <div className="bg-white/[0.03] rounded-2xl border border-white/[0.08] p-6">
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-xl bg-blue-500/20 flex items-center justify-center text-blue-400">
                  <PillIcon />
                </div>
                <h2 className="text-lg font-bold text-white">Medications</h2>
              </div>
              <button
                onClick={() => setShowMedModal(true)}
                className="flex items-center gap-2 px-4 py-2 bg-purple-500/20 text-purple-400 rounded-xl hover:bg-purple-500/30 transition-colors"
              >
                <PlusIcon />
                <span>Add Medication</span>
              </button>
            </div>

            {medications.length === 0 ? (
              <div className="text-center py-12">
                <PillIcon className="h-12 w-12 text-gray-600 mx-auto mb-4" />
                <p className="text-gray-400">No medications prescribed yet</p>
              </div>
            ) : (
              <div className="space-y-4">
                {medications.map((med) => (
                  <div key={med._id} className="bg-white/[0.02] rounded-xl p-4 border border-white/[0.05]">
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <p className="font-medium text-white">{med.name}</p>
                        <p className="text-sm text-gray-400">{med.type} • {med.strength}</p>
                        {med.instructions && (
                          <p className="text-sm text-gray-500 mt-2">{med.instructions}</p>
                        )}
                      </div>
                      <div className="flex items-center gap-2">
                        <span className={`px-2 py-1 rounded-lg text-xs font-medium ${
                          med.isActive ? 'bg-green-500/20 text-green-400' : 'bg-gray-500/20 text-gray-400'
                        }`}>
                          {med.isActive ? 'Active' : 'Inactive'}
                        </span>
                        <button
                          onClick={async () => {
                            if (window.confirm('Are you sure you want to delete this medication?')) {
                              try {
                                await medicationsAPI.delete(med._id);
                                fetchData();
                              } catch (error) {
                                console.error('Failed to delete medication:', error);
                                alert('Failed to delete medication');
                              }
                            }
                          }}
                          className="p-1.5 text-red-400 hover:text-red-300 hover:bg-red-500/10 rounded-lg transition-colors"
                          title="Delete medication"
                        >
                          <TrashIcon />
                        </button>
                      </div>
                    </div>
                    {med.schedule && med.schedule.length > 0 && (
                      <div className="mt-3 flex flex-wrap gap-2">
                        {med.schedule.map((s, i) => (
                          <span key={i} className="flex items-center gap-1 px-2 py-1 bg-white/[0.05] rounded-lg text-xs text-gray-400">
                            <ClockIcon />
                            {s.time} - {s.dosage}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {activeTab === 'mood' && (
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
                          onClick={async () => {
                            if (window.confirm('Are you sure you want to delete this mood entry?')) {
                              try {
                                await moodsAPI.delete(entry._id);
                                fetchData();
                              } catch (error) {
                                console.error('Failed to delete mood entry:', error);
                                alert('Failed to delete mood entry');
                              }
                            }
                          }}
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
        )}

        {activeTab === 'notes' && (
          <div className="bg-white/[0.03] rounded-2xl border border-white/[0.08] p-6">
            <h2 className="text-lg font-bold text-white mb-4">Patient Notes</h2>
            {patient.notes && patient.notes.length > 0 ? (
              <div className="space-y-3">
                {patient.notes.map((note, index) => (
                  <div key={index} className="bg-white/[0.02] rounded-xl p-4 border border-white/[0.05]">
                    <p className="text-white">{note.content}</p>
                    <p className="text-xs text-gray-500 mt-2">
                      {new Date(note.createdAt).toLocaleString()}
                    </p>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-gray-400 text-center py-8">No notes yet</p>
            )}
          </div>
        )}
      </div>

      {/* Add Medication Modal */}
      {showMedModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70">
          <div className="bg-[#1a0a2e] rounded-2xl border border-white/10 p-6 w-full max-w-md max-h-[90vh] overflow-y-auto">
            <h3 className="text-xl font-bold text-white mb-4">Add Medication</h3>
            
            <form onSubmit={handleAddMedication} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">Medication Name *</label>
                <input
                  type="text"
                  value={medForm.name}
                  onChange={(e) => setMedForm(prev => ({ ...prev, name: e.target.value }))}
                  className="w-full px-4 py-3 bg-white/[0.05] border-2 border-white/10 rounded-xl text-white placeholder-gray-500 focus:border-purple-500 outline-none"
                  placeholder="e.g., Donepezil"
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">Type</label>
                  <select
                    value={medForm.type}
                    onChange={(e) => setMedForm(prev => ({ ...prev, type: e.target.value }))}
                    className="w-full px-4 py-3 bg-[#1a0a2e] border-2 border-white/10 rounded-xl text-white focus:border-purple-500 outline-none"
                    style={{ color: '#ffffff' }}
                  >
                    <option value="tablet" style={{ backgroundColor: '#1a0a2e', color: '#ffffff' }}>Tablet</option>
                    <option value="capsule" style={{ backgroundColor: '#1a0a2e', color: '#ffffff' }}>Capsule</option>
                    <option value="liquid" style={{ backgroundColor: '#1a0a2e', color: '#ffffff' }}>Liquid</option>
                    <option value="injection" style={{ backgroundColor: '#1a0a2e', color: '#ffffff' }}>Injection</option>
                    <option value="topical" style={{ backgroundColor: '#1a0a2e', color: '#ffffff' }}>Topical</option>
                    <option value="inhaler" style={{ backgroundColor: '#1a0a2e', color: '#ffffff' }}>Inhaler</option>
                    <option value="drops" style={{ backgroundColor: '#1a0a2e', color: '#ffffff' }}>Drops</option>
                    <option value="other" style={{ backgroundColor: '#1a0a2e', color: '#ffffff' }}>Other</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">Strength</label>
                  <input
                    type="text"
                    value={medForm.strength}
                    onChange={(e) => setMedForm(prev => ({ ...prev, strength: e.target.value }))}
                    className="w-full px-4 py-3 bg-white/[0.05] border-2 border-white/10 rounded-xl text-white placeholder-gray-500 focus:border-purple-500 outline-none"
                    placeholder="e.g., 10mg"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">Instructions</label>
                <textarea
                  value={medForm.instructions}
                  onChange={(e) => setMedForm(prev => ({ ...prev, instructions: e.target.value }))}
                  rows={2}
                  className="w-full px-4 py-3 bg-white/[0.05] border-2 border-white/10 rounded-xl text-white placeholder-gray-500 focus:border-purple-500 outline-none resize-none"
                  placeholder="Take with food..."
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">Schedule</label>
                <div className="flex gap-2">
                  <input
                    type="time"
                    value={medForm.schedule[0].time}
                    onChange={(e) => setMedForm(prev => ({
                      ...prev,
                      schedule: [{ ...prev.schedule[0], time: e.target.value }]
                    }))}
                    className="flex-1 px-4 py-3 bg-white/[0.05] border-2 border-white/10 rounded-xl text-white focus:border-purple-500 outline-none"
                  />
                  <input
                    type="text"
                    value={medForm.schedule[0].dosage}
                    onChange={(e) => setMedForm(prev => ({
                      ...prev,
                      schedule: [{ ...prev.schedule[0], dosage: e.target.value }]
                    }))}
                    className="flex-1 px-4 py-3 bg-white/[0.05] border-2 border-white/10 rounded-xl text-white placeholder-gray-500 focus:border-purple-500 outline-none"
                    placeholder="1 tablet"
                  />
                </div>
              </div>

              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setShowMedModal(false)}
                  className="flex-1 px-4 py-3 text-gray-400 hover:text-white transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={!medForm.name || submitting}
                  className="flex-1 px-4 py-3 bg-gradient-to-r from-purple-600 to-violet-600 text-white font-semibold rounded-xl disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                >
                  {submitting ? <LoadingSpinner /> : 'Add Medication'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default PatientDetails;
