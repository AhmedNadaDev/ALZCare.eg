import React from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { useAuth } from '../shared/auth/AuthContext';
import FamilyLayout from './FamilyLayout';
import FamilyDashboard from '../../features/family/dashboard/pages/FamilyDashboard';
import FamilyAssistantPage from '../../features/family/dashboard/pages/FamilyAssistantPage';
import FamilyPatientDetails from '../../features/family/patients/pages/FamilyPatientDetails';

const FamilyProtectedRoute = ({ children }) => {
  const { isAuthenticated, isFamily, loading } = useAuth();
  if (loading) return <div className="min-h-screen bg-[#0a0118] flex items-center justify-center"><div className="w-16 h-16 border-4 border-purple-500/30 border-t-purple-500 rounded-full animate-spin" /></div>;
  if (!isAuthenticated || !isFamily) return <Navigate to="/auth/login?type=family" replace />;
  return children;
};

const FamilyDashboardRouter = () => {
  return (
    <Routes>
      <Route path="/login" element={<Navigate to="/auth/login?type=family" replace />} />
      <Route path="/signup" element={<Navigate to="/auth/signup?type=family" replace />} />
      <Route element={<FamilyProtectedRoute><FamilyLayout /></FamilyProtectedRoute>}>
        <Route path="dashboard" element={<FamilyDashboard />} />
        <Route path="register-person" element={<FamilyDashboard initialTab="register" />} />
        <Route path="assistant" element={<FamilyAssistantPage />} />
        <Route path="patients/:id" element={<FamilyPatientDetails />} />
      </Route>
      <Route path="/" element={<Navigate to="/family/dashboard" replace />} />
      <Route path="*" element={<Navigate to="/family/dashboard" replace />} />
    </Routes>
  );
};

export { FamilyDashboardRouter };
export default FamilyDashboardRouter;
