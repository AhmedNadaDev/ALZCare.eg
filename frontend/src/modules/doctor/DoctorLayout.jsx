import React from 'react';
import { Outlet, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../shared/auth/AuthContext';
import { ActivityIcon, PlusIcon, BrainIcon } from '../../features/shared/icons';
import RoleDashboardLayout from '../../features/shared/layouts/RoleDashboardLayout';

const DoctorLayout = () => {
  const { user, logout } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();

  const sidebarItems = [
    { key: 'dashboard', label: 'Overview', icon: ActivityIcon, path: '/doctor/dashboard' },
    { key: 'add-patient', label: 'Add Patient', icon: PlusIcon, path: '/doctor/patients/add' },
    { key: 'assistant', label: 'AI Assistant', icon: BrainIcon, path: '/doctor/assistant' },
  ];

  const activeKey = location.pathname.startsWith('/doctor/assistant')
    ? 'assistant'
    : location.pathname.startsWith('/doctor/patients/add')
    ? 'add-patient'
    : 'dashboard';

  return (
    <RoleDashboardLayout
      title="Doctor Workspace"
      subtitle="Doctor Dashboard"
      userName={`Dr. ${user?.firstName || ''} ${user?.lastName || ''}`.trim()}
      userSubtitle={user?.specialization || 'Specialist'}
      onLogout={() => {
        logout();
        navigate('/doctor/login');
      }}
      sidebarItems={sidebarItems}
      activeKey={activeKey}
      onSidebarSelect={(key) => {
        const target = sidebarItems.find((i) => i.key === key);
        if (target?.path) navigate(target.path);
      }}
    >
      <Outlet />
    </RoleDashboardLayout>
  );
};

export default DoctorLayout;
