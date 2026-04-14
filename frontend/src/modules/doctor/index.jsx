import React from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { useAuth } from '../shared/auth/AuthContext';
import DoctorLayout from './DoctorLayout';
import DoctorDashboard from '../../features/doctor/dashboard/pages/DoctorDashboard';
import DoctorAssistantPage from '../../features/doctor/dashboard/pages/DoctorAssistantPage';
import AddPatient from '../../features/doctor/patients/pages/AddPatient';
import PatientDetails from '../../features/doctor/patients/pages/PatientDetails';

const DoctorProtectedRoute = ({ children }) => {
  const { isAuthenticated, isDoctor, loading } = useAuth();
  if (loading) return <div className="min-h-screen bg-[#0a0118] flex items-center justify-center"><div className="w-16 h-16 border-4 border-purple-500/30 border-t-purple-500 rounded-full animate-spin" /></div>;
  if (!isAuthenticated || !isDoctor) return <Navigate to="/auth/login?type=doctor" replace />;
  return children;
};

const DoctorDashboardRouter = () => {
  return (
    <Routes>
      <Route path="/login" element={<Navigate to="/auth/login?type=doctor" replace />} />
      <Route path="/signup" element={<Navigate to="/auth/signup?type=doctor" replace />} />
      <Route element={<DoctorProtectedRoute><DoctorLayout /></DoctorProtectedRoute>}>
        <Route path="dashboard" element={<DoctorDashboard />} />
        <Route path="assistant" element={<DoctorAssistantPage />} />
        <Route path="patients/add" element={<AddPatient />} />
        <Route path="patients/:id" element={<PatientDetails />} />
      </Route>
      <Route path="/" element={<Navigate to="/doctor/dashboard" replace />} />
      <Route path="*" element={<Navigate to="/doctor/dashboard" replace />} />
    </Routes>
  );
};

export { DoctorDashboardRouter };
export default DoctorDashboardRouter;
