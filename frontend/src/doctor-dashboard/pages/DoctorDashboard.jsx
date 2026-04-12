import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { patientsAPI, notificationsAPI, doctorAuthAPI } from '../api';

// ===== ICONS =====
const UsersIcon = () => (
  <svg className="h-6 w-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/>
    <circle cx="9" cy="7" r="4"/>
    <path d="M22 21v-2a4 4 0 0 0-3-3.87"/>
    <path d="M16 3.13a4 4 0 0 1 0 7.75"/>
  </svg>
);

const PlusIcon = () => (
  <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M12 5v14"/>
    <path d="M5 12h14"/>
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

const BrainIcon = () => (
  <svg className="h-8 w-8" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M9.5 2A2.5 2.5 0 0 1 12 4.5v15a2.5 2.5 0 0 1-4.96.44 2.5 2.5 0 0 1-2.96-3.08 3 3 0 0 1-.34-5.58 2.5 2.5 0 0 1 1.32-4.24 2.5 2.5 0 0 1 4.44-2.54"/>
    <path d="M14.5 2A2.5 2.5 0 0 0 12 4.5v15a2.5 2.5 0 0 0 4.96.44 2.5 2.5 0 0 0 2.96-3.08 3 3 0 0 0 .34-5.58 2.5 2.5 0 0 0-1.32-4.24 2.5 2.5 0 0 0-4.44-2.54"/>
  </svg>
);

const ActivityIcon = () => (
  <svg className="h-6 w-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M22 12h-4l-3 9L9 3l-3 9H2"/>
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

const ChevronRightIcon = () => (
  <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="m9 18 6-6-6-6"/>
  </svg>
);

const SearchIcon = () => (
  <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="11" cy="11" r="8"/>
    <path d="m21 21-4.3-4.3"/>
  </svg>
);

const DoctorDashboard = () => {
  const navigate = useNavigate();
  const { user, logout } = useAuth();
  const [patients, setPatients] = useState([]);
  const [notifications, setNotifications] = useState([]);
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterLevel, setFilterLevel] = useState('all');

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      setLoading(true);
      const [patientsRes, notificationsRes, statsRes] = await Promise.all([
        patientsAPI.getAll(),
        notificationsAPI.getRecent(5),
        doctorAuthAPI.getStats()
      ]);
      
      setPatients(patientsRes.data || []);
      setNotifications(notificationsRes.data || []);
      setStats(statsRes.data || null);
    } catch (error) {
      console.error('Failed to fetch data:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = () => {
    logout();
    navigate('/doctor/login');
  };

  const filteredPatients = patients.filter(patient => {
    const matchesSearch = 
      patient.firstName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      patient.lastName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      patient.patientNumber.toLowerCase().includes(searchQuery.toLowerCase());
    
    const matchesLevel = filterLevel === 'all' || patient.alzheimerLevel === filterLevel;
    
    return matchesSearch && matchesLevel;
  });

  const getLevelColor = (level) => {
    switch (level) {
      case 'early': return 'bg-green-500/20 text-green-400 border-green-500/30';
      case 'middle': return 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30';
      case 'late': return 'bg-red-500/20 text-red-400 border-red-500/30';
      default: return 'bg-gray-500/20 text-gray-400 border-gray-500/30';
    }
  };

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
              <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-purple-600 to-violet-600 flex items-center justify-center text-white">
                <BrainIcon />
              </div>
              <div>
                <h1 className="text-lg font-bold text-white">ALZCare.eg</h1>
                <p className="text-xs text-gray-500">Doctor Dashboard</p>
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
                  <p className="text-sm font-medium text-white">Dr. {user?.firstName} {user?.lastName}</p>
                  <p className="text-xs text-gray-500">{user?.specialization}</p>
                </div>
                <div className="h-10 w-10 rounded-full bg-gradient-to-br from-purple-500 to-violet-500 flex items-center justify-center text-white font-semibold">
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
        {/* Welcome Section */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-white mb-2">
            Welcome back, Dr. {user?.firstName}
          </h1>
          <p className="text-gray-400">
            Here's an overview of your patients and recent activities.
          </p>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-8">
          <div className="bg-white/[0.03] rounded-2xl p-6 border border-white/[0.08]">
            <div className="flex items-center justify-between mb-4">
              <div className="h-12 w-12 rounded-xl bg-purple-500/20 flex items-center justify-center text-purple-400">
                <UsersIcon />
              </div>
              <span className="text-2xl font-bold text-white">{stats?.totalPatients || 0}</span>
            </div>
            <p className="text-gray-400">Total Patients</p>
          </div>

          <div className="bg-white/[0.03] rounded-2xl p-6 border border-white/[0.08]">
            <div className="flex items-center justify-between mb-4">
              <div className="h-12 w-12 rounded-xl bg-green-500/20 flex items-center justify-center text-green-400">
                <ActivityIcon />
              </div>
              <span className="text-2xl font-bold text-white">{stats?.activePatients || 0}</span>
            </div>
            <p className="text-gray-400">Active Patients</p>
          </div>

          <div className="bg-white/[0.03] rounded-2xl p-6 border border-white/[0.08]">
            <div className="flex items-center justify-between mb-4">
              <div className="h-12 w-12 rounded-xl bg-yellow-500/20 flex items-center justify-center text-yellow-400">
                <PillIcon />
              </div>
              <span className="text-2xl font-bold text-white">{stats?.levelDistribution?.middle || 0}</span>
            </div>
            <p className="text-gray-400">Middle Stage</p>
          </div>
        </div>

        {/* Patients Section */}
        <div className="bg-white/[0.03] rounded-2xl border border-white/[0.08] overflow-hidden">
          {/* Header */}
          <div className="p-6 border-b border-white/[0.08]">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
              <h2 className="text-xl font-bold text-white">Your Patients</h2>
              
              <div className="flex flex-col sm:flex-row gap-3">
                {/* Search */}
                <div className="relative">
                  <div className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 pointer-events-none">
                    <SearchIcon />
                  </div>
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Search patients..."
                    className="w-full sm:w-64 pl-10 pr-4 py-2 bg-white/[0.05] border border-white/10 rounded-xl text-white placeholder-gray-500 focus:border-purple-500 focus:ring-2 focus:ring-purple-500/20 outline-none transition-all"
                  />
                </div>

                {/* Filter */}
                <select
                  value={filterLevel}
                  onChange={(e) => setFilterLevel(e.target.value)}
                  className="px-4 py-2 bg-[#1a0a2e] border border-white/10 rounded-xl text-white focus:border-purple-500 outline-none transition-all"
                  style={{ color: '#ffffff' }}
                >
                  <option value="all" style={{ backgroundColor: '#1a0a2e', color: '#ffffff' }}>All Levels</option>
                  <option value="early" style={{ backgroundColor: '#1a0a2e', color: '#ffffff' }}>Early Stage</option>
                  <option value="middle" style={{ backgroundColor: '#1a0a2e', color: '#ffffff' }}>Middle Stage</option>
                  <option value="late" style={{ backgroundColor: '#1a0a2e', color: '#ffffff' }}>Late Stage</option>
                </select>

                {/* Add Patient Button */}
                <Link
                  to="/doctor/patients/add"
                  className="flex items-center justify-center gap-2 px-4 py-2 bg-gradient-to-r from-purple-600 to-violet-600 text-white font-medium rounded-xl hover:shadow-lg hover:shadow-purple-500/25 transition-all"
                >
                  <PlusIcon />
                  <span>Add Patient</span>
                </Link>
              </div>
            </div>
          </div>

          {/* Patient List */}
          <div className="divide-y divide-white/[0.05]">
            {filteredPatients.length === 0 ? (
              <div className="p-12 text-center">
                <UsersIcon className="h-12 w-12 text-gray-600 mx-auto mb-4" />
                <p className="text-gray-400 mb-4">
                  {patients.length === 0 
                    ? "No patients yet. Add your first patient to get started."
                    : "No patients match your search criteria."
                  }
                </p>
                {patients.length === 0 && (
                  <Link
                    to="/doctor/patients/add"
                    className="inline-flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-purple-600 to-violet-600 text-white font-medium rounded-xl hover:shadow-lg hover:shadow-purple-500/25 transition-all"
                  >
                    <PlusIcon />
                    <span>Add First Patient</span>
                  </Link>
                )}
              </div>
            ) : (
              filteredPatients.map((patient) => (
                <Link
                  key={patient._id}
                  to={`/doctor/patients/${patient._id}`}
                  className="flex items-center justify-between p-4 sm:p-6 hover:bg-white/[0.02] transition-colors"
                >
                  <div className="flex items-center gap-4">
                    {patient.profileImage ? (
                      <img
                        src={`http://localhost:5001${patient.profileImage}`}
                        alt={patient.fullName}
                        className="h-12 w-12 rounded-full object-cover"
                      />
                    ) : (
                      <div className="h-12 w-12 rounded-full bg-gradient-to-br from-purple-500/30 to-violet-500/30 flex items-center justify-center text-purple-300 font-semibold">
                        {patient.firstName[0]}{patient.lastName[0]}
                      </div>
                    )}
                    <div>
                      <p className="font-medium text-white">{patient.firstName} {patient.lastName}</p>
                      <p className="text-sm text-gray-500">{patient.patientNumber} • Age {patient.age}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-4">
                    <span className={`px-3 py-1 rounded-full text-xs font-medium border ${getLevelColor(patient.alzheimerLevel)}`}>
                      {patient.alzheimerLevel.charAt(0).toUpperCase() + patient.alzheimerLevel.slice(1)} Stage
                    </span>
                    <ChevronRightIcon className="text-gray-600" />
                  </div>
                </Link>
              ))
            )}
          </div>
        </div>

        {/* Recent Notifications */}
        {notifications.length > 0 && (
          <div className="mt-8 bg-white/[0.03] rounded-2xl border border-white/[0.08] p-6">
            <h2 className="text-xl font-bold text-white mb-4">Recent Notifications</h2>
            <div className="space-y-3">
              {notifications.slice(0, 5).map((notification) => (
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
      </main>
    </div>
  );
};

export default DoctorDashboard;
