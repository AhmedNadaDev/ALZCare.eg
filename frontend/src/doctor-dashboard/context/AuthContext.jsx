import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { doctorAuthAPI, familyAuthAPI, tokenManager } from '../api';

const AuthContext = createContext(null);

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [userType, setUserType] = useState(null); // 'doctor' or 'family'
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Initialize auth state
  useEffect(() => {
    const initAuth = async () => {
      try {
        const storedUserType = tokenManager.getUserType();
        
        if (storedUserType === 'doctor') {
          const response = await doctorAuthAPI.verify();
          setUser(response.data.doctor);
          setUserType('doctor');
        } else if (storedUserType === 'family') {
          const response = await familyAuthAPI.verify();
          setUser(response.data.family);
          setUserType('family');
        }
      } catch (err) {
        // Token invalid or expired
        tokenManager.clearAllTokens();
        setUser(null);
        setUserType(null);
      } finally {
        setLoading(false);
      }
    };

    initAuth();
  }, []);

  // Doctor signup
  const doctorSignup = useCallback(async (data) => {
    setError(null);
    try {
      const response = await doctorAuthAPI.signup(data);
      tokenManager.setDoctorToken(response.data.token);
      setUser(response.data.doctor);
      setUserType('doctor');
      return response;
    } catch (err) {
      setError(err.message);
      throw err;
    }
  }, []);

  // Doctor login
  const doctorLogin = useCallback(async (email, password) => {
    setError(null);
    try {
      const response = await doctorAuthAPI.login({ email, password });
      tokenManager.setDoctorToken(response.data.token);
      setUser(response.data.doctor);
      setUserType('doctor');
      return response;
    } catch (err) {
      setError(err.message);
      throw err;
    }
  }, []);

  // Family login
  const familyLogin = useCallback(async (email, password) => {
    setError(null);
    try {
      const response = await familyAuthAPI.login({ email, password });
      tokenManager.setFamilyToken(response.data.token);
      setUser(response.data.family);
      setUserType('family');
      return response;
    } catch (err) {
      setError(err.message);
      throw err;
    }
  }, []);

  // Logout
  const logout = useCallback(() => {
    tokenManager.clearAllTokens();
    setUser(null);
    setUserType(null);
    setError(null);
  }, []);

  // Update profile
  const updateProfile = useCallback(async (data) => {
    setError(null);
    try {
      const api = userType === 'doctor' ? doctorAuthAPI : familyAuthAPI;
      const response = await api.updateProfile(data);
      setUser(response.data);
      return response;
    } catch (err) {
      setError(err.message);
      throw err;
    }
  }, [userType]);

  // Change password
  const changePassword = useCallback(async (currentPassword, newPassword) => {
    setError(null);
    try {
      const api = userType === 'doctor' ? doctorAuthAPI : familyAuthAPI;
      const response = await api.changePassword({ currentPassword, newPassword });
      return response;
    } catch (err) {
      setError(err.message);
      throw err;
    }
  }, [userType]);

  // Refresh user data
  const refreshUser = useCallback(async () => {
    try {
      if (userType === 'doctor') {
        const response = await doctorAuthAPI.getProfile();
        setUser(response.data);
      } else if (userType === 'family') {
        const response = await familyAuthAPI.getProfile();
        setUser(response.data);
      }
    } catch (err) {
      setError(err.message);
    }
  }, [userType]);

  const value = {
    user,
    userType,
    loading,
    error,
    isAuthenticated: !!user,
    isDoctor: userType === 'doctor',
    isFamily: userType === 'family',
    doctorSignup,
    doctorLogin,
    familyLogin,
    logout,
    updateProfile,
    changePassword,
    refreshUser,
    clearError: () => setError(null),
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
};

export default AuthContext;
