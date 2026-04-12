import React from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import {
  DoctorLogin,
  DoctorSignup,
  FamilyLogin,
  DoctorDashboard,
  FamilyDashboard,
  AddPatient,
  PatientDetails,
  FamilyPatientDetails,
  PatientPage
} from './pages';

// Protected Route for Doctor
const DoctorProtectedRoute = ({ children }) => {
  const { isAuthenticated, isDoctor, loading } = useAuth();
  
  if (loading) {
    return (
      <div className="min-h-screen bg-[#0a0118] flex items-center justify-center">
        <div className="w-16 h-16 border-4 border-purple-500/30 border-t-purple-500 rounded-full animate-spin" />
      </div>
    );
  }
  
  if (!isAuthenticated || !isDoctor) {
    return <Navigate to="/doctor/login" replace />;
  }
  
  return children;
};

// Protected Route for Family
const FamilyProtectedRoute = ({ children }) => {
  const { isAuthenticated, isFamily, loading } = useAuth();
  
  if (loading) {
    return (
      <div className="min-h-screen bg-[#0a0118] flex items-center justify-center">
        <div className="w-16 h-16 border-4 border-purple-500/30 border-t-purple-500 rounded-full animate-spin" />
      </div>
    );
  }
  
  if (!isAuthenticated || !isFamily) {
    return <Navigate to="/family/login" replace />;
  }
  
  return children;
};

// Guest Route (redirect if already authenticated)
const GuestRoute = ({ children, redirectTo, checkFamily = false }) => {
  const { isAuthenticated, isDoctor, isFamily, loading } = useAuth();
  
  if (loading) {
    return (
      <div className="min-h-screen bg-[#0a0118] flex items-center justify-center">
        <div className="w-16 h-16 border-4 border-purple-500/30 border-t-purple-500 rounded-full animate-spin" />
      </div>
    );
  }
  
  // If checking for family and user is authenticated as family, redirect
  if (checkFamily && isAuthenticated && isFamily) {
    return <Navigate to={redirectTo || '/family/dashboard'} replace />;
  }
  
  // If checking for doctor and user is authenticated as doctor, redirect
  if (!checkFamily && isAuthenticated && isDoctor) {
    return <Navigate to={redirectTo || '/doctor/dashboard'} replace />;
  }
  
  // Allow access if not authenticated or wrong user type
  return children;
};

// Doctor Dashboard Router Component
const DoctorDashboardRouter = () => {
  return (
    <AuthProvider>
      <Routes>
        {/* Doctor Auth Routes */}
        <Route 
          path="/login" 
          element={
            <GuestRoute redirectTo="/doctor/dashboard">
              <DoctorLogin />
            </GuestRoute>
          } 
        />
        <Route 
          path="/signup" 
          element={
            <GuestRoute redirectTo="/doctor/dashboard">
              <DoctorSignup />
            </GuestRoute>
          } 
        />
        
        {/* Doctor Protected Routes */}
        <Route 
          path="/dashboard" 
          element={
            <DoctorProtectedRoute>
              <DoctorDashboard />
            </DoctorProtectedRoute>
          } 
        />
        <Route 
          path="/patients/add" 
          element={
            <DoctorProtectedRoute>
              <AddPatient />
            </DoctorProtectedRoute>
          } 
        />
        <Route 
          path="/patients/:id" 
          element={
            <DoctorProtectedRoute>
              <PatientDetails />
            </DoctorProtectedRoute>
          } 
        />
        
        {/* Default redirect */}
        <Route path="/" element={<Navigate to="/doctor/login" replace />} />
        <Route path="*" element={<Navigate to="/doctor/login" replace />} />
      </Routes>
    </AuthProvider>
  );
};

// Family Dashboard Router Component
const FamilyDashboardRouter = () => {
  return (
    <AuthProvider>
      <Routes>
        {/* Family Auth Routes */}
        <Route 
          path="/login" 
          element={
            <GuestRoute redirectTo="/family/dashboard" checkFamily={true}>
              <FamilyLogin />
            </GuestRoute>
          } 
        />
        
        {/* Family Protected Routes */}
        <Route 
          path="/dashboard" 
          element={
            <FamilyProtectedRoute>
              <FamilyDashboard />
            </FamilyProtectedRoute>
          } 
        />
        <Route 
          path="/patients/:id" 
          element={
            <FamilyProtectedRoute>
              <FamilyPatientDetails />
            </FamilyProtectedRoute>
          } 
        />
        
        {/* Default redirect */}
        <Route path="/" element={<Navigate to="/family/login" replace />} />
        <Route path="*" element={<Navigate to="/family/login" replace />} />
      </Routes>
    </AuthProvider>
  );
};

export { DoctorDashboardRouter, FamilyDashboardRouter };
export default DoctorDashboardRouter;
