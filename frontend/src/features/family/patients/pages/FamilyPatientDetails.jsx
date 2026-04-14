import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../../../../modules/shared/auth/AuthContext';
import { ArrowLeftIcon } from '../../../shared/icons';
import useFamilyPatientData from '../hooks/useFamilyPatientData';
import PatientOverview from '../components/PatientOverview';
import PatientMedications from '../components/PatientMedications';
import PatientMood from '../components/PatientMood';

const getLevelColor = (level) => {
  switch (level) {
    case 'early': return 'bg-green-500/20 text-green-400 border-green-500/30';
    case 'middle': return 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30';
    case 'late': return 'bg-red-500/20 text-red-400 border-red-500/30';
    default: return 'bg-gray-500/20 text-gray-400 border-gray-500/30';
  }
};

const TABS = ['overview', 'medications', 'mood'];

const FamilyPatientDetails = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [patient, setPatient] = useState(user?.patient || null);
  const [activeTab, setActiveTab] = useState('overview');
  const [currentLocation, setCurrentLocation] = useState(null);
  const { medications, moodHistory, moodStats, loading, fetchData } = useFamilyPatientData();

  useEffect(() => {
    if (user?.patient) {
      setPatient(user.patient);
    }
    fetchData(user?.patient?._id);
    getCurrentLocation();
  }, [id, user]);

  const getCurrentLocation = () => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          setCurrentLocation({
            latitude: position.coords.latitude,
            longitude: position.coords.longitude,
          });
        },
        () => {
          setCurrentLocation({ latitude: null, longitude: null });
        }
      );
    }
  };

  const handleRefresh = () => {
    if (patient?._id) {
      fetchData(patient._id);
    }
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
          <button onClick={() => navigate('/family/dashboard')} className="text-purple-400 hover:underline">
            Back to Dashboard
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0a0118] pt-8 pb-12 px-4">
      <div className="max-w-6xl mx-auto">
        {/* Back Button */}
        <button
          onClick={() => navigate('/family/dashboard')}
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
                alt={`${patient.firstName} ${patient.lastName}`}
                className="h-24 w-24 rounded-full object-cover"
              />
            ) : (
              <div className="h-24 w-24 rounded-full bg-gradient-to-br from-purple-500 to-violet-500 flex items-center justify-center text-white text-3xl font-bold">
                {patient.firstName?.[0]}{patient.lastName?.[0]}
              </div>
            )}
            <div className="flex-1">
              <h1 className="text-3xl font-bold text-white mb-1">
                {patient.firstName} {patient.lastName}
              </h1>
              <p className="text-gray-400 mb-3">
                {patient.patientNumber} • Age {patient.age} • {patient.gender?.charAt(0).toUpperCase() + patient.gender?.slice(1)}
              </p>
              <span className={`inline-block px-3 py-1 rounded-full text-sm font-medium border ${getLevelColor(patient.alzheimerLevel)}`}>
                {patient.alzheimerLevel?.charAt(0).toUpperCase() + patient.alzheimerLevel?.slice(1)} Stage Alzheimer's
              </span>
            </div>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex gap-2 mb-6 overflow-x-auto pb-2">
          {TABS.map((tab) => (
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
          <PatientOverview patient={patient} medications={medications} moodStats={moodStats} />
        )}
        {activeTab === 'medications' && (
          <PatientMedications
            medications={medications}
            patientId={patient._id}
            onRefresh={handleRefresh}
          />
        )}
        {activeTab === 'mood' && (
          <PatientMood
            moodHistory={moodHistory}
            moodStats={moodStats}
            patientId={patient._id}
            currentLocation={currentLocation}
            onRefresh={handleRefresh}
            patientFirstName={patient?.firstName}
          />
        )}
      </div>
    </div>
  );
};

export default FamilyPatientDetails;
