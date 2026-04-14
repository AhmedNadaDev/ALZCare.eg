import React from 'react';
import { Outlet, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../shared/auth/AuthContext';
import { BrainIcon, CheckCircleIcon, HeartIcon } from '../../features/shared/icons';
import RoleDashboardLayout from '../../features/shared/layouts/RoleDashboardLayout';

const FamilyLayout = () => {
  const { user, logout } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();

  const sidebarItems = [
    { key: 'dashboard', label: 'Dashboard', icon: BrainIcon, path: '/family/dashboard' },
    { key: 'register', label: 'Register Person', icon: CheckCircleIcon, path: '/family/register-person' },
    { key: 'patient-details', label: 'Patient Details', icon: HeartIcon, path: `/family/patients/${user?.patient?._id || ''}` },
    { key: 'assistant', label: 'AI Assistant', icon: BrainIcon, path: '/family/assistant' },
  ];

  const activeKey = location.pathname.startsWith('/family/register-person')
    ? 'register'
    : location.pathname.startsWith('/family/patients/')
    ? 'patient-details'
    : location.pathname.startsWith('/family/assistant')
    ? 'assistant'
    : 'dashboard';

  return (
    <RoleDashboardLayout
      title="Family Workspace"
      subtitle="Family Dashboard"
      userName={`${user?.firstName || ''} ${user?.lastName || ''}`.trim()}
      userSubtitle={user?.relationship || 'Family Caregiver'}
      onLogout={() => {
        logout();
        navigate('/family/login');
      }}
      sidebarItems={sidebarItems}
      activeKey={activeKey}
      onSidebarSelect={(key) => {
        const target = sidebarItems.find((i) => i.key === key);
        if (!target?.path || target.path.endsWith('/')) return;
        navigate(target.path);
      }}
    >
      <Outlet />
    </RoleDashboardLayout>
  );
};

export default FamilyLayout;
