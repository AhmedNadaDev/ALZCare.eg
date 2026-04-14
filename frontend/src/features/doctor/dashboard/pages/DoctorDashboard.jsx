import React, { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../../../../modules/shared/auth/AuthContext';
import { doctorAuthAPI, notificationsAPI, patientsAPI } from '../../../../modules/shared/api/api';
import {
  ActivityIcon,
  BellIcon,
  BrainIcon,
  ChevronRightIcon,
  PlusIcon,
  SearchIcon,
  UsersIcon,
} from '../../../shared/icons';
import DonutChart from '../../../../components/ui/DonutChart';
import DataTable from '../../../../components/ui/DataTable';
import Timeline from '../../../../components/ui/Timeline';

// ===== Helpers =====
const getLevelColor = (level) => {
  switch (level) {
    case 'early':
      return 'bg-green-500/20 text-green-400 border-green-500/30';
    case 'middle':
      return 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30';
    case 'late':
      return 'bg-red-500/20 text-red-400 border-red-500/30';
    default:
      return 'bg-gray-500/20 text-gray-400 border-gray-500/30';
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

// ===== Stat Card (dark-theme inline) =====
const DashStatCard = ({ icon, iconBg, iconColor, value, label, proportion, total, delay = 0 }) => (
  <div
    className="rounded-2xl border border-white/[0.08] bg-white/[0.03] p-5 hover:bg-white/[0.05] transition-all duration-300 animate-fade-in-up"
    style={{ animationDelay: `${delay}ms` }}
  >
    <div className="flex items-center justify-between mb-3">
      <div className={`h-11 w-11 rounded-xl ${iconBg} flex items-center justify-center ${iconColor}`}>
        {icon}
      </div>
      <span className="text-2xl font-bold text-white">{value}</span>
    </div>
    <p className="text-gray-400 text-sm">{label}</p>
    {proportion !== undefined && total > 0 && (
      <div className="mt-3">
        <div className="w-full h-1.5 bg-white/[0.06] rounded-full overflow-hidden">
          <div
            className={`h-full rounded-full transition-all duration-1000 ease-out ${iconBg.replace('/20', '/60')}`}
            style={{ width: `${Math.round((proportion / total) * 100)}%` }}
          />
        </div>
        <p className="text-xs text-gray-500 mt-1">{Math.round((proportion / total) * 100)}% of total</p>
      </div>
    )}
  </div>
);

const DoctorDashboard = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [patients, setPatients] = useState([]);
  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterLevel, setFilterLevel] = useState('all');

  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);
        const [patientsRes, notificationsRes, statsRes, unreadRes] = await Promise.all([
          patientsAPI.getAll(),
          notificationsAPI.getRecent(10),
          doctorAuthAPI.getStats(),
          notificationsAPI.getUnreadCount().catch(() => ({ data: { count: 0 } })),
        ]);
        setPatients(patientsRes.data || []);
        setNotifications(notificationsRes.data || []);
        setStats(statsRes.data || null);
        setUnreadCount(unreadRes.data?.count || unreadRes.data?.unreadCount || 0);
      } catch (error) {
        console.error('Failed to fetch data:', error);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, []);

  const filteredPatients = useMemo(() => {
    return patients.filter((patient) => {
      const matchesSearch =
        patient.firstName?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        patient.lastName?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        patient.patientNumber?.toLowerCase().includes(searchQuery.toLowerCase());
      const matchesLevel = filterLevel === 'all' || patient.alzheimerLevel === filterLevel;
      return matchesSearch && matchesLevel;
    });
  }, [patients, searchQuery, filterLevel]);

  const handleMarkAllRead = async () => {
    try {
      await notificationsAPI.markAllAsRead();
      setNotifications((prev) => prev.map((n) => ({ ...n, isRead: true })));
      setUnreadCount(0);
    } catch (error) {
      console.error('Failed to mark notifications as read:', error);
    }
  };

  // Donut chart data
  const donutSegments = useMemo(() => {
    if (!stats?.levelDistribution) return [];
    return [
      { value: stats.levelDistribution.early || 0, color: '#22c55e', label: 'Early Stage' },
      { value: stats.levelDistribution.middle || 0, color: '#eab308', label: 'Middle Stage' },
      { value: stats.levelDistribution.late || 0, color: '#ef4444', label: 'Late Stage' },
    ];
  }, [stats]);

  // Timeline items from notifications
  const timelineItems = useMemo(() => {
    return notifications.map((n) => ({
      id: n._id,
      title: n.title,
      description: n.message,
      time: getRelativeTime(n.createdAt),
      type: n.type || 'default',
    }));
  }, [notifications]);

  // Table columns
  const tableColumns = useMemo(
    () => [
      {
        key: 'patient',
        header: 'Patient',
        sortable: true,
        sortValue: (row) => `${row.firstName} ${row.lastName}`.toLowerCase(),
        render: (row) => (
          <div className="flex items-center gap-3">
            {row.profileImage ? (
              <img
                src={`http://localhost:5001${row.profileImage}`}
                alt=""
                className="h-10 w-10 rounded-full object-cover flex-shrink-0"
              />
            ) : (
              <div className="h-10 w-10 rounded-full bg-gradient-to-br from-purple-500/30 to-violet-500/30 flex items-center justify-center text-purple-300 font-semibold text-sm flex-shrink-0">
                {row.firstName?.[0]}
                {row.lastName?.[0]}
              </div>
            )}
            <div className="min-w-0">
              <p className="font-medium text-white truncate">
                {row.firstName} {row.lastName}
              </p>
              <p className="text-xs text-gray-500">{row.patientNumber}</p>
            </div>
          </div>
        ),
        renderMobile: (row) => (
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              {row.profileImage ? (
                <img
                  src={`http://localhost:5001${row.profileImage}`}
                  alt=""
                  className="h-10 w-10 rounded-full object-cover"
                />
              ) : (
                <div className="h-10 w-10 rounded-full bg-gradient-to-br from-purple-500/30 to-violet-500/30 flex items-center justify-center text-purple-300 font-semibold text-sm">
                  {row.firstName?.[0]}
                  {row.lastName?.[0]}
                </div>
              )}
              <div>
                <p className="font-medium text-white">
                  {row.firstName} {row.lastName}
                </p>
                <p className="text-xs text-gray-500">
                  {row.patientNumber} &bull; Age {row.age}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <span
                className={`px-2.5 py-1 rounded-full text-xs font-medium border ${getLevelColor(row.alzheimerLevel)}`}
              >
                {row.alzheimerLevel?.charAt(0).toUpperCase() + row.alzheimerLevel?.slice(1)}
              </span>
              <ChevronRightIcon className="text-gray-600" />
            </div>
          </div>
        ),
      },
      {
        key: 'age',
        header: 'Age',
        sortable: true,
        width: '80px',
        cellClassName: 'text-gray-300',
        render: (row) => row.age || '—',
      },
      {
        key: 'alzheimerLevel',
        header: 'Stage',
        sortable: true,
        width: '140px',
        render: (row) => (
          <span
            className={`px-2.5 py-1 rounded-full text-xs font-medium border ${getLevelColor(row.alzheimerLevel)}`}
          >
            {row.alzheimerLevel?.charAt(0).toUpperCase() + row.alzheimerLevel?.slice(1)} Stage
          </span>
        ),
        hideOnMobile: true,
      },
      {
        key: 'status',
        header: 'Status',
        width: '120px',
        render: (row) => {
          const isActive = row.status === 'active' || row.isActive;
          return (
            <span className="inline-flex items-center gap-1.5 text-xs font-medium">
              <span
                className={`w-2 h-2 rounded-full ${isActive ? 'bg-green-500 animate-pulse' : 'bg-gray-500'}`}
              />
              <span className={isActive ? 'text-green-400' : 'text-gray-400'}>
                {isActive ? 'Active' : 'Inactive'}
              </span>
            </span>
          );
        },
        hideOnMobile: true,
      },
      {
        key: 'actions',
        header: '',
        width: '40px',
        render: () => <ChevronRightIcon className="text-gray-600" />,
        hideOnMobile: true,
      },
    ],
    []
  );

  if (loading) {
    return (
      <div className="min-h-screen bg-[#0a0118] flex items-center justify-center">
        <div className="w-16 h-16 border-4 border-purple-500/30 border-t-purple-500 rounded-full animate-spin" />
      </div>
    );
  }

  const totalPatients = stats?.totalPatients || 0;
  const activePatients = stats?.activePatients || 0;
  const earlyCount = stats?.levelDistribution?.early || 0;
  const middleCount = stats?.levelDistribution?.middle || 0;
  const lateCount = stats?.levelDistribution?.late || 0;

  return (
    <>
      {/* ===== Section 1: Welcome Header + Quick Actions ===== */}
      <section className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4 mb-8">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-white">
            Welcome back, <span className="bg-gradient-to-r from-purple-400 to-violet-400 bg-clip-text text-transparent">Dr. {user?.firstName}</span>
          </h1>
          <p className="text-gray-400 mt-1.5">
            {new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })} &bull;{' '}
            {totalPatients} patient{totalPatients !== 1 ? 's' : ''} in your care
          </p>
        </div>
        <div className="flex flex-wrap gap-3">
          <Link
            to="/doctor/patients/add"
            className="inline-flex items-center gap-2 px-4 py-2.5 bg-gradient-to-r from-purple-600 to-violet-600 text-white font-medium rounded-xl hover:shadow-lg hover:shadow-purple-500/25 transition-all text-sm"
          >
            <PlusIcon />
            <span>Add Patient</span>
          </Link>
          <Link
            to="/doctor/assistant"
            className="inline-flex items-center gap-2 px-4 py-2.5 bg-white/[0.05] border border-white/10 text-gray-300 font-medium rounded-xl hover:bg-white/[0.08] transition-all text-sm"
          >
            <BrainIcon className="h-4 w-4" />
            <span>AI Assistant</span>
          </Link>
        </div>
      </section>

      {/* ===== Section 2: Stats Row (5 Cards) ===== */}
      <section className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-5 gap-4 mb-8">
        <DashStatCard
          icon={<UsersIcon />}
          iconBg="bg-purple-500/20"
          iconColor="text-purple-400"
          value={totalPatients}
          label="Total Patients"
          delay={0}
        />
        <DashStatCard
          icon={<ActivityIcon />}
          iconBg="bg-green-500/20"
          iconColor="text-green-400"
          value={activePatients}
          label="Active Patients"
          proportion={activePatients}
          total={totalPatients}
          delay={60}
        />
        <DashStatCard
          icon={
            <svg className="h-6 w-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 22c5.523 0 10-4.477 10-10S17.523 2 12 2 2 6.477 2 12s4.477 10 10 10z" />
              <path d="m9 12 2 2 4-4" />
            </svg>
          }
          iconBg="bg-green-500/20"
          iconColor="text-green-400"
          value={earlyCount}
          label="Early Stage"
          proportion={earlyCount}
          total={totalPatients}
          delay={120}
        />
        <DashStatCard
          icon={
            <svg className="h-6 w-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
              <line x1="12" y1="9" x2="12" y2="13" />
              <line x1="12" y1="17" x2="12.01" y2="17" />
            </svg>
          }
          iconBg="bg-yellow-500/20"
          iconColor="text-yellow-400"
          value={middleCount}
          label="Middle Stage"
          proportion={middleCount}
          total={totalPatients}
          delay={180}
        />
        <DashStatCard
          icon={
            <svg className="h-6 w-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="10" />
              <line x1="12" y1="8" x2="12" y2="12" />
              <line x1="12" y1="16" x2="12.01" y2="16" />
            </svg>
          }
          iconBg="bg-red-500/20"
          iconColor="text-red-400"
          value={lateCount}
          label="Late Stage"
          proportion={lateCount}
          total={totalPatients}
          delay={240}
        />
      </section>

      {/* ===== Section 3: Stage Distribution Donut ===== */}
      {totalPatients > 0 && (
        <section className="grid grid-cols-1 lg:grid-cols-12 gap-6 mb-8">
          <div className="lg:col-span-5 rounded-2xl border border-white/[0.08] bg-white/[0.03] p-6">
            <h2 className="text-lg font-bold text-white mb-5">Stage Distribution</h2>
            <DonutChart
              segments={donutSegments}
              size={180}
              thickness={22}
              centerValue={totalPatients}
              centerLabel="Total"
            />
          </div>

          <div className="lg:col-span-7 rounded-2xl border border-white/[0.08] bg-white/[0.03] p-6">
            <h2 className="text-lg font-bold text-white mb-2">Patient Overview</h2>
            <p className="text-sm text-gray-400 mb-5">Distribution of patients across care stages</p>

            <div className="space-y-5">
              {[
                { label: 'Early Stage', count: earlyCount, color: '#22c55e', desc: 'Mild cognitive decline' },
                { label: 'Middle Stage', count: middleCount, color: '#eab308', desc: 'Moderate cognitive decline' },
                { label: 'Late Stage', count: lateCount, color: '#ef4444', desc: 'Severe cognitive decline' },
              ].map((stage) => (
                <div key={stage.label}>
                  <div className="flex items-center justify-between mb-1.5">
                    <div>
                      <span className="text-sm font-medium text-white">{stage.label}</span>
                      <span className="text-xs text-gray-500 ml-2">{stage.desc}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-bold text-white">{stage.count}</span>
                      <span className="text-xs text-gray-500">
                        ({totalPatients > 0 ? Math.round((stage.count / totalPatients) * 100) : 0}%)
                      </span>
                    </div>
                  </div>
                  <div className="w-full h-2 bg-white/[0.06] rounded-full overflow-hidden">
                    <div
                      className="h-full rounded-full transition-all duration-1000 ease-out"
                      style={{
                        width: `${totalPatients > 0 ? (stage.count / totalPatients) * 100 : 0}%`,
                        backgroundColor: stage.color,
                      }}
                    />
                  </div>
                </div>
              ))}
            </div>

            <div className="mt-6 pt-5 border-t border-white/[0.06] grid grid-cols-3 gap-4">
              <div className="text-center">
                <p className="text-2xl font-bold text-white">{totalPatients}</p>
                <p className="text-xs text-gray-500 mt-0.5">Total</p>
              </div>
              <div className="text-center">
                <p className="text-2xl font-bold text-green-400">{activePatients}</p>
                <p className="text-xs text-gray-500 mt-0.5">Active</p>
              </div>
              <div className="text-center">
                <p className="text-2xl font-bold text-gray-400">{totalPatients - activePatients}</p>
                <p className="text-xs text-gray-500 mt-0.5">Inactive</p>
              </div>
            </div>
          </div>
        </section>
      )}

      {/* ===== Section 4: Patient Directory Table ===== */}
      <section className="rounded-2xl border border-white/[0.08] bg-white/[0.03] overflow-hidden mb-8">
        <div className="p-5 border-b border-white/[0.08]">
          <div className="flex flex-col xl:flex-row xl:items-center xl:justify-between gap-3">
            <div className="flex items-center gap-3">
              <h2 className="text-lg font-bold text-white">Patient Directory</h2>
              <span className="px-2.5 py-0.5 bg-purple-500/20 text-purple-400 text-xs font-medium rounded-full">
                {filteredPatients.length}
              </span>
            </div>
            <div className="flex flex-col sm:flex-row gap-3">
              <div className="relative">
                <div className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 pointer-events-none">
                  <SearchIcon />
                </div>
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search by name or number..."
                  className="w-full sm:w-64 pl-10 pr-4 py-2.5 bg-white/[0.05] border border-white/10 rounded-xl text-white placeholder-gray-500 focus:border-purple-500 outline-none transition-all text-sm"
                />
              </div>
              <select
                value={filterLevel}
                onChange={(e) => setFilterLevel(e.target.value)}
                className="px-4 py-2.5 bg-[#1a0a2e] border border-white/10 rounded-xl text-white text-sm focus:border-purple-500 outline-none transition-all"
              >
                <option value="all">All Stages</option>
                <option value="early">Early Stage</option>
                <option value="middle">Middle Stage</option>
                <option value="late">Late Stage</option>
              </select>
              <Link
                to="/doctor/patients/add"
                className="inline-flex items-center justify-center gap-2 px-4 py-2.5 bg-gradient-to-r from-purple-600 to-violet-600 text-white font-medium rounded-xl hover:shadow-lg hover:shadow-purple-500/25 transition-all text-sm"
              >
                <PlusIcon />
                <span>Add Patient</span>
              </Link>
            </div>
          </div>
        </div>

        <DataTable
          columns={tableColumns}
          data={filteredPatients}
          onRowClick={(patient) => navigate(`/doctor/patients/${patient._id}`)}
          emptyState={
            <div className="p-10 text-center">
              <div className="h-12 w-12 text-gray-600 mx-auto mb-3">
                <UsersIcon />
              </div>
              <p className="text-gray-400">
                {patients.length === 0
                  ? 'No patients yet. Add your first patient to get started.'
                  : 'No patients match your filters.'}
              </p>
            </div>
          }
        />
      </section>

      {/* ===== Section 5: Notifications + Activity Timeline ===== */}
      <section className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Notifications Panel */}
        <div className="rounded-2xl border border-white/[0.08] bg-white/[0.03] p-5">
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
            <div className="space-y-2 max-h-[420px] overflow-y-auto pr-1">
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
        </div>

        {/* Activity Timeline */}
        <div className="rounded-2xl border border-white/[0.08] bg-white/[0.03] p-5">
          <h2 className="text-lg font-bold text-white mb-4">Recent Activity</h2>
          <div className="max-h-[420px] overflow-y-auto pr-1">
            <Timeline items={timelineItems} maxItems={10} />
          </div>
        </div>
      </section>
    </>
  );
};

export default DoctorDashboard;
